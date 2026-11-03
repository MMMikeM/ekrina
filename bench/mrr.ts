import type { FamilyRow, ScorecardRow } from "./artifact.ts";
import type { Config } from "./configs.ts";
import type { SampledQuery } from "./corpus.ts";

// Reversing the list reverses the order inside each tie that list order breaks
// and leaves every other pair alone, so the source's tie is the run around it
// that the reversed ranking returns exactly backwards.
// Identical strings are always tied, and the corpus repeats a few items.
export const tieAround = (ranked: string[], reversed: string[], rank: number): [number, number] => {
	const reversedAt = new Map<string, number[]>();
	for (const [at, item] of reversed.entries()) reversedAt.set(item, [...(reversedAt.get(item) ?? []), at]);
	const flipsWithNext = (at: number): boolean => {
		if (ranked[at] === ranked[at + 1]) return true;
		const next = reversedAt.get(ranked[at + 1]) ?? [];
		return (reversedAt.get(ranked[at]) ?? []).some((here) => next.includes(here - 1));
	};
	let from = rank - 1;
	let to = rank - 1;
	while (from > 0 && flipsWithNext(from - 1)) from--;
	while (to + 1 < ranked.length && flipsWithNext(to)) to++;
	return [from + 1, to + 1];
};

// MRR@10: a rank outside the top 10 is as invisible to a picker as a miss —
// both score 0. With `relevant` of a tie's `size` items relevant and list
// order alone arranging them, this is the expected reciprocal rank of the
// first relevant one.
const expectedReciprocalRank = (from: number, size: number, relevant: number): number => {
	let allIrrelevantSoFar = 1;
	let expected = 0;
	for (let offset = 0; offset <= size - relevant; offset++) {
		const firstHere = (allIrrelevantSoFar * relevant) / (size - offset);
		if (from + offset <= 10) expected += firstHere / (from + offset);
		allIrrelevantSoFar *= (size - relevant - offset) / (size - offset);
	}
	return expected;
};

const firstRelevantRR = (
	ranked: string[] | null,
	reversed: string[] | null,
	relevant: (item: string) => boolean,
): number => {
	const at = ranked?.findIndex(relevant) ?? -1;
	if (!ranked || at < 0) return 0;
	const [from, to] = reversed ? tieAround(ranked, reversed, at + 1) : [at + 1, at + 1];
	const relevantInTie = ranked.slice(from - 1, to).filter(relevant).length;
	return expectedReciprocalRank(from, to - from + 1, relevantInTie);
};

const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[xs.length >> 1] ?? 0;
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/** MRR@10 and median result count per family, for configs built over a list and its reverse. */
export const scoreFamilies = (
	samples: SampledQuery[],
	all: Config[],
	reversedAll: Config[],
): FamilyRow[] => {
	const families: FamilyRow[] = [];
	for (const kind of new Set(samples.map((sample) => sample.kind))) {
		const ofKind = samples.filter((sample) => sample.kind === kind);
		const scored = ofKind[0].relevant !== null;
		const queries = ofKind.map((sample) => sample.query);
		const row: FamilyRow = { kind, scored, queries, mrr: {}, medianRows: {} };
		for (const [at, config] of all.entries()) {
			const rrs: number[] = [];
			const rows: number[] = [];
			for (const { query, relevant } of ofKind) {
				const probe = config.probe(query);
				rows.push(probe.count);
				if (!relevant) continue;
				const reversed = reversedAll[at].probe(query).ranked;
				rrs.push(firstRelevantRR(probe.ranked, reversed, relevant));
			}
			if (scored) row.mrr[config.name] = Number(mean(rrs).toFixed(3));
			row.medianRows[config.name] = median(rows);
		}
		families.push(row);
	}
	return families;
};

/** Each config's mean MRR over the scored families, best first. */
export const scorecardOf = (families: FamilyRow[], all: Config[]): ScorecardRow[] => {
	const scoredFamilies = families.filter((family) => family.scored);
	return all
		.map(({ name: library }) => ({
			library,
			mrr: Number(mean(scoredFamilies.map((family) => family.mrr[library])).toFixed(2)),
		}))
		.sort((a, b) => b.mrr - a.mrr);
};
