import type { PreparedQuery } from "./match";
import type { MatchResult } from "./types";

// What one query admits under a strategy, prepared once and tried against
// fields that matched nothing else.
export type PreparedStrategy = {
	// All three may only false-pass: a field any rejects must have no match.
	// `admitsText` reads the caller's own string, before normalisation;
	// `admitsPairs`, absent when it could reject nothing, reads an item's bigram
	// set (see rawFieldScan) when the searcher has one. `match` is only called
	// on a field they admit.
	admitsMask: (fieldMask: number) => boolean;
	admitsText: (text: string) => boolean;
	admitsPairs: ((bigramsLo: number, bigramsHi: number) => boolean) | null;
	match: (field: string, normalisedField: string) => MatchResult | null;
	// The reading may match fields the literal pass rejected, so every item is
	// tried rather than its survivors.
	wholeList: boolean;
};

// What the query already matched: nothing, only fuzzy chains, or literally.
export type Competition = "none" | "fuzzy" | "literal";

// Beside other matches only readings cheap enough to run beside them are
// prepared. A reading that is not `wholeList` must match only fields the
// literal pass lets through (`buildFuzzyGate` for one word, every word
// character present for a phrase): the searcher then tries just those.
export type Strategy = {
	prepare: (prepared: PreparedQuery, competition: Competition) => PreparedStrategy | null;
};

