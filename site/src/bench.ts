import type { Artifact } from "../../bench/artifact.ts";
import { displayName, META, metaFor } from "../../bench/libraries.ts";
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

const gzipOf = (config: string) => `~${META[config]!.gzipKB} kB`;

const COUNTS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

const ORDINALS = ["", "second-", "third-", "fourth-", "fifth-", "sixth-", "seventh-", "eighth-"];

// "the third-largest of the eight", from the bundle sizes bench/libraries.ts records.
const sizeRank = () => {
	const larger = Object.values(META).filter((meta) => meta.gzipKB > META.ekrina!.gzipKB).length;
	return `the ${ORDINALS[larger]}largest of the ${COUNTS[Object.keys(META).length]}`;
};

const msOf = (config: string) => batchOf(config, SIZE).restMs!;

// The other libraries that, like Ekrina, answer none of the no-answer queries on
// any of the three lists, for ", and so does uFuzzy (all opts), at 0.66 MRR".
const junkFree = explorer.libraries
	.map((library) => library.config)
	.filter(
		(config) =>
			config !== "ekrina" &&
			Object.values(artifact.scorecard.corpora).every((rows) => !rows.find((row) => row.library === config)?.junk),
	);

export type CompareRow = {
	name: string;
	isEkrina: boolean;
	mrr: number;
	junk: number;
	ms: number;
	gzipKB: number;
};

// Each library at its best-scoring configuration over the 10,000 native names,
// the corpus and size README.md's comparison uses, best on quality first.
const compareRows: CompareRow[] = [...explorer.libraries]
	.sort((a, b) => b.headline.native - a.headline.native)
	.map((library) => ({
		name: displayName(library.config),
		isEkrina: library.config === "ekrina",
		mrr: library.headline.native,
		junk: junkOf(library.config),
		ms: msOf(library.config),
		gzipKB: metaFor(library.config)!.gzipKB,
	}));

export const bench = {
	ekrina: {
		mrr: mrrRange("ekrina"),
		msPerQuery: batchOf("ekrina", SIZE).restMs!.toFixed(1),
		msPerQuery100k: batchOf("ekrina", "100000").restMs!.toFixed(1),
		gzip: gzipOf("ekrina"),
	},
	runnerUp: {
		name: displayName(runnerUp.config),
		mrr: mrrRange(runnerUp.config),
	},
	size: sizeRank(),
	compareRows,
	alsoJunkFree:
		junkFree.length === 0
			? ""
			: `, and so ${junkFree.length === 1 ? "does" : "do"} ${junkFree.map((config) => `${displayName(config)}, at ${mrrRange(config)} MRR`).join(", and ")}`,
	at100k: at100k(),
};
