import { wordChar } from "./boundaries";
import { bigramBit, bigramClass, unitMask } from "./normalise";
import { unfoldTable } from "./unfold";

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
 * the query in order, starting where the chunk assembler can start, after no
 * word character or with its first three characters consecutive. Every earlier
 * tier implies such a subsequence too, and a field with no admissible first
 * placement has no chain to assemble. Plain `indexOf` rather than a regex,
 * which costs more to compile than most gates spend testing; the earliest
 * admissible start admits whatever a later one does, so one placement is enough.
 * It steps by code unit, so beside an astral character it can only false-pass.
 *
 * Monotone under query extension, which is what lets the survivor cache in
 * search.ts reuse the previous keystroke's survivors: extending the query
 * lengthens the subsequence and never changes the first three characters, so
 * the gate only ever admits fewer fields.
 */
export const buildFuzzyGate = (normalisedQuery: string): Gate => {
	const first = normalisedQuery[0];
	const run = normalisedQuery.slice(0, 3);
	return {
		test: (text) => {
			let at = text.indexOf(first);
			while (at > 0 && wordChar.test(text[at - 1])) at = text.indexOf(first, at + 1);
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
	// `[^x]*x` leaves each attempt exactly one place to stop per step, so it
	// cannot backtrack (same survivors, 16%/8% less gate time on ascii/mixed).
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

/**
 * A 32-bit character-class mask (fuzzysort-style O(1) pre-gate): bits 0–25 for
 * a–z, bits 26–29 for digits (bucketed), bits 30–31 for non-ASCII (bucketed);
 * separators are skipped so they are never required of the field. Query and
 * field use the same buckets, so a collision can only false-pass, never
 * false-reject. `(queryMask & fieldMask) !== queryMask` means some query class
 * is absent and no tier can match.
 */
export const charMask = (normalised: string): number => {
	let mask = 0;
	for (let i = 0; i < normalised.length; i++) mask |= unitMask(normalised.charCodeAt(i));
	return mask;
};


// True when the mask is an exact distinct-char presence check: no lossy bucket
// bits set, so the presence-gate regex could not reject anything further.
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
 * the query's character classes. Such a field is only reachable by an edit at
 * the query's sole character of the missing class β (two β characters would
 * need two edits), and every rescue-eligible tier is a contiguous occurrence —
 * so every query bigram NOT touching the β position must appear in the field's
 * bigram set: `requiredLo/requiredHi[β]` hold exactly those. Two or more β
 * characters store all-ones, which no real field covers (a hazard-degraded
 * field is all-ones too and still passes). Hash collisions stay
 * false-pass-only on both sides: a required bit colliding with a touching
 * pair's is still owed by the intact remainder of the window, and field-side
 * collisions only add coverage.
 */
export type RescueBigramGate = { requiredLo: Int32Array; requiredHi: Int32Array };

export const buildRescueBigramGate = (normalisedQuery: string): RescueBigramGate => {
	const requiredLo = new Int32Array(32);
	const requiredHi = new Int32Array(32);
	const occurrences = new Int32Array(32);
	const classAt = (at: number): number => bigramClass(normalisedQuery.charCodeAt(at));
	for (let soleAt = 0; soleAt < normalisedQuery.length; soleAt++) {
		// A class's mask bit is its bigram class less one.
		const b = classAt(soleAt) - 1;
		if (b < 0) continue;
		if (occurrences[b]++) {
			requiredLo[b] = -1;
			requiredHi[b] = -1;
			continue;
		}
		for (let at = 1; at < normalisedQuery.length; at++) {
			const before = classAt(at - 1);
			const unitClass = classAt(at);
			if (before === 0 || unitClass === 0 || at - 1 === soleAt || at === soleAt) continue;
			// Shift counts are taken mod 32, so one shift serves both halves.
			const bit = bigramBit(before, unitClass);
			if (bit < 32) requiredLo[b] |= 1 << bit;
			else requiredHi[b] |= 1 << bit;
		}
	}
	return { requiredLo, requiredHi };
};
