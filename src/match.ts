import { splitWords, WORD_CHARS, wordStartOccurrence } from "./boundaries";
import { fuzzyChainMatch } from "./fuzzy";
import {
	buildFuzzyGate,
	buildPresenceGate,
	charMask,
	type Gate,
	isExactMask,
	lacksAtMostOneClass,
} from "./gates";
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
import {
	ACRONYM_SCORE,
	BOUNDARY_SCORE,
	BOUNDARY_CASED_SCORE,
	CONTAINS_SCORE,
	EXACT_SCORE,
	MULTI_WORD_SCORE,
	NORMALISED_EXACT_SCORE,
	PREFIX_SCORE,
} from "./scores";
import type { PreparedReading } from "./readings";
import type { MatchResult, HighlightRange, HighlightRanges } from "./types";

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

// Trimmed, so the exact-case tiers ignore padding as the normalised ones do.
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
		const bounded = boundQuery(query);
		const normalisedQuery = normaliseText(bounded);
		lastPrepared = normalisedQuery.length ? prepareQuery(bounded, normalisedQuery) : null;
		lastQuery = query;
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

// A repeated word must appear twice. Longest first, so a short word can't take
// the start a longer one needs.
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
	return {
		score: MULTI_WORD_SCORE,
		tier: "multi-word",
		ranges: ranges.sort((a, b) => a[0] - b[0]),
	};
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
	// A phrase was front-gated on presence, so it still owes the fuzzy gate.
	const chain =
		prepared.queryWords.length > 1 && !prepared.fuzzyGate.test(normalisedField)
			? null
			: fuzzyChainMatch(normalisedField, prepared.normalisedQuery);
	if (chain === null) return rescuable ? rescueField(rescue) : null;
	if (!rescuable || isShortQuery(prepared.normalisedQuery, prepared.queryWords)) return chain;
	// The field may literally contain the corrected word, so both rescues are
	// still scored beside the chain.
	const dropped = missingCharRescue(rescue, chain.ranges);
	return preferBetter(preferBetter(dropped, rescueField(rescue)), chain);
};

// In ladder order. Acronym is tried before contains so a field matching both
// ways gets the better tier.
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

// A phrase's words may match out of order, which the subsequence gate would
// reject, so a phrase is gated on presence instead.
export const frontGate = ({ queryWords, presenceGate, fuzzyGate }: PreparedQuery): Gate | null =>
	queryWords.length > 1 ? presenceGate : fuzzyGate;

// Results are fresh per call, so their ranges can shift in place.
export const shiftRanges = (ranges: HighlightRanges, lead: number): void => {
	for (const range of ranges) {
		range[0] += lead;
		range[1] += lead;
	}
};

// `preGated` means the caller already ran the front gate on this string.
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

	const rescuable = mayRescue && isRescuableQuery(normalisedQuery, queryWords);
	const missingClasses = prepared.queryMask & ~fieldMask;
	if (rescuable ? !lacksAtMostOneClass(missingClasses) : missingClasses) return null;

	const rescueContext = (): RescueContext => ({
		rawField: field,
		normalisedField,
		prepared,
		acronymTier: acronym,
		missingClasses,
	});

	if (missingClasses !== 0) return rescueField(rescueContext());

	const gate = preGated ? null : frontGate(prepared);
	if (gate && !gate.test(normalisedField)) {
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
