import type { PreparedQuery } from "./match";
import type { MatchResult, TypoStrategy } from "./types";

// The corrections one query admits, prepared once and tried against fields that
// matched nothing else.
export type TypoCorrection = {
	// May only false-pass: a field it rejects must have no correction.
	admits: (fieldMask: number) => boolean;
	correct: (field: string, normalisedField: string, fieldMask: number) => MatchResult | null;
};

// What a TypoStrategy is behind its opaque public type. Kept out of the public
// surface so a strategy's internals can change without a major version.
export type TypoCorrector = { prepare: (prepared: PreparedQuery) => TypoCorrection | null };

export const correctorOf = (strategy: TypoStrategy): TypoCorrector =>
	strategy as unknown as TypoCorrector;
