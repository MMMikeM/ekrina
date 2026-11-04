import type { PreparedQuery } from "./match";
import type { Fuzzier, MatchResult } from "./types";

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
};

// What a Fuzzier is behind its opaque public type, kept out of the public
// surface so a strategy's internals can change without a major version.
// `competing` means the query already has matches, so only readings cheap
// enough to run beside them are prepared. A competing reading must match only
// fields the literal pass lets through (`buildFuzzyGate` for one word, every
// word character present for a phrase): the searcher then tries just those.
export type Strategy = {
	prepare: (prepared: PreparedQuery, competing: boolean) => PreparedStrategy | null;
};

export const strategyOf = (fuzzier: Fuzzier): Strategy => fuzzier as unknown as Strategy;
