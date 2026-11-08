import type { FieldBigrams, LetterBudget } from "./gates";
import type { PreparedQuery } from "./query";
import { readings } from "./readings";
import { earlyRescue, lateRescue } from "./rescue";
import type { MatchResult } from "./types";

// What the query already matched: nothing, only fuzzy chains and corrections, or
// literally. Beside other matches only stages cheap enough to run beside them
// are prepared.
export type Competition = "none" | "fuzzy" | "literal";

// An item's bigram set across its fields (see rawFieldScan), scanned on first read.
type ItemPairs = (item: number) => FieldBigrams;

export type PreparedStage = LetterBudget & {
	// Absent when it could reject nothing. `missing` is the `needed` classes the
	// item lacks, which the budget already admitted.
	admitsPairs: ((missing: number, item: number, pairsOf: ItemPairs) => boolean) | null;
	// The field's match after this stage, given the one it holds as typed or from
	// an earlier stage, in trimmed-field offsets. Never drops a held match.
	match: (
		field: string,
		normalisedField: string,
		held: MatchResult | null,
		fieldMask: number,
		acronym: boolean,
	) => MatchResult | null;
	// The stage may match fields the literal pass rejected, so every item is
	// tried rather than its survivors. One that is not `wholeList` must match
	// only fields the literal pass lets through (`buildFuzzyGate` for one word,
	// every word character present for a phrase): the searcher tries just those.
	wholeList: boolean;
	// Whether an item that matched literally in one field has its other fields
	// read too.
	besideLiteral: boolean;
};

export type Stage = {
	prepare: (prepared: PreparedQuery, competition: Competition) => PreparedStage | null;
};

// The rescue has a place on each side of the readings, and rescueTurn picks one
// per query.
export const stages: Stage[] = [earlyRescue, readings, lateRescue];
