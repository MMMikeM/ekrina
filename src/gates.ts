import { WORD_CHARS, wordChar } from "./boundaries";
import { bigramBit, bigramClass, unitMask } from "./normalise";
import { unfoldTable } from "./unfold";

// Inside a character class only these four are special.
const escapeCharClass = (text: string): string => text.replace(/[\^\]\\-]/g, "\\$&");

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
	const step = (position: GatePosition): string => `[^${position.gapBody}]*${position.matcher}`;
	const matchers = positions.map((position) => position.matcher);
	const steps = positions.map(step);
	const regex = new RegExp(
		`(?:(?<![${WORD_CHARS}])${matchers[0]}${steps.slice(1).join("")}|${matchers.slice(0, 3).join("")}${steps.slice(3).join("")})`,
		"u",
	);
	const accepted = positions.map((position) => position.accepts);
	return {
		test: (text) =>
			text.length > LINEAR_SCAN_ABOVE ? holdsInOrder(text, accepted) : regex.test(text),
	};
};

// Each query position as the class of code units that may stand at it. A
// decomposed accent sits between letters in raw text but not after
// normaliseText strips it, so the run steps over the same range it strips.
const classGate = (classes: string[], combining: string): Gate =>
	subsequenceGate(
		classes.map((accepts) => {
			const gapBody = escapeCharClass(accepts);
			return { matcher: `[${gapBody}]${combining}`, gapBody, accepts };
		}),
	);

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
export const buildFuzzyGate = (normalisedQuery: string): Gate => classGate([...normalisedQuery], "");

/**
 * `buildFuzzyGate` for text nothing has normalised yet: each character becomes
 * the class of code points that fold to it, so the gate runs against the
 * caller's own strings before any prepared copy of the corpus exists.
 * Null when the query holds a character the unfold table doesn't cover —
 * non-Latin scripts, mostly — and the caller takes the mask path instead:
 * slower, never wrong. No `i` flag: the classes already carry both cases.
 */
export const buildRawGate = (normalisedQuery: string): Gate | null => {
	const unfold = unfoldTable();
	const classes: string[] = [];
	for (const char of normalisedQuery) {
		const sources = unfold[char];
		if (sources === undefined) return null;
		classes.push(sources);
	}
	return classGate(classes, "[\\u0300-\\u036f]*");
};

/**
 * `buildRawGate` for a one-character query, which matches only where it starts
 * a word. Null when the unfold table doesn't cover the character.
 */
export const buildWordStartRawGate = (normalisedQuery: string): RegExp | null => {
	const sources = unfoldTable()[normalisedQuery];
	return sources === undefined
		? null
		: new RegExp(`(?<![${WORD_CHARS}])[${escapeCharClass(sources)}]`, "u");
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
		if (seen.has(char) || !wordChar.test(char)) continue;
		seen.add(char);
		src += `(?=[^]*[${escapeCharClass(char)}])`;
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
