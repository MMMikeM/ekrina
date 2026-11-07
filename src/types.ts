/**
 * Start and end indices into the caller's own string, both inclusive.
 */
export type HighlightRange = [number, number];

/**
 * The ranges of the caller's string that matched, to highlight.
 */
export type HighlightRanges = HighlightRange[];

/**
 * Which tier a match came from. Lower on this list is a weaker match. Every
 * genuine tier scores at or below `SCORES.CONTAINS`, and anything above it is a
 * fuzzy chain or a correction, which only the tier tells apart. So
 * `score <= SCORES.CONTAINS` is the test for "the user's text actually appears
 * here". A field with `demoteBy` has its scores shifted, so test its tier
 * instead.
 *
 * `corrected` names a fix the _query_ needed, not the field. That covers up to
 * two mistakes, a key held down, a stray or missing space, or a word typed
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
 * Lower score = better match.
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
	/** Added to this field's scores when results are ranked, so a higher value
	 *  demotes it (default: 0; a finite number of at least 0, or createSearcher
	 *  throws). With `demoteBy: SCORES.CONTAINS`, this field's best hit ranks level
	 *  with a contains match elsewhere. It never changes `tier`. */
	demoteBy?: number;
};

/**
 * One searchable field: a function that returns its string, or a spec when the
 * field needs options. Pass one alone, or several in an object that names them.
 */
export type Field<T = unknown> = FieldSpec<T> | ((item: T) => string | null);

/**
 * A ranked search result: one item, and how its best-matching text matched.
 * `score` ranks it, lower = better, and includes the field's `demoteBy`.
 * With named fields, `field` names the one that matched best and `fields` holds
 * every field that matched; a single-field search has neither.
 */
export type SearchResult<T, F extends string = never> = MatchResult & {
	item: T;
	/** The text `ranges` index into: the string the best field returned. */
	text: string;
} & ([F] extends [never]
		? unknown
		: {
				/** The named field that matched best. */
				field: F;
				/** Each named field that matched, by name; a field that didn't is absent. */
				fields: Partial<Record<F, FieldMatch>>;
			});

/**
 * How one named field matched, in the field's own text. Fuzzy and corrected
 * matches are included; `isLiteral` tells them apart.
 */
export type FieldMatch = {
	/** Which tier this field's match came from. */
	tier: Tier;
	/** The characters of `text` that matched, to highlight. */
	ranges: HighlightRanges;
	/** The text `ranges` index into: the string this field returned. */
	text: string;
	/** On a `corrected` match, the query as it was read, cased as `MatchResult.corrected` is. */
	corrected?: string;
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
export type Searcher<T, F extends string = never> = {
	/** @throws {RangeError} when `limit` is not a positive integer. */
	(query: string, options?: SearchOptions): SearchResult<T, F>[];
	/**
	 * Build the whole-list mask index now instead of on the first query that needs it.
	 * Every query that doesn't extend the previous one then filters on the index
	 * instead of scanning each item's text; results are unchanged.
	 * Calling it again does nothing.
	 */
	buildIndex: () => void;
};

/**
 * The result type of whatever produces search results: a searcher, a factory
 * that builds one, or a function that returns results. For a factory over
 * `{ title, keywords }` fields, its `field` is `"title" | "keywords"`.
 */
export type SearchResultOf<S> = S extends (...args: never[]) => infer R
	? R extends readonly (infer Result)[]
		? Result
		: SearchResultOf<R>
	: never;
