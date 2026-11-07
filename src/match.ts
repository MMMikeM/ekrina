import { splitWords, WORD_CHARS, wordChar } from "./boundaries";
import { fuzzyChainMatch } from "./fuzzy";
import { buildFuzzyGate, buildPresenceGate, charMask, type Gate, isExactMask } from "./gates";
import { normaliseText } from "./normalise";
import {
	isRescuableQuery,
	isShortQuery,
	preferBetter,
	missingCharRescue,
	type RescueContext,
	rescueField,
	type CorrectionSubject,
} from "./rescue";
import { ACRONYM_SCORE, BOUNDARY_SCORE, BOUNDARY_CASED_SCORE, CONTAINS_SCORE, EXACT_SCORE, MULTI_WORD_SCORE, NORMALISED_EXACT_SCORE, PREFIX_SCORE } from "./scores";
import type { PreparedReading } from "./readings";
import type { MatchResult, HighlightRange } from "./types";

// Query-derived state, built once per query and reused across every field. The
// lazy fields share one protocol: undefined = not built yet, null = the query
// admits none. Declared required so every PreparedQuery keeps one object shape
// as rescue.ts and readings.ts fill them in.
export type PreparedQuery = {
	query: string;
	normalisedQuery: string;
	queryWords: string[];
	wordsLongestFirst: string[];
	queryMask: number;
	presenceGate: Gate | null;
	fuzzyGate: Gate;
	rescueState: CorrectionSubject | undefined;
	lastCorrection: PreparedQuery | undefined;
	wordStarts: number[] | undefined;
	wordRescueStates: (CorrectionSubject | undefined)[] | undefined;
	// Indexed by whether the reading competes with matches as typed.
	readings: (PreparedReading | null | undefined)[] | undefined;
};

// The raw query is stored trimmed so the exact-case tiers treat padding as
// insignificant, matching the normalised tiers (normaliseText trims). The
// presence gate is skipped whenever the mask already proves exact char
// presence — for pure a–z queries the mask IS that check.
export const prepareQuery = (query: string, normalisedQuery: string): PreparedQuery => {
	const queryMask = charMask(normalisedQuery);
	const queryWords = splitWords(normalisedQuery);
	const needsPresenceGate = queryWords.length > 1 && !isExactMask(queryMask);
	return {
		query: query.trim(),
		normalisedQuery,
		queryWords,
		wordsLongestFirst: longestFirst(queryWords),
		queryMask,
		presenceGate: needsPresenceGate ? buildPresenceGate(normalisedQuery) : null,
		fuzzyGate: buildFuzzyGate(normalisedQuery),
		rescueState: undefined,
		lastCorrection: undefined,
		wordStarts: undefined,
		wordRescueStates: undefined,
		readings: undefined,
	};
};

// Every gate and correction is built from the query at more than linear cost in
// its length, so only its first 256 characters are matched (@see SECURITY.md).
const MAX_QUERY_LENGTH = 256;

const boundQuery = (query: string): string => {
	const text = query.trimStart();
	if (text.length <= MAX_QUERY_LENGTH) return text;
	const last = text.charCodeAt(MAX_QUERY_LENGTH - 1);
	// A high surrogate there would be cut from its pair.
	const splitsPair = last >= 0xd800 && last <= 0xdbff;
	return text.slice(0, splitsPair ? MAX_QUERY_LENGTH - 1 : MAX_QUERY_LENGTH);
};

// fuzzyMatch over a list prepares the same query once per row, and a
// PreparedQuery only ever caches what its query determines.
let lastQuery = "";
let lastPrepared: PreparedQuery | null = null;

// Null when the query holds nothing to match.
export const prepareBoundedQuery = (query: string): PreparedQuery | null => {
	if (query !== lastQuery) {
		lastQuery = query;
		const bounded = boundQuery(query);
		const normalisedQuery = normaliseText(bounded);
		lastPrepared = normalisedQuery.length ? prepareQuery(bounded, normalisedQuery) : null;
	}
	return lastPrepared;
};

// Repeats sort together so multiWordTier can resume each copy after the last.
const longestFirst = (words: string[]): string[] =>
	words.length > 1
		? [...words].sort((a, b) => b.length - a.length || Number(a > b) - Number(a < b))
		: words;


// Word-internal apostrophes don't end a run: "people's" is one word with
// initial "p", or "Lao People's Democratic Republic" could never match "lpdr".
const wordRun = new RegExp(`[${WORD_CHARS}]+(?:'[${WORD_CHARS}]+)*`, "gu");

const wordStartOccurrence = (haystack: string, needle: string, from = 0): number => {
	let at = haystack.indexOf(needle, from);
	while (at > -1) {
		if (at === 0 || !wordChar.test(haystack[at - 1])) return at;
		at = haystack.indexOf(needle, at + 1);
	}
	return -1;
};

const boundaryTier = (
	haystack: string,
	needle: string,
	tier: "boundary-cased" | "boundary",
): MatchResult | null => {
	const at = wordStartOccurrence(haystack, needle);
	if (at === -1) return null;
	const score = tier === "boundary-cased" ? BOUNDARY_CASED_SCORE : BOUNDARY_SCORE;
	return { score, tier, ranges: [[at, at + needle.length - 1]] };
};

// Each query word needs its own occurrence, so a repeated word must appear
// twice. Longest first, so a short word can't take the start a longer one needs;
// each copy of a repeated word resumes after the last, so a query of one word
// repeated walks the field once instead of once per copy.
const multiWordTier = (normalisedField: string, words: string[]): MatchResult | null => {
	const ranges: HighlightRange[] = [];
	const isTaken = (start: number, end: number): boolean =>
		ranges.some(([takenStart, takenEnd]) => start <= takenEnd && takenStart <= end);
	let from = 0;
	for (let i = 0; i < words.length; i++) {
		const word = words[i];
		if (word !== words[i - 1]) from = 0;
		let at = wordStartOccurrence(normalisedField, word, from);
		while (at > -1 && isTaken(at, at + word.length - 1)) {
			at = wordStartOccurrence(normalisedField, word, at + 1);
		}
		if (at === -1) return null;
		from = at + 1;
		ranges.push([at, at + word.length - 1]);
	}
	return { score: MULTI_WORD_SCORE, tier: "multi-word", ranges: ranges.sort((a, b) => a[0] - b[0]) };
};

const acronymTier = (normalisedField: string, normalisedQuery: string): MatchResult | null => {
	if (normalisedQuery.length < 2) return null;
	const wordStarts: number[] = [];
	let initials = "";
	for (const match of normalisedField.matchAll(wordRun)) {
		wordStarts.push(match.index);
		initials += match[0][0];
	}
	const at = initials.indexOf(normalisedQuery);
	if (at === -1) return null;
	return {
		score: ACRONYM_SCORE,
		tier: "acronym",
		ranges: wordStarts
			.slice(at, at + normalisedQuery.length)
			.map((wordStart) => [wordStart, wordStart] as HighlightRange),
	};
};

const containsTier = (normalisedField: string, normalisedQuery: string): MatchResult | null => {
	const at = normalisedField.indexOf(normalisedQuery);
	return at > -1
		? {
				score: CONTAINS_SCORE,
				tier: "contains",
				ranges: [[at, at + normalisedQuery.length - 1]],
			}
		: null;
};

const fuzzyOrRescue = (rescue: RescueContext, rescuable: boolean): MatchResult | null => {
	const { normalisedField, prepared } = rescue;
	// Single-word queries already passed fuzzyGate as the ladder's front gate;
	// only multi-word queries (presence-gated up front) still owe this test. A
	// phrase with a swapped keystroke fails it with every class present, so this
	// reject is a rescue site like the others.
	if (prepared.queryWords.length > 1 && !prepared.fuzzyGate.test(normalisedField)) {
		return rescuable ? rescueField(rescue) : null;
	}
	const chain = fuzzyChainMatch(normalisedField, prepared.normalisedQuery);
	if (chain) {
		if (!rescuable || isShortQuery(prepared.normalisedQuery, prepared.queryWords)) return chain;
		// A chain assembling is not evidence it is the best reading: the field may
		// literally contain the corrected word, so both rescues are still scored.
		const dropped = missingCharRescue(rescue, chain.ranges);
		return preferBetter(preferBetter(dropped, rescueField(rescue)), chain);
	}
	// The chain can refuse past the gate via its density floor.
	return rescuable ? rescueField(rescue) : null;
};

// The literal rungs in ladder order: exact → normalised-exact → prefix →
// boundary ×2 → multi-word → acronym → contains. Acronym (1.8) outranks
// contains (2), so it must be tried first — a field matching both ways must
// get the better tier, or cross-item ordering inverts. Initials never contain
// a separator, so a multi-word query can never acronym-match.
export const literalTiers = (
	field: string,
	normalisedField: string,
	prepared: PreparedQuery,
	acronym: boolean,
): MatchResult | null => {
	const { query, normalisedQuery, queryWords, wordsLongestFirst } = prepared;

	if (field === query) {
		return { score: EXACT_SCORE, tier: "exact", ranges: [[0, field.length - 1]] };
	}
	if (normalisedField === normalisedQuery) {
		return {
			score: NORMALISED_EXACT_SCORE,
			tier: "normalised-exact",
			ranges: [[0, normalisedField.length - 1]],
		};
	}
	if (normalisedField.startsWith(normalisedQuery)) {
		return { score: PREFIX_SCORE, tier: "prefix", ranges: [[0, normalisedQuery.length - 1]] };
	}
	const boundary =
		boundaryTier(field, query, "boundary-cased") ??
		boundaryTier(normalisedField, normalisedQuery, "boundary");
	if (boundary) return boundary;

	if (queryWords.length > 1) {
		const multi = multiWordTier(normalisedField, wordsLongestFirst);
		if (multi) return multi;
	}

	if (acronym && queryWords.length === 1) {
		const result = acronymTier(normalisedField, normalisedQuery);
		if (result) return result;
	}

	return containsTier(normalisedField, normalisedQuery);
};

export const matchField = (
	field: string,
	normalisedField: string,
	fieldMask: number,
	prepared: PreparedQuery,
	acronym: boolean,
	mayRescue: boolean,
	preGated?: boolean,
	literalOnly?: boolean,
): MatchResult | null => {
	const { normalisedQuery, queryWords } = prepared;

	// `n & (n - 1)` clears the lowest set bit, so it is zero iff at most one
	// class is absent — and only a substitution or a drop can account for
	// exactly one, so a genuinely missing class goes straight to the rescue.
	const rescuable = mayRescue && isRescuableQuery(normalisedQuery, queryWords);
	const missingClasses = prepared.queryMask & ~fieldMask;
	if (rescuable ? missingClasses & (missingClasses - 1) : missingClasses) return null;

	let rescue: RescueContext | null = null;
	const rescueContext = (): RescueContext =>
		(rescue ??= { rawField: field, normalisedField, fieldMask, prepared, acronymTier: acronym, missingClasses });

	if (missingClasses !== 0) return rescueField(rescueContext());

	// Multi-word queries must front-gate on the order-independent presence gate:
	// the multi-word tier matches words out of order, and the subsequence gate
	// would false-reject them. `preGated` means the searcher already ran this
	// exact gate on this exact string.
	const frontGate: Gate | null = preGated
		? null
		: queryWords.length > 1
			? prepared.presenceGate
			: prepared.fuzzyGate;
	if (frontGate && !frontGate.test(normalisedField)) {
		return rescuable ? rescueField(rescueContext()) : null;
	}

	const literal = literalTiers(field, normalisedField, prepared, acronym);
	// One character anywhere matches most of any list and ranks none of it, so it
	// counts only where it starts a word.
	if (normalisedQuery.length === 1) {
		return literal !== null && literal.score <= BOUNDARY_SCORE ? literal : null;
	}
	if (literal !== null || literalOnly) return literal;
	return fuzzyOrRescue(rescueContext(), rescuable);
};
