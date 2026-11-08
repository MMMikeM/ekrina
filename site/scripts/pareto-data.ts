import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Artifact, type ColdCell, PUBLISHED_SIZE } from "../../bench/artifact.ts";
import { displayName, foldsFor } from "../../bench/libraries.ts";
import { headlineConfigs, meanOneShotOf } from "../../bench/tables.ts";
import { CORPORA, type Corpus, type Marker, type ParetoData, type ParetoTiming } from "../src/pareto.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const out = join(repoRoot, "site/src/data/pareto.json");
const artifact: Artifact = JSON.parse(readFileSync(join(repoRoot, "bench/results.json"), "utf8"));

const mean = (xs: number[]) => xs.reduce((sum, x) => sum + x, 0) / xs.length;

const MARKERS: Record<string, Marker> = {
	ekrina: "circle",
	"ekrina (acronym)": "diamond",
	"ekrina (indexed)": "square",
};

const probeKindsOf = (corpus: Corpus) =>
	Object.keys(artifact.coldMatrix[corpus] ?? {}).filter((kind) => kind !== "batch");

const cellOf = (corpus: Corpus, kind: string, size: string, config: string): ColdCell => {
	const cell = artifact.coldMatrix[corpus]?.[kind]?.[size]?.[config];
	if (!cell) throw new Error(`no ${kind} cell for '${config}' on ${corpus} at ${size}`);
	return cell;
};

const timingOf = (corpus: Corpus, size: string, config: string): ParetoTiming => {
	const batch = cellOf(corpus, "batch", size, config);
	const probes = probeKindsOf(corpus).map((kind) => cellOf(corpus, kind, size, config));
	return {
		build: batch.indexMs,
		firstAnswer: batch.firstMs,
		perQuery: batch.restMs ?? batch.queryMs,
		answers: batch.queryMs,
		probeBuild: mean(probes.map((cell) => cell.indexMs)),
		coldQuery: mean(probes.map((cell) => cell.queryMs)),
		oneShot: meanOneShotOf(artifact, corpus, size, config)!,
	};
};

const sizesOf = (corpus: string) =>
	Object.keys(artifact.coldMatrix[corpus]?.batch ?? {}).sort((a, b) => Number(a) - Number(b));

const mrrOf = (corpus: Corpus, config: string) => {
	const row = artifact.scorecard.corpora[corpus]?.find((candidate) => candidate.library === config);
	if (!row) throw new Error(`no ${corpus} scorecard row for '${config}'`);
	return row.mrr;
};

const configs = [...headlineConfigs(artifact)];

const data: ParetoData = {
	corpora: CORPORA.map((corpus) => {
		const sizes = sizesOf(corpus);
		const ekrinaBatch = cellOf(corpus, "batch", sizes[0]!, "ekrina");
		return {
			id: corpus,
			families: artifact.families?.[corpus]?.filter((family) => family.scored).length ?? 0,
			sizes,
			timedQueries: ekrinaBatch.perQueryMs?.length ?? 0,
			probeKinds: probeKindsOf(corpus).length,
			unfolded: configs.filter((config) => !foldsFor(corpus, config)).map(displayName),
			// The same rule bench/tables.ts ranks a corpus's speed tables by.
			ranked: sizes.includes(String(PUBLISHED_SIZE)),
		};
	}),
	rows: configs.map((config) => ({
		config,
		name: displayName(config),
		marker: MARKERS[config] ?? "circle",
		ekrina: config in MARKERS,
		mrr: Object.fromEntries(CORPORA.map((corpus) => [corpus, mrrOf(corpus, config)])) as Record<
			Corpus,
			number
		>,
		timings: Object.fromEntries(
			CORPORA.map((corpus) => [
				corpus,
				Object.fromEntries(sizesOf(corpus).map((size) => [size, timingOf(corpus, size, config)])),
			]),
		) as ParetoData["rows"][number]["timings"],
	})),
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(data, null, "\t")}\n`);
console.log(`pareto-data: ${data.rows.length} rows × ${data.corpora.length} corpora`);
