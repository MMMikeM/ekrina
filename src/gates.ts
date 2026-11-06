import { WORD_CHARS, wordChar } from "./boundaries";
import { unitMask } from "./normalise";

export const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Inside a character class only these four are special, and `-` needs escaping
// there while `escapeRegex` leaves it alone.

// One query position in the subsequence gate: `matcher` matches the position,
// `gapBody` is the char-class body excluded from the gap before it, and
// `accepts` lists the code units that can stand at it.
type GatePosition = { matcher: string; gapBody: string; accepts: string };

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

// One native test for "this field can hold the query as an admissible
// subsequence": the query's positions in order with anything between, anchored
// where the chunk assembler would actually start — a word boundary, or the
// first three positions run consecutively. `[^x]*x` leaves each attempt
// exactly one place to stop per step, so it cannot backtrack (same survivors,
// 16%/8% less gate time on ascii/mixed). The lookbehind beats a consuming
// `(?:^|non-word)`: same survivors, ~11% less scan time.
const subsequenceGate = (positions: GatePosition[]): Gate => {
	const gap = (i: number): string => `[^${positions[i].gapBody}]*`;
	const subsequenceFrom = (i: number): string => {
		let out = positions[i].matcher;
		for (let k = i + 1; k < positions.length; k++) out += `${gap(k)}${positions[k].matcher}`;
		return out;
	};
	const runLength = Math.min(3, positions.length);
	const run = positions
		.slice(0, runLength)
		.map((position) => position.matcher)
		.join("");
	const afterRun =
		runLength < positions.length ? `${gap(runLength)}${subsequenceFrom(runLength)}` : "";
	const regex = new RegExp(`(?:(?<![${WORD_CHARS}])${subsequenceFrom(0)}|${run}${afterRun})`, "u");
	const accepted = positions.map((position) => position.accepts);
	return {
		test: (text) =>
			text.length > LINEAR_SCAN_ABOVE ? holdsInOrder(text, accepted) : regex.test(text),
	};
};

/**
 * The fuzzy tier's pre-gate, and for single-word queries the whole ladder's:
 * every earlier tier implies an admissible subsequence too. Requiring the
 * anchor cannot false-reject: a field with no admissible first placement has
 * no chain to assemble.
 *
 * Monotone under query extension, which is what lets the survivor cache in
 * search.ts reuse the previous keystroke's survivors: extending the query
 * lengthens the subsequence and never changes the first three characters, so
 * the gate only ever admits fewer fields.
 */
export const buildFuzzyGate = (normalisedQuery: string): Gate =>
	subsequenceGate(
		[...normalisedQuery].map((point) => ({
			matcher: escapeRegex(point),
			// Escaped for a character class rather than a pattern.
			gapBody: point.replace(/[\^\]\\-]/g, "\\$&"),
			accepts: point,
		})),
	);


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
		if (seen.has(char) || !wordChar.test(char)) continue;
		seen.add(char);
		src += `(?=[^]*${escapeRegex(char)})`;
	}
	return new RegExp(src);
};
