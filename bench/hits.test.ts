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
import { scoreFamilies, scorecardOf, tieAround } from "./mrr.ts";

const SIZE = 10_000;

type Outcome = { count: number; rank: number | null };

const outcome = ({ count, ranked }: Probe, source: string | null): Outcome => ({
	count,
	rank: source == null || ranked == null ? null : ranked.indexOf(source) + 1 || null,
});

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

			const families = scoreFamilies(samples, all, reversedAll);
			const scorecard = scorecardOf(families, all);
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

			// `--only=` narrows the set, and a check against an absent row would assert nothing.
			const present = new Set(all.map((c) => c.name));
			if (present.has("ekrina")) {
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
			}

			// Folding configs must find at least as much as their non-folding
			// base on the accent probe (quantifies the README's †).
			const accentProbe = specs.find((s) => s.kind === "accent-stripped");
			if (accentProbe) {
				const { query, source } = accentProbe;
				if (present.has("ekrina")) expect(countFor("ekrina", query, source)).toBeGreaterThan(0);
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
