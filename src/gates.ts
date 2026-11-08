import { isBoundaryAt, wordChar, wordStartOccurrence } from "./boundaries";
import { computeFold, foldChar, unfoldTable } from "./normalise";

/** A pre-gate: false only when the text cannot match the query. */
export type Gate = { test: (text: string) => boolean };

// The regex retries from every anchored start, so a long text full of starts
// that fail late takes time quadratic in its length: seconds at 64k
// characters. Past this length the gate is a linear in-order scan instead; it
// ignores the anchoring, so it admits a superset and still only false-passes.
const LINEAR_SCAN_ABOVE = 256;

const holdsInOrder = (text: string, accepted: string[]): boolean => {
	let next = 0;
	for (let i = 0; i < text.length && next < accepted.length; i++) {
		if (accepted[next].includes(text[i])) next++;
	}
	return next === accepted.length;
};

// Greedy earliest placement, which finds an in-order run whenever one exists.
export const holdsInOrderFrom = (text: string, query: string, k: number, from: number): boolean => {
	while (k < query.length && (from = text.indexOf(query[k], from) + 1)) k++;
	return k >= query.length;
};

/**
 * The fuzzy tier's pre-gate, and for single-word queries the whole ladder's:
 * the query in order, starting where the chunk assembler can start. Every
 * earlier tier implies such a subsequence too. The earliest admissible start
 * admits whatever a later one does, so one placement is enough.
 *
 * Monotone under query extension, which is what lets the survivor cache in
 * search.ts reuse the previous keystroke's survivors: extending the query
 * lengthens the subsequence and never changes the first three characters.
 */
export const buildFuzzyGate = (normalisedQuery: string): Gate => {
	const first = normalisedQuery[0];
	const run = normalisedQuery.slice(0, 3);
	return {
		test: (text) => {
			let at = wordStartOccurrence(text, first);
			return (
				(at > -1 && holdsInOrderFrom(text, normalisedQuery, 1, at + 1)) ||
				((at = text.indexOf(run)) > -1 && holdsInOrderFrom(text, normalisedQuery, 3, at + 3))
			);
		},
	};
};

/**
 * `buildFuzzyGate` for text nothing has normalised yet, as one regex: each
 * character becomes the class of code points that fold to it, so the gate runs
 * against the caller's own strings before any prepared copy of the corpus
 * exists, and steps over the combining accents normaliseText strips.
 * Null when the query holds a character the unfold table doesn't cover —
 * non-Latin scripts, mostly — and the caller takes the mask path instead:
 * slower, never wrong. No `i` flag: the classes already carry both cases, and
 * hold only letters and digits, so nothing in them needs escaping.
 */
export const buildRawGate = (normalisedQuery: string): Gate | null => {
	const unfold = unfoldTable();
	const accepted: string[] = [];
	for (const char of normalisedQuery) {
		const sources = unfold[char];
		if (sources === undefined) return null;
		accepted.push(sources);
	}
	const at = accepted.map((sources) => `[${sources}][\\u0300-\\u036f]*`);
	// `[^x]*x` leaves each attempt one place to stop per step, so it cannot backtrack.
	const after = accepted.map((sources, k) => `[^${sources}]*${at[k]}`);
	// `\w` is the word characters' ASCII part, so after any other letter the
	// anchor can only false-pass; `\p{L}` takes about 0.2 ms to compile.
	const regex = new RegExp(
		`(?:(?<!\\w)${at[0]}${after.slice(1).join("")}|${at.slice(0, 3).join("")}${after.slice(3).join("")})`,
		"u",
	);
	return {
		test: (text) =>
			text.length > LINEAR_SCAN_ABOVE ? holdsInOrder(text, accepted) : regex.test(text),
	};
};

/**
 * `buildRawGate` for a one-character query, which matches only where it starts
 * a word, by the same `\w` anchor. Null when the unfold table doesn't cover
 * the character.
 */
export const buildWordStartRawGate = (normalisedQuery: string): RegExp | null => {
	const sources = unfoldTable()[normalisedQuery];
	return sources === undefined ? null : new RegExp(`(?<!\\w)[${sources}]`, "u");
};

// ASCII separators set no bit, so they are never required of the field. Query
// and field share the buckets, so a collision can only false-pass.
export const charMask = (normalised: string): number => {
	let mask = 0;
	for (let i = 0; i < normalised.length; i++) mask |= unitMask(normalised.charCodeAt(i));
	return mask;
};

// No bucketed bits: the mask alone is the presence gate.
export const isExactMask = (mask: number): boolean => (mask & ~0x3ffffff) === 0;

/**
 * Order-independent presence gate: every distinct word-character of the query
 * must appear somewhere in the field — a necessary condition for every tier.
 * Unlike the subsequence gate it stays valid for out-of-order multi-word
 * matches, and separators are excluded so `"foo bar"` still gates `"bar/foo"`.
 */
export const buildPresenceGate = (normalisedQuery: string): RegExp => {
	const seen = new Set<string>();
	let src = "^";
	for (const char of normalisedQuery) {
		// Only word characters get here, and none is special in a class.
		if (seen.has(char) || !wordChar.test(char)) continue;
		seen.add(char);
		src += `(?=[^]*[${char}])`;
	}
	return new RegExp(src);
};

/**
 * Query-side half of the rescue bigram gate, for fields missing exactly one of
 * the query's character classes, β. Only an edit at the query's sole β
 * character can reach such a field, and every rescue-eligible tier is a
 * contiguous occurrence, so every pair inside a query word not touching that
 * position must be in the field's bigram set. A class the query holds more
 * than once has no entry: the rescue's letter budget already rejects a field
 * lacking it. A required bit colliding with a touching pair's is still owed by
 * the intact rest of the window, so collisions only false-pass.
 */
export type RescueBigramGate = { requiredLo: Int32Array; requiredHi: Int32Array };

export const buildRescueBigramGate = (
	normalisedQuery: string,
	counts: Int32Array,
): RescueBigramGate => {
	const requiredLo = new Int32Array(32);
	const requiredHi = new Int32Array(32);
	// A separator outside ASCII has a class, but no field need hold it. Nor need
	// it hold either half of a surrogate pair, which reads as a boundary: that
	// only false-passes.
	const classAt = (at: number): number =>
		isBoundaryAt(normalisedQuery, at) ? 0 : bigramClass(normalisedQuery.charCodeAt(at));
	for (let soleAt = 0; soleAt < normalisedQuery.length; soleAt++) {
		// A class's mask bit is its bigram class less one.
		const b = classAt(soleAt) - 1;
		if (b < 0 || counts[b] !== 1) continue;
		for (let at = 1; at < normalisedQuery.length; at++) {
			const before = classAt(at - 1);
			const unitClass = classAt(at);
			if (before === 0 || unitClass === 0 || at - 1 === soleAt || at === soleAt) continue;
			const bit = bigramBit(before, unitClass);
			if (bit < 32) requiredLo[b] |= 1 << bit;
			else requiredHi[b] |= 1 << (bit - 32);
		}
	}
	return { requiredLo, requiredHi };
};

// `missingClasses` must name exactly one class: the one absent letter is where
// the edit must be, so the query's remaining pairs must all be present.
export const rescuePairsAdmit = (
	{ requiredLo, requiredHi }: RescueBigramGate,
	missingClasses: number,
	lo: number,
	hi: number,
): boolean => {
	const b = 31 - Math.clz32(missingClasses);
	return ((requiredLo[b] & ~lo) | (requiredHi[b] & ~hi)) === 0;
};

// `charMask`'s bit for one code unit: a letter as its lower case, digits in
// four buckets, non-ASCII in two, and nothing for an ASCII separator.
const unitMask = (unit: number): number => {
	if (unit >= 97 && unit <= 122) return 1 << (unit - 97);
	// Raw ASCII capitals, which rawFieldMask and rawFieldScan read before folding.
	if (unit >= 65 && unit <= 90) return 1 << (unit - 65);
	if (unit >= 48 && unit <= 57) return 1 << (26 + (unit & 3));
	if (unit > 127) return 1 << (30 + (unit & 1));
	return 0;
};

// `charMask`'s class for one code unit, shifted so 0 can mean "not a word
// character": class n sets mask bit n − 1, for every class.
const bigramClass = (unit: number): number => 32 - Math.clz32(unitMask(unit));

const bigramBit = (prev: number, cur: number): number => (prev * 37 + cur) & 63;

// A field's bigram set — adjacent same-word class pairs and consecutive
// word-initial pairs, 64 bits in two int32s.
export type FieldBigrams = { lo: number; hi: number };

// Every BMP code point folds to exactly one unit, so each unit's fold has a
// fixed class, kept as a stand-in unit of that class (0x80/0x81 for the two
// non-ASCII buckets). computeFold rather than foldChar, so the fold's string
// is not retained for every distinct unit in the list.
const STAND_INS = " abcdefghijklmnopqrstuvwxyz0123\x80\x81";
let standIns: Uint8Array | null = null;

const standIn = (unit: number): number => {
	const table = (standIns ??= new Uint8Array(0x10000));
	return (
		table[unit] ||
		(table[unit] = STAND_INS.charCodeAt(
			bigramClass(computeFold(String.fromCharCode(unit)).charCodeAt(0)),
		))
	);
};

const standInMasks = new Int32Array(130);
for (let unit = 0; unit < 130; unit++) standInMasks[unit] = unitMask(unit);

const NON_ASCII_BITS = 3 << 30;

const isSurrogate = (unit: number): boolean => unit >> 11 === 0x1b;

const isCombiningMark = (unit: number): boolean => unit >= 0x300 && unit <= 0x36f;

/**
 * `charMask(normaliseText(raw))` without building the normalised string. Runs
 * once per field, when a searcher first needs a whole-list pass. May only
 * false-pass: skipping NFC can only add mask bits, except that NFC, which
 * normaliseText applies to a field holding a combining mark, can compose units
 * (Hangul jamo) into one of the other non-ASCII bucket, so such a field takes
 * both non-ASCII bits.
 */
export const rawFieldMask = (raw: string): number => {
	let mask = 0;
	for (let i = 0; i < raw.length; i++) {
		const unit = raw.charCodeAt(i);
		// A surrogate's fold depends on its partner, so it takes both non-ASCII
		// bits, which can only false-pass.
		mask |=
			unit < 128
				? standInMasks[unit]
				: isSurrogate(unit) || isCombiningMark(unit)
					? NON_ASCII_BITS
					: standInMasks[standIn(unit)];
	}
	return mask;
};

/**
 * `charMask(normaliseText(raw))` without building the normalised string, also
 * accumulating the field's bigram set into `into`.
 *
 * Both halves may only false-pass: a combining mark, where NFC may compose the
 * field and raw adjacency stops matching normalised adjacency, degrades the
 * bigram set to all-bits and gives the mask both non-ASCII bits (rawFieldMask).
 */
export const rawFieldScan = (raw: string, into: FieldBigrams): number => {
	let mask = 0;
	let bigramsLo = 0;
	let bigramsHi = 0;
	let prevClass = 0;
	let lastWordInitial = 0;
	let degraded = false;
	// One inline body for raw ASCII units and folded ones alike: every factored
	// shape — shared helper, closure, module scratch, single mask-write site off
	// `bigramClass − 1` — measured 8–15% slower on the whole-corpus build.
	for (let i = 0; i < raw.length; i++) {
		let unit = raw.charCodeAt(i);
		let folded = "";
		if (unit > 127) {
			if (isCombiningMark(unit)) degraded = true;
			if (isSurrogate(unit)) {
				const codePoint = raw.codePointAt(i) as number;
				if (codePoint > 0xffff) i++;
				folded = foldChar(String.fromCodePoint(codePoint));
				unit = folded.charCodeAt(0);
			} else unit = standIn(unit);
		}
		for (let k = 0; ;) {
			let unitClass = 0;
			if (unit >= 97 && unit <= 122) {
				mask |= 1 << (unit - 97);
				unitClass = unit - 96;
			} else if (unit >= 65 && unit <= 90) {
				mask |= 1 << (unit - 65);
				unitClass = unit - 64;
			} else if (unit >= 48 && unit <= 57) {
				mask |= 1 << (26 + (unit & 3));
				unitClass = 27 + (unit & 3);
			} else if (unit > 127) {
				mask |= 1 << (30 + (unit & 1));
				unitClass = 31 + (unit & 1);
			}
			if (unitClass !== 0) {
				const pairStart = prevClass !== 0 ? prevClass : lastWordInitial;
				if (pairStart !== 0) {
					// Branchless: which half the bit lands in is data-dependent, and
					// branching on it made the whole-corpus scan ~40% slower.
					const bit = (pairStart * 37 + unitClass) & 63;
					const inLow = (bit >> 5) - 1;
					bigramsLo |= (1 << bit) & inLow;
					bigramsHi |= (1 << bit) & ~inLow;
				}
				if (prevClass === 0) lastWordInitial = unitClass;
			}
			prevClass = unitClass;
			if (++k >= folded.length) break;
			unit = folded.charCodeAt(k);
		}
	}
	if (degraded) {
		into.lo = -1;
		into.hi = -1;
		return mask | NON_ASCII_BITS;
	}
	into.lo |= bigramsLo;
	into.hi |= bigramsHi;
	return mask;
};

// A gate, so it may only false-pass: a field whose missing `needed` bits hold
// more than `spare` of the query's code units has no match. Units, not code
// points, because every correction edits units: an absent unit costs an edit.
export type LetterBudget = { needed: number; counts: Int32Array; spare: number };

// How many of the query's code units each character class holds, so a field
// lacking a class leaves that many units unmatched.
export const classCounts = (letters: string): Int32Array => {
	const counts = new Int32Array(32);
	for (let at = 0; at < letters.length; at++) {
		counts[bigramClass(letters.charCodeAt(at)) - 1]++;
	}
	return counts;
};

// `readingAdmits` with a budget of one, as a bit test: the whole-list relaxed
// pass runs it per item, where the loop measured up to 11% slower on rescue
// queries. `counts` must hold at least one unit for every class it may name.
export const admitsOneEdit = (missingClasses: number, counts: Int32Array): boolean =>
	(missingClasses & (missingClasses - 1)) === 0 &&
	(missingClasses === 0 || counts[31 - Math.clz32(missingClasses)] === 1);

// `counts` must hold at least one unit for every class `needed` names, so two
// missing classes overspend a budget of one before any count is read.
export const readingAdmits = (
	{ needed, counts, spare }: LetterBudget,
	fieldMask: number,
): boolean => {
	let missing = needed & ~fieldMask;
	if (spare < 2 && (missing & (missing - 1)) !== 0) return false;
	for (let unmatched = 0; missing !== 0; missing &= missing - 1) {
		unmatched += counts[31 - Math.clz32(missing & -missing)];
		if (unmatched > spare) return false;
	}
	return true;
};

// Only pairs of ASCII letters and digits, where a field's bigram set and the
// normalised query are sure to agree.
export const pairsOf = (words: string[]): FieldBigrams => {
	const pairs = { lo: 0, hi: 0 };
	for (const word of words) {
		for (let at = 1; at < word.length; at++) {
			const before = word.charCodeAt(at - 1);
			const unit = word.charCodeAt(at);
			if (before > 127 || unit > 127) continue;
			const beforeClass = bigramClass(before);
			const unitClass = bigramClass(unit);
			if (beforeClass === 0 || unitClass === 0) continue;
			const bit = bigramBit(beforeClass, unitClass);
			if (bit < 32) pairs.lo |= 1 << bit;
			else pairs.hi |= 1 << (bit - 32);
		}
	}
	return pairs;
};

export const lacksPairsAtMost = (
	needed: FieldBigrams,
	lo: number,
	hi: number,
	limit: number,
): boolean => {
	let missing = 0;
	for (let rest = needed.lo & ~lo; rest !== 0; rest &= rest - 1)
		if (++missing > limit) return false;
	for (let rest = needed.hi & ~hi; rest !== 0; rest &= rest - 1)
		if (++missing > limit) return false;
	return true;
};
