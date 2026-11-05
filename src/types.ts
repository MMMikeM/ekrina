/**
 * Start and end indices into the caller's own string, both inclusive.
 */
export type Range = [number, number];

/**
 * The ranges of the caller's string that matched, to highlight.
 */
export type HighlightRanges = Range[];

/**
 * Which tier a match came from. Lower on this list is a weaker match. Every
 * genuine tier scores at or below `SCORES.CONTAINS`, and anything above it is a
 * fuzzy chain or a correction, which only the tier tells apart. So
 * `score <= SCORES.CONTAINS` is the test for "the user's text actually appears
 * here", and filtering to it is how you opt out of guessing. A field with
 * `demoteBy` has its scores shifted, so test its tier instead.
 *
 * `corrected` names a fix the *query* needed, not the field: up to two
 * mistakes, a key held down, a stray or missing space, or a word typed
 * sparsely. `MatchResult.corrected` carries the fixed query.
 */
export type Tier =
	| "exact"
	| "normalised-exact"
	| "prefix"
	| "boundary-cased"
	| "boundary"
	| "multi-word"
	| "acronym"
	| "contains"
	| "fuzzy"
	| "corrected";

/**
 * The result of matching one string against a query.
 * Lower score = better match (think "error level").
 */
export type MatchResult = {
	score: number;
	tier: Tier;
	/** The query with its mistyped characters fixed. Present only when `tier`
	 *  is `"corrected"`. A single mistyped character fixed keeps the caller's
	 *  own casing; a word read any other way is spelt as the field spells it. */
	corrected?: string;
	ranges: HighlightRanges;
};

/**
 * Options for the fuzzyMatch primitive.
 */
export type MatchOptions = {
	/** Enable the acronym (word-initials) tier (default: false). */
	acronym?: boolean;
};

/**
 * One searchable field of an item, with its matching configuration.
 */
export type FieldSpec<T = unknown> = {
	/** Returns this field's string for an item; null skips the field for that item. */
	selectField: (item: T) => string | null;
	/** Enable the acronym tier for this field (default: false). */
	acronym?: boolean;
	/** Added to every score this field produces, those in `fields` included, so
	 *  a higher value demotes it (default: 0, keep >= 0). With
	 *  `demoteBy: SCORES.CONTAINS`, this field's best hit ranks level with a
	 *  contains match elsewhere. The shift never changes `tier`, so filter a
	 *  demoted field by tier rather than by score. */
	demoteBy?: number;
};

/**
 * A ranked search result for one collection item.
 */
export type FuzzyResult<T> = {
	item: T;
	/** Best (minimum) effective score across the item's fields. */
	score: number;
	/** Per-field match, null where that field didn't match. */
	fields: (MatchResult | null)[];
};

/**
 * Options for one search.
 */
export type SearchOptions = {
	/** Return at most this many results, best first (a positive integer). Once
	 *  that many items match the query as typed, the fuzzy and corrected matches
	 *  that could not outrank them are never computed. */
	limit?: number;
};

/**
 * A prepared fuzzy search function.
 */
export type FuzzySearcher<T> = {
	/** @throws {RangeError} when `limit` is not a positive integer. */
	(query: string, options?: SearchOptions): FuzzyResult<T>[];
	/**
	 * Build the whole-list mask index now instead of on the first query that needs it.
	 * Every query that doesn't extend the previous one then filters on the index
	 * instead of scanning each item's text; results are unchanged.
	 * Calling it again does nothing.
	 */
	buildIndex: () => void;
};
