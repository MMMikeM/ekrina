/**
 * Match-count + rank validity: the process-cold runner (bench/run.ts) times
 * work but never checks the work produced results. Every representative query
 * knows the corpus item it was derived from (corpus.ts `source`), so this runs
 * every benched configuration once per corpus and query and records how many
 * items matched and where the source ranked.
 *
 * MRR@10 comes from the sampled queries instead (corpus.ts `samples`): each is
 * scored by its first relevant result, so any item a person could have meant
 * counts. A second pass over the reversed list finds the ties list order
 * breaks, and a tie mixing relevant and irrelevant items scores its expected
 * first-relevant rank. Ranks are deterministic, so one untimed pass is the
 * whole measurement.
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import {
	type FamilyRow,
	type ProbeTable,
	type ScorecardRow,
	ensureRawDir,
	rawFile,
} from "./artifact.ts";
import { type Probe, configByName, configs } from "./configs.ts";
import { CORPORA } from "./corpus";

const SIZE = 10_000;

type Outcome = { count: number; rank: number | null };

const outcome = ({ count, ranked }: Probe, source: string | null): Outcome => ({
	count,
	rank: source == null || ranked == null ? null : ranked.indexOf(source) + 1 || null,
});

// Reversing the list reverses the order inside each tie that list order breaks
// and leaves every other pair alone, so the source's tie is the run around it
// that the reversed ranking returns exactly backwards.
// Identical strings are always tied, and the corpus repeats a few items.
const tieAround = (ranked: string[], reversed: string[], rank: number): [number, number] => {
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

const runOut: Record<
	string,
	{ scorecard: ScorecardRow[]; tables: ProbeTable[]; families: FamilyRow[] }
> = {};

describe("bench validity: per-library match counts and source rank", () => {
	for (const { name, build, specs, samples } of CORPORA) {
		it(`[${name}] every library matches the plain-word query`, { timeout: 120_000 }, () => {
			const list = build(SIZE);
			const all = configs(list);
			const reversedAll = configs([...list].reverse());

			const tables: ProbeTable[] = [];
			for (const { query, kind, source } of specs) {
				const cells: ProbeTable["cells"] = {};
				for (const [at, config] of all.entries()) {
					const probe = config.probe(query);
					const { count, rank } = outcome(probe, source);
					const reversed = reversedAll[at].probe(query).ranked;
					const tie =
						rank && probe.ranked && reversed ? tieAround(probe.ranked, reversed, rank) : null;
					const tiedRanks = tie && tie[1] > tie[0] ? tie : undefined;
					cells[config.name] = tiedRanks ? { count, rank, tiedRanks } : { count, rank };
				}
				tables.push({ kind, query, source, cells });
			}

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
			const scoredFamilies = families.filter((family) => family.scored);
			const scorecard = all
				.map(({ name: library }) => ({
					library,
					mrr: Number(mean(scoredFamilies.map((family) => family.mrr[library])).toFixed(2)),
				}))
				.sort((a, b) => b.mrr - a.mrr);
			console.table(scorecard);

			// Same-process accumulation: the later corpus rewrites the file with
			// both entries.
			runOut[name] = { scorecard, tables, families };
			ensureRawDir();
			writeFileSync(rawFile("hits.json"), JSON.stringify(runOut, null, "\t"));

			const countFor = (lib: string, query: string, source: string | null): number =>
				outcome(configByName(all, lib).probe(query), source).count;

			// Every benched lib must find something for a plain corpus word —
			// otherwise its cold numbers time a no-op.
			const plainWord = specs[0];
			for (const config of all) {
				expect(
					countFor(config.name, plainWord.query, plainWord.source),
					`${config.name} found nothing for "${plainWord.query}"`,
				).toBeGreaterThan(0);
			}

			const ekrina = configByName(all, "ekrina");
			for (const { query, kind, source } of specs) {
				const { count, rank } = outcome(ekrina.probe(query), source);
				if (kind === "miss") {
					expect(count, `ekrina matched garbage "${query}"`).toBe(0);
				} else if (kind === "two-words-double-typo") {
					// Two edits in one phrase: the one-edit rescue must refuse
					// rather than guess. The edit-distance engines may match it;
					// ekrina returning anything here means the multi-word rescue
					// invented a correction.
					expect(count, `ekrina guessed at the double typo "${query}"`).toBe(0);
				} else if (kind === "two-words-extra") {
					// Every query word must match; an OR engine may return the item.
					expect(count, `ekrina matched a phrase missing "${query}"`).toBe(0);
				} else if (kind !== "short-word-typo" && !kind.startsWith("scatter")) {
					// ekrina must surface the item each query was derived from.
					// (The scatter kinds are exempt — those probe where chunk
					// assembly legitimately gives up, and that limit is the
					// measurement. Every typo kind, phrases included, is held to
					// the same bar as everything else.)
					expect(rank, `ekrina lost source of "${query}" (${kind})`).not.toBeNull();
				}
			}

			// Folding configs must find at least as much as their non-folding
			// base on the accent probe (quantifies the README's †).
			const accentProbe = specs.find((s) => s.kind === "accent-stripped");
			if (accentProbe) {
				const { query, source } = accentProbe;
				expect(countFor("ekrina", query, source)).toBeGreaterThan(0);
				// Cross-library pairs only exist on a full run; `--only=` narrows the
				// set, and a comparison against an absent row would assert nothing.
				const present = new Set(all.map((c) => c.name));
				for (const lib of ["uFuzzy", "fuse.js"]) {
					if (!present.has(lib) || !present.has(`${lib} (all opts)`)) continue;
					expect(
						countFor(`${lib} (all opts)`, query, source),
						`${lib} (all opts) found less than its non-folding base`,
					).toBeGreaterThanOrEqual(countFor(lib, query, source));
				}
			}
		});
	}
});
