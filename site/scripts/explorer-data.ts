import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Artifact, FamilyRow } from "../../bench/artifact.ts";
import { WEIGHTS } from "../../bench/catalogue.ts";
import { displayName, META } from "../../bench/libraries.ts";
import { headlineConfigs, libraryOf } from "../../bench/tables.ts";
import type { ExplorerData, ExplorerLibrary } from "../src/explorer.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const out = join(repoRoot, "site/src/data/explorer.json");
const artifact: Artifact = JSON.parse(readFileSync(join(repoRoot, "bench/results.json"), "utf8"));

const CORPORA = ["en", "native", "emoji"] as const;
// Only the groups the headline MRR weighs; reported-only families carry no weight.
const GROUPS = Object.entries(WEIGHTS)
	.filter(([, weight]) => weight > 0)
	.map(([group]) => group);

const mean = (xs: number[]) => xs.reduce((sum, x) => sum + x, 0) / xs.length;

const groupMrr = (families: FamilyRow[], group: string, config: string) =>
	mean(families.filter((f) => f.scored && f.group === group).map((f) => f.mrr[config] ?? 0));

const junkOf = (corpus: string, config: string) =>
	artifact.scorecard.corpora[corpus]?.find((row) => row.library === config)?.junk ?? 0;

const valuesOn = (corpus: string, config: string) => [
	...GROUPS.map((group) => groupMrr(artifact.families?.[corpus] ?? [], group, config)),
	1 - junkOf(corpus, config),
];

const FRAME_MS = 16;
const SIZES = ["10000", "100000"] as const;
const TIMED = ["en", "native"] as const;

const median = (xs: number[]) => {
	const sorted = [...xs].sort((x, y) => x - y);
	const mid = sorted.length / 2;
	return Number.isInteger(mid) ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[Math.floor(mid)]!;
};

// The cold one-shot the benchmarks' Pareto chart plots: each single-query
// cell's constructor plus first answer, in its own fresh process, averaged.
const coldFirstAnswer = (corpus: string, size: string, config: string) => {
	const cells = artifact.coldMatrix[corpus] ?? {};
	return mean(
		Object.keys(cells)
			.filter((kind) => kind !== "batch")
			.map((kind) => cells[kind]![size]![config]!.oneShotMs),
	);
};

const timingOf = (corpus: (typeof TIMED)[number], config: string) => {
	const mrr = artifact.scorecard.corpora[corpus]?.find((row) => row.library === config)?.mrr ?? 0;
	const sizes = Object.fromEntries(
		SIZES.map((size) => {
			const cell = artifact.coldMatrix[corpus]?.batch?.[size]?.[config];
			const queries = cell?.perQueryMs ?? [];
			if (!cell || queries.length === 0) {
				throw new Error(`no per-query times for '${config}' on ${corpus} at ${size}`);
			}
			return [
				size,
				{
					medianMs: median(queries),
					slowestMs: Math.max(...queries),
					withinFrame: queries.filter((ms) => ms <= FRAME_MS).length,
					queries: queries.length,
					firstMs: coldFirstAnswer(corpus, size, config),
					perQueryMs: queries,
				},
			];
		}),
	) as ExplorerLibrary["timing"]["en"]["sizes"];
	return { mrr, sizes };
};

const headlineOf = (config: string) => {
	const [en, native, emoji] = CORPORA.map(
		(corpus) => artifact.scorecard.corpora[corpus]?.find((row) => row.library === config)?.mrr ?? 0,
	) as [number, number, number];
	return { all: mean([en, native, emoji]), en, native, emoji };
};

const slugOf = (config: string) => config.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");

// Each library once, at the configuration the headline tables show.
const configs = [...headlineConfigs(artifact)].filter((config) => !config.startsWith("ekrina ("));

const data: ExplorerData = {
	frameMs: FRAME_MS,
	// The batch cells time the representative probes in this same order.
	queries: Object.fromEntries(
		TIMED.map((corpus) => [corpus, (artifact.probes[corpus] ?? []).map((probe) => probe.query)]),
	) as ExplorerData["queries"],
	axes: [...GROUPS.map((group) => group[0]!.toUpperCase() + group.slice(1)), "Refuses junk"],
	corpora: CORPORA.map((corpus) => ({
		id: corpus,
		families: artifact.families?.[corpus]?.filter((f) => f.scored).length ?? 0,
	})),
	libraries: configs.map((config) => {
		const [en, native, emoji] = CORPORA.map((corpus) => valuesOn(corpus, config)) as [
			number[],
			number[],
			number[],
		];
		const all = en.map((_, k) => mean([en[k]!, native[k]!, emoji[k]!]));
		return {
			config,
			slug: slugOf(config),
			name: displayName(config),
			values: { all, en, native, emoji },
			headline: headlineOf(config),
			// Every headline configuration that has a typo mode runs with it on.
			correctsTypos: (META[libraryOf(config)]?.features.typos ?? "no") !== "no",
			timing: { en: timingOf("en", config), native: timingOf("native", config) },
		};
	}),
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(data, null, "\t")}\n`);
console.log(`explorer-data: ${data.libraries.length} libraries × ${data.axes.length} axes`);
