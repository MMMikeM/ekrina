import type { Artifact } from "../../bench/artifact.ts";
import { displayName, META } from "../../bench/libraries.ts";
import results from "../../bench/results.json" with { type: "json" };
import data from "./data/explorer.json" with { type: "json" };
import type { ExplorerData } from "./explorer.ts";

// Every number the hand-written pages quote, read from the bench's artifact at
// build time, so `pnpm bench` stays the only thing that sets one.

const artifact = results as unknown as Artifact;
const explorer = data as ExplorerData;
const CORPUS = "native";
const SIZE = "10000";

const range = (values: number[], digits = 2) => {
	const [lo, hi] = [Math.min(...values), Math.max(...values)].map((x) => x.toFixed(digits));
	return lo === hi ? lo! : `${lo}–${hi}`;
};

const mrrRange = (config: string) => {
	const { en, native, emoji } = explorer.libraries.find((library) => library.config === config)!.headline;
	return range([en, native, emoji]);
};

const runnerUp = explorer.libraries
	.filter((library) => library.config !== "ekrina")
	.sort((a, b) => b.headline.all - a.headline.all)[0]!;

const junkOf = (config: string) =>
	artifact.scorecard.corpora[CORPUS]!.find((row) => row.library === config)!.junk ?? 0;

const batchOf = (config: string, size: string) => artifact.coldMatrix[CORPUS]!.batch![size]![config]!;

// One searcher answering the 24 timed queries in a fresh process, on both
// timed corpora: what creating it, building its index and the whole session cost.
const at100k = () => {
	const cells = (config: string) =>
		(["en", "native"] as const).map((corpus) => artifact.coldMatrix[corpus]!.batch!["100000"]![config]!);
	const lazy = cells("ekrina");
	const indexed = cells("ekrina (indexed)");
	return {
		createMs: range(lazy.map((cell) => cell.indexMs), 1),
		buildIndexMs: range(indexed.map((cell) => cell.indexMs), 0),
		sessionMs: range(lazy.map((cell) => cell.queryMs), 0),
		sessionIndexedMs: range(indexed.map((cell) => cell.queryMs), 0),
	};
};

const percent = (share: number) => `${Math.round(share * 100)}%`;

const gzipOf = (config: string) => `~${META[config]!.gzipKB} kB`;

const COUNTS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

const named = (configs: string[]) =>
	configs.map((config) => `${displayName(config)} at ${gzipOf(config)}`).join(" and ");

const ORDINALS = ["", "second-", "third-", "fourth-", "fifth-", "sixth-", "seventh-", "eighth-"];

// "the third-largest of the eight, and only Fuse.js at ~9.6 kB and fast-fuzzy at
// ~11 kB are larger", from the bundle sizes bench/libraries.ts records.
const sizeStanding = () => {
	const own = META.ekrina!.gzipKB;
	const others = Object.keys(META).filter((config) => config !== "ekrina");
	const level = others.filter((config) => META[config]!.gzipKB === own);
	const larger = others.filter((config) => META[config]!.gzipKB > own);
	const rank = `the ${ORDINALS[larger.length]}largest of the ${COUNTS[Object.keys(META).length]}`;
	const above =
		larger.length === 0 ? "" : `, and only ${named(larger)} ${larger.length === 1 ? "is" : "are"} larger`;
	return `${level.length === 0 ? rank : `level with ${named(level)}`}${above}`;
};

const msOf = (config: string) => batchOf(config, SIZE).restMs!;
const nativeMrrOf = (config: string) =>
	explorer.libraries.find((library) => library.config === config)!.headline.native.toFixed(2);

// Every library that answers a query faster than Ekrina, fastest first, for
// "fuzzysort, at 0.41 ms with 0.46 MRR, and uFuzzy (all opts), at 0.64 ms with 0.66 MRR,".
const faster = explorer.libraries
	.map((library) => library.config)
	.filter((config) => config !== "ekrina" && msOf(config) < msOf("ekrina"))
	.sort((a, b) => msOf(a) - msOf(b));

export const bench = {
	libraries: COUNTS[explorer.libraries.length - 1],
	ekrina: {
		mrr: mrrRange("ekrina"),
		junk: percent(junkOf("ekrina")),
		msPerQuery: batchOf("ekrina", SIZE).restMs!.toFixed(1),
		msPerQuery100k: batchOf("ekrina", "100000").restMs!.toFixed(1),
		msPerQueryExact: msOf("ekrina").toFixed(2),
		nativeMrr: nativeMrrOf("ekrina"),
		gzip: gzipOf("ekrina"),
	},
	runnerUp: {
		name: displayName(runnerUp.config),
		mrr: mrrRange(runnerUp.config),
		junk: percent(junkOf(runnerUp.config)),
		msPerQuery: batchOf(runnerUp.config, SIZE).restMs!.toFixed(1),
	},
	fuse: {
		name: displayName("fuse.js (tuned)"),
		junk: percent(junkOf("fuse.js (tuned)")),
	},
	size: sizeStanding(),
	faster: faster
		.map((config) => `${displayName(config)}, at ${msOf(config).toFixed(2)} ms with ${nativeMrrOf(config)} MRR,`)
		.join(" and "),
	at100k: at100k(),
};
