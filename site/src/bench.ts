import type { Artifact } from "../../bench/artifact.ts";
import { displayName, META } from "../../bench/libraries.ts";
import results from "../../bench/results.json" with { type: "json" };
import emoji from "../../bench/corpus-emoji.json" with { type: "json" };
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

const [ekrina, ...others] = [...explorer.libraries].sort((a, b) => b.headline.all - a.headline.all);
const runnerUp = others[0]!;

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

const ORDINALS = ["", "second-", "third-", "fourth-", "fifth-", "sixth-", "seventh-", "eighth-"];
const COUNTS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

// "the third-largest of the eight", from the bundle sizes bench/libraries.ts records.
const sizeRank = () => {
	const sizes = Object.values(META).map((meta) => meta.gzipKB);
	const larger = sizes.filter((kb) => kb > META.ekrina!.gzipKB).length;
	return `the ${ORDINALS[larger]}largest of the ${COUNTS[sizes.length]}`;
};

export const bench = {
	libraries: COUNTS[explorer.libraries.length - 1],
	emoji: emoji.length.toLocaleString("en-GB"),
	ekrina: {
		mrr: mrrRange(ekrina!.config),
		junk: percent(junkOf("ekrina")),
		msPerQuery: batchOf("ekrina", SIZE).restMs!.toFixed(1),
		msPerQuery100k: batchOf("ekrina", "100000").restMs!.toFixed(1),
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
		gzip: gzipOf("fuse.js"),
	},
	fastFuzzy: { gzip: gzipOf("fast-fuzzy") },
	size: sizeRank(),
	at100k: at100k(),
};
