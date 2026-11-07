export const combiningMarks: RegExp = /[\u0300-\u036f]/g;
const hasCombiningMark = /[\u0300-\u036f]/;
const hasNonAscii = /[\u0080-\uffff]/;

// Keyboards type U+0027/U+0022; macOS smart quotes emit the curly forms, and
// without the fold one form can never match the other.
const QUOTE_FOLDS: Record<string, string> = { "‘": "'", "’": "'", "“": '"', "”": '"' };

// One folded string per code point, never changing the code-unit length — the
// 1:1 guarantee behind every published HighlightRange. Length-changing folds fall back
// to plain lowercase, then to the original character.
const computeFold = (char: string): string => {
	const quote = QUOTE_FOLDS[char];
	if (quote !== undefined) return quote;
	const lowered = char.toLowerCase();
	let stripped = lowered.normalize("NFD").replace(combiningMarks, "");
	// ł has no NFD decomposition; final sigma folds to medial.
	if (stripped === "ł") stripped = "l";
	else if (stripped === "ς") stripped = "σ";
	return stripped.length === char.length
		? stripped
		: lowered.length === char.length
			? lowered
			: // No code point reaches this today (checked over all of Unicode); it
				// keeps the fold 1:1 if a later Unicode changes a case mapping.
				/* v8 ignore next */
				char;
};

// Dense array through Latin Extended + Greek + Cyrillic (an indexed load beats
// Map's string hashing ~1.8× on the fold loop); rarer code points use the Map.
const DENSE_FOLDS_MAX = 0x4ff;
// fill() keeps the elements packed; Array.from({ length }) reads slower.
// oxlint-disable-next-line unicorn/no-new-array
const denseFolds: (string | undefined)[] = new Array(DENSE_FOLDS_MAX + 1).fill(undefined);
const rareFolds = new Map<string, string>();
const RARE_FOLDS_MAX = 65_536;

const foldChar = (char: string): string => {
	const codePoint = char.codePointAt(0) as number;
	if (codePoint <= DENSE_FOLDS_MAX) {
		let folded = denseFolds[codePoint];
		if (folded === undefined) denseFolds[codePoint] = folded = computeFold(char);
		return folded;
	}
	let folded = rareFolds.get(char);
	if (folded === undefined) {
		folded = computeFold(char);
		// Queries can name any code point, so the cache is bounded rather than
		// left to grow towards all of Unicode.
		if (rareFolds.size >= RARE_FOLDS_MAX) rareFolds.clear();
		rareFolds.set(char, folded);
	}
	return folded;
};

/**
 * Normalises text for fuzzy comparison:
 * - Lowercase
 * - Remove diacritics (é → e, ü → u, ñ → n)
 * - Fold the characters NFD leaves whole (ł → l, ς → σ)
 * - Trim whitespace
 *
 * The result is offset-preserving by construction, with exactly one code unit
 * per unit of `NFC(text).trim()`, so match ranges computed against it index the
 * caller's own string whenever that string is NFC-normal and untrimmed
 * (virtually all real data; decomposed input gets offsets into the
 * visually-identical NFC form).
 */
export const normaliseText = (text: string): string => {
	// toLowerCase can itself surface combining marks (İ → i̇), so the pure-ASCII
	// fast path tests after it.
	const lowered = text.toLowerCase();
	if (!hasNonAscii.test(lowered)) return lowered.trim();
	let trimmed = text.trim();
	// Compose first so the per-point fold sees "é", not "e" + combining mark.
	if (hasCombiningMark.test(trimmed)) trimmed = trimmed.normalize("NFC");
	let folded = "";
	for (const char of trimmed) folded += foldChar(char);
	return folded;
};

// `charMask`'s bit for one code unit: a letter as its lower case, digits in
// four buckets, non-ASCII in two, and nothing for a separator.
export const unitMask = (unit: number): number => {
	if (unit >= 97 && unit <= 122) return 1 << (unit - 97);
	// Raw ASCII capitals, which rawFieldMask and rawFieldPairs read before folding.
	if (unit >= 65 && unit <= 90) return 1 << (unit - 65);
	if (unit >= 48 && unit <= 57) return 1 << (26 + (unit & 3));
	if (unit > 127) return 1 << (30 + (unit & 1));
	return 0;
};

// `charMask`'s class for one code unit, shifted so 0 can mean "not a word
// character": class n sets mask bit n − 1, for every class.
export const bigramClass = (unit: number): number => 32 - Math.clz32(unitMask(unit));

export const bigramBit = (prev: number, cur: number): number => (prev * 37 + cur) & 63;

// A field's bigram set — adjacent same-word class pairs and consecutive
// word-initial pairs, 64 bits in two int32s.
export type FieldBigrams = { lo: number; hi: number };

// Every BMP code point folds to exactly one unit (computeFold's length check),
// so each unit's fold has a fixed class, learned once and stored as a stand-in
// unit of that class: an ASCII letter, digit or space, or 0x80/0x81 for the two
// non-ASCII buckets. 0 until first seen; the table itself waits for the first
// non-ASCII unit, so a list of ASCII never allocates it.
const STAND_INS = " abcdefghijklmnopqrstuvwxyz0123\x80\x81";
let standIns: Uint8Array | null = null;

const standIn = (unit: number): number => {
	const table = (standIns ??= new Uint8Array(0x10000));
	return (
		table[unit] ||
		(table[unit] = STAND_INS.charCodeAt(
			bigramClass(foldChar(String.fromCharCode(unit)).charCodeAt(0)),
		))
	);
};

// `unitMask` for every ASCII unit and both non-ASCII stand-ins.
const standInMasks = new Int32Array(130);
for (let unit = 0; unit < 130; unit++) standInMasks[unit] = unitMask(unit);

const NON_ASCII_BITS = 3 << 30;

const isSurrogate = (unit: number): boolean => unit >> 11 === 0x1b;

/**
 * `charMask(normaliseText(raw))` without building the normalised string. Runs
 * once per field, when a searcher first needs a whole-list pass. May only
 * false-pass: skipping NFC can only add mask bits.
 */
export const rawFieldMask = (raw: string): number => {
	let mask = 0;
	for (let i = 0; i < raw.length; i++) {
		const unit = raw.charCodeAt(i);
		// A surrogate's fold depends on its partner, so it takes both non-ASCII
		// bits, which can only false-pass.
		mask |= isSurrogate(unit) ? NON_ASCII_BITS : standInMasks[unit < 128 ? unit : standIn(unit)];
	}
	return mask;
};

/**
 * `charMask(normaliseText(raw))` without building the normalised string:
 * returns the field's char mask and accumulates its bigram set into `into`
 * (degraded = all-ones). Runs per item the first time a gate asks for its
 * pairs, or over every item when the caller builds the index up front.
 *
 * Both halves may only false-pass: skipping NFC can only ADD mask bits, and a
 * combining mark — where raw adjacency stops matching normalised adjacency —
 * degrades the bigram set to all-bits while the mask keeps folding.
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
			if (unit >= 0x300 && unit <= 0x36f) degraded = true;
			if (isSurrogate(unit)) {
				const codePoint = raw.codePointAt(i) as number;
				if (codePoint > 0xffff) i++;
				folded = foldChar(String.fromCodePoint(codePoint));
				unit = folded.charCodeAt(0);
			} else unit = standIn(unit);
		}
		for (let k = 0; ; ) {
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
	} else {
		into.lo |= bigramsLo;
		into.hi |= bigramsHi;
	}
	return mask;
};
