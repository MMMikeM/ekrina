import { classCounts } from "./gates";
import type { PreparedQuery } from "./query";

// Below this a correction describes the field rather than the query: almost
// every field offers a window one character away from a 3-character string.
export const MIN_RESCUE_QUERY_LENGTH = 4;
// Enumerating a word's corrections costs time and memory quadratic in its
// length, and no real typo needs one this long, so a query holding a longer
// word is never corrected.
export const MAX_RESCUE_WORD_LENGTH = 64;

// Chance corrections are a multiple-comparisons problem scaling with the
// field's window count, while a high floor hurts the short queries that
// dominate label search (@see docs/performance.md).
export const minTypoQueryLength = (fieldLength: number): number =>
	fieldLength <= 64 ? 5 : fieldLength <= 1024 ? 6 : 7;

// A substitution keeps the subject's length where a drop shortens it to three
// characters, so on a label it is trusted one character sooner.
export const minSubstitutionLength = (fieldLength: number): number =>
	fieldLength <= 64 ? MIN_RESCUE_QUERY_LENGTH : minTypoQueryLength(fieldLength);

// Below this a subject is short: it is corrected only at a word start, and only
// when nothing matches the query as typed. Drops wait for it too.
export const MIN_TYPO_QUERY_LENGTH: number = minTypoQueryLength(0);

const reachesFloor = (normalisedQuery: string, queryWords: string[], floor: number): boolean =>
	queryWords.length === 1
		? normalisedQuery.length >= floor
		: queryWords.some((word) => word.length >= floor);

// Whether any rescue may run, and so whether the mask gate may relax to one
// missing class. Both entry points ask it through rescueTurn, so neither
// corrects what the other cannot.
export const isRescuableQuery = (normalisedQuery: string, queryWords: string[]): boolean =>
	reachesFloor(normalisedQuery, queryWords, MIN_RESCUE_QUERY_LENGTH) &&
	queryWords.every((word) => word.length <= MAX_RESCUE_WORD_LENGTH);

// Built lazily: every correction prepares a query too, and none is rescued.
export const rescueCounts = (prepared: PreparedQuery): Int32Array =>
	(prepared.rescueCounts ??= classCounts(prepared.queryWords.join("")));

// A short query's correction stands in for a missing match and never competes
// with one: finding it means testing every item that holds the query's
// letters, which the searcher does only when nothing matched as typed
// (@see docs/performance.md).
export const isShortQuery = (normalisedQuery: string, queryWords: string[]): boolean =>
	!reachesFloor(normalisedQuery, queryWords, MIN_TYPO_QUERY_LENGTH);

// A query of five or more letters is rescued beside its matches as typed,
// before the readings; a shorter one only once nothing else matched, since a
// swap or a sparse word is likelier what was meant ("tahn" is "than", not "taha").
export type RescueTurn = "first" | "last" | null;

export const rescueTurn = (normalisedQuery: string, queryWords: string[]): RescueTurn =>
	!isRescuableQuery(normalisedQuery, queryWords)
		? null
		: isShortQuery(normalisedQuery, queryWords)
			? "last"
			: "first";

export type Edit = (text: string, at: number) => string;

export const swapAdjacentAt: Edit = (text, at) =>
	text.slice(0, at) + text[at + 1] + text[at] + text.slice(at + 2);

export const dropCharAt: Edit = (text, at) => text.slice(0, at) + text.slice(at + 1);

// Needs normaliseText's 1:1 mapping to index the raw query by normalised
// offsets; when NFC shortened decomposed input, the normalised query stands in
// for it — sound, just case-blind.
export const rawQuery = ({ query, normalisedQuery }: PreparedQuery): string =>
	query.length === normalisedQuery.length ? query : normalisedQuery;

export const wordStartsOf = (prepared: PreparedQuery): number[] => {
	let starts = prepared.wordStarts;
	if (starts === undefined) {
		starts = [];
		let from = 0;
		for (const word of prepared.queryWords) {
			const wordAt = prepared.normalisedQuery.indexOf(word, from);
			starts.push(wordAt);
			from = wordAt + word.length;
		}
		prepared.wordStarts = starts;
	}
	return starts;
};

export const rawWordOf = (prepared: PreparedQuery, wordIndex: number): string => {
	const wordStart = wordStartsOf(prepared)[wordIndex];
	return rawQuery(prepared).slice(wordStart, wordStart + prepared.queryWords[wordIndex].length);
};

// Optimal string alignment distance: insertions, deletions, substitutions and
// adjacent swaps, each one edit. Capped at `limit + 1`. A shared first
// character is always matched: no cheaper alignment edits it.
const editDistance = (a: string, b: string, limit: number, i = 0, j = 0): number => {
	while (i < a.length && j < b.length && a[i] === b[j]) {
		i++;
		j++;
	}
	if (i === a.length || j === b.length) {
		return Math.min(Math.max(a.length - i, b.length - j), limit + 1);
	}
	if (limit === 0) return 1;
	let fewest = Math.min(
		editDistance(a, b, limit - 1, i + 1, j + 1),
		editDistance(a, b, limit - 1, i + 1, j),
		editDistance(a, b, limit - 1, i, j + 1),
	);
	if (a[i] === b[j + 1] && a[i + 1] === b[j]) {
		fewest = Math.min(fewest, editDistance(a, b, limit - 1, i + 2, j + 2));
	}
	return fewest + 1;
};

// Each edit changes the length by at most one.
const lengthsWithin = (a: number, b: number, limit: number): boolean => Math.abs(a - b) <= limit;

export const withinEdits = (a: string, b: string, limit: number): number =>
	lengthsWithin(a.length, b.length, limit) ? editDistance(a, b, limit) : limit + 1;
