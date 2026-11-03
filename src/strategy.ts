import type { PreparedQuery } from "./match";
import type { Fuzzier, MatchResult } from "./types";

// What one query admits under a strategy, prepared once and tried against
// fields that matched nothing else.
export type PreparedStrategy = {
	// Both may only false-pass: a field either rejects must have no match.
	// `admitsText` reads the caller's own string, before normalisation. `match`
	// is only called on a field both admit.
	admitsMask: (fieldMask: number) => boolean;
	admitsText: (text: string) => boolean;
	match: (field: string, normalisedField: string) => MatchResult | null;
};

// What a Fuzzier is behind its opaque public type, kept out of the public
// surface so a strategy's internals can change without a major version.
// `competing` means the query already has matches, so only readings cheap
// enough to run beside them are prepared. A competing reading of a one-word
// query must match only fields `buildFuzzyGate` admits: the searcher then
// tries just the fields its literal pass let through.
export type Strategy = {
	prepare: (prepared: PreparedQuery, competing: boolean) => PreparedStrategy | null;
};

export const strategyOf = (fuzzier: Fuzzier): Strategy => fuzzier as unknown as Strategy;
