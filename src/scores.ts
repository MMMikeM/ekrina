import type { Tier } from "./types";

/**
 * The tier ladder as named constants. Lower = better. Every genuine tier
 * scores at or below CONTAINS, and anything above it is a `fuzzy` chain or a
 * correction (see {@link TYPO_PENALTY}), so CONTAINS is the dividing line
 * between a literal match and a speculative one. Exported so callers can
 * filter or re-rank by tier.
 */
export const SCORES: {
	readonly EXACT: 0;
	readonly NORMALISED_EXACT: 0.1;
	readonly PREFIX: 0.5;
	readonly BOUNDARY_CASED: 0.9;
	readonly BOUNDARY: 1;
	readonly MULTI_WORD: 1.5;
	readonly ACRONYM: 1.8;
	readonly CONTAINS: 2;
} = {
	EXACT: 0,
	NORMALISED_EXACT: 0.1,
	PREFIX: 0.5,
	BOUNDARY_CASED: 0.9,
	BOUNDARY: 1,
	MULTI_WORD: 1.5,
	ACRONYM: 1.8,
	CONTAINS: 2,
};

// Each value on its own as well, for the library's internal use: the minifier
// inlines a constant but not an object property. Written as literals in SCORES
// too, since a constant SCORES also reads is never inlined; the types keep the
// two equal.
export const EXACT_SCORE: typeof SCORES.EXACT = 0;
export const NORMALISED_EXACT_SCORE: typeof SCORES.NORMALISED_EXACT = 0.1;
export const PREFIX_SCORE: typeof SCORES.PREFIX = 0.5;
export const BOUNDARY_CASED_SCORE: typeof SCORES.BOUNDARY_CASED = 0.9;
export const BOUNDARY_SCORE: typeof SCORES.BOUNDARY = 1;
export const MULTI_WORD_SCORE: typeof SCORES.MULTI_WORD = 1.5;
export const ACRONYM_SCORE: typeof SCORES.ACRONYM = 1.8;
export const CONTAINS_SCORE: typeof SCORES.CONTAINS = 2;

/**
 * Added to a corrected match's score once per typo fixed (tier `"corrected"`):
 * 2.1 for one typo, 4.2 for two.
 *
 * Sized so even a corrected exact hit, 0 + 2.1, sorts below the weakest
 * genuine tier, `SCORES.CONTAINS` (2). A correction is a guess about what the
 * user meant and a substring match is something they actually typed, so the
 * literal hit wins every time. Below 2 that inverts, and MRR measurably drops
 * (the CHANGELOG's 1.0.0 section records the measurement).
 *
 * Corrected scores therefore land at 2.1 and up, overlapping the fuzzy band,
 * and a word typed sparsely, which fixes no typo, scores just above CONTAINS.
 * Only `tier` tells them apart. Every kind of edit takes the same penalty,
 * because they are the same edit distance. Scoring them differently would
 * rank a swapped keystroke above a dropped one on no evidence.
 */
export const TYPO_PENALTY = 2.1;

/**
 * Whether a match is of the query as typed: any tier but `fuzzy` and
 * `corrected`. Works on `fuzzyMatch` results and search results alike, demoted
 * fields included.
 */
export const isLiteral = (match: { tier: Tier }): boolean =>
	match.tier !== "fuzzy" && match.tier !== "corrected";
