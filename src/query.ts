import { splitWords } from "./boundaries";
import { buildFuzzyGate, buildPresenceGate, charMask, type Gate, isExactMask } from "./gates";
import { normaliseText } from "./normalise";
import type { PreparedReading } from "./readings";
import type { CorrectionSubject } from "./rescue";

// Query-derived state, built once per query and reused across every field. The
// lazy fields share one protocol: undefined = not built yet, null = the query
// admits none. Declared required so every PreparedQuery keeps one object shape
// as the corrections fill them in.
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
	const queryWords = splitWords(normalisedQuery);
	// From the words alone: a separator outside ASCII would otherwise set a class
	// bit, and every field spelt with another separator would lack it.
	const queryMask = charMask(queryWords.join(""));
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

// A phrase's words may match out of order, which the subsequence gate would
// reject, so a phrase is gated on presence instead.
export const frontGate = ({ queryWords, presenceGate, fuzzyGate }: PreparedQuery): Gate | null =>
	queryWords.length > 1 ? presenceGate : fuzzyGate;
