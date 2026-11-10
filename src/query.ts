import { splitWords } from "./boundaries";
import { buildFuzzyGate, buildPresenceGate, charMask, type Gate, isExactMask } from "./gates";
import { normaliseText } from "./normalise";

// Query-derived state, built once per query and reused across every field.
export type PreparedQuery = {
	query: string;
	normalisedQuery: string;
	queryWords: string[];
	wordsLongestFirst: string[];
	queryMask: number;
	presenceGate: Gate | null;
	fuzzyGate: Gate;
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

// Repeats sort together so multiWordTier can resume each copy after the last:
// the sort by length is stable, so equal lengths keep the first sort's order.
const longestFirst = (words: string[]): string[] =>
	words.length > 1 ? [...words].sort().sort((a, b) => b.length - a.length) : words;

// A phrase's words may match out of order, which the subsequence gate would
// reject, so a phrase is gated on presence instead.
export const frontGate = ({ queryWords, presenceGate, fuzzyGate }: PreparedQuery): Gate | null =>
	queryWords.length > 1 ? presenceGate : fuzzyGate;

// Lazy state for the latest query, built on first use. A search uses one query
// throughout, and prepareBoundedQuery keeps only the latest, so one entry is
// all a cache needs.
export const perQuery = <T>(
	build: (prepared: PreparedQuery) => T,
): ((prepared: PreparedQuery) => T) => {
	let owner: PreparedQuery | null = null;
	let value = undefined as T;
	return (prepared) => {
		if (prepared !== owner) {
			value = build(prepared);
			owner = prepared;
		}
		return value;
	};
};
