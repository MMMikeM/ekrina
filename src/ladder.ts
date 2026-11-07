import { WORD_CHARS, wordStartOccurrence } from "./boundaries";
import type { PreparedQuery } from "./query";
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
import type { MatchResult, HighlightRange, HighlightRanges } from "./types";

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

// Results are fresh per call, so their ranges can shift in place.
export const shiftRanges = (ranges: HighlightRanges, lead: number): void => {
	for (const range of ranges) {
		range[0] += lead;
		range[1] += lead;
	}
};
