/**
 * The tier ladder as named constants. Lower = better. Every genuine tier
 * scores at or below CONTAINS, and anything above it is a `fuzzy` chain or a
 * correction (see {@link TYPO_PENALTY}), so CONTAINS is the dividing line
 * between a literal match and a speculative one. Exported so callers can
 * filter or re-rank by tier.
 */
export const SCORES = {
	EXACT: 0,
	NORMALISED_EXACT: 0.1,
	PREFIX: 0.5,
	BOUNDARY_CASED: 0.9,
	BOUNDARY: 1,
	MULTI_WORD: 1.5,
	ACRONYM: 1.8,
	CONTAINS: 2,
} as const;

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
