/**
 * Ekrina: tiny, typed fuzzy matching. Inspired by @nozbe/microfuzz.
 *
 * Scoring is lower = better. On a field without `demoteBy`,
 * `score <= SCORES.CONTAINS` is the test for "the user's text actually appears
 * here"; above it is a fuzzy chain or a correction, and only `tier` tells
 * those apart.
 */

export { createSearcher, fuzzyMatch } from "./search";
export { splitWords } from "./boundaries";
export { normaliseText } from "./normalise";
export { SCORES, TYPO_PENALTY } from "./scores";
export type * from "./types";
