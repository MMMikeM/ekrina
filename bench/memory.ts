/**
 * Retained footprint per configuration at 100k, one child process per corpus
 * and configuration: after construction, after each of three warm queries, and
 * after the searcher is dropped.
 *
 * The metric is `heapUsed + external`, never `heapUsed` alone: typed arrays are
 * accounted in `external`, and ekrina's gates are per-item Int32Arrays. A
 * heapUsed-only cell would charge ekrina nothing for its primary structure.
 *
 * The queries are what make the cell honest. fuzzysort's first go() fills a
 * process-wide cache, and ekrina builds its union index on the first query that
 * needs the one-edit rescue, so a constructor-only reading undercounts both.
 *
 *   node --expose-gc bench/memory.ts [variant|all]   # parent: spawns every cell, writes .raw/memory.json
 *   MEM_CELL='<corpus>|<config>' node --expose-gc bench/memory.ts   # one cell
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
	ensureRawDir,
	type MemoryCell,
	type MemoryMatrix,
	type MemoryReading,
	rawFile,
} from "./artifact.ts";
import { CONFIG_NAMES, configs } from "./configs.ts";
import { CORPORA, type QuerySpec } from "./corpus.ts";

const SIZE = 100_000;

// A WeakRef keeps its target reachable for the rest of the execution turn that
// observed it, so collections have to be separated by real turn boundaries
// rather than run back to back. Reclaiming a large dead graph also takes
// several passes: four synchronous calls left a dropped 27 MB index still
// counted in heapUsed, which read as a leak that wasn't one.
const nextTurn = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const settle = async (): Promise<void> => {
	const gc = (globalThis as { gc?: () => void }).gc;
	if (!gc) throw new Error("bench/memory.ts needs --expose-gc");
	for (let i = 0; i < 8; i++) {
		gc();
		await nextTurn();
	}
};

const sample = (): { heap: number; external: number } => {
	const m = process.memoryUsage();
	return { heap: m.heapUsed, external: m.external };
};

const measureCell = async (corpusName: string, configName: string): Promise<MemoryCell> => {
	const corpus = CORPORA.find((c) => c.name === corpusName);
	if (!corpus) throw new Error(`no corpus '${corpusName}'`);
	const list = corpus.build(SIZE);
	const queryOf = (kind: QuerySpec["kind"]): string => {
		const spec = corpus.specs.find((s) => s.kind === kind);
		if (!spec) throw new Error(`corpus '${corpusName}' has no '${kind}' probe`);
		return spec.query;
	};

	await settle();
	const before = sample();
	const retained = async (): Promise<MemoryReading> => {
		await settle();
		const now = sample();
		const heapBytes = Math.max(0, now.heap - before.heap);
		const externalBytes = Math.max(0, now.external - before.external);
		return { heapBytes, externalBytes, totalBytes: heapBytes + externalBytes };
	};

	// The searcher lives only in this frame, so returning drops the last strong reference.
	const exercise = async () => {
		const config = configs(list, configName)[0];
		const after = async (kind: QuerySpec["kind"]): Promise<MemoryReading> => {
			config.count(queryOf(kind));
			return retained();
		};
		// In this order, so each reading adds one query's state to the last.
		const built = await retained();
		const match = await after("short-word");
		const miss = await after("miss");
		const long = await after("long-word");
		return { readings: { built, match, miss, long }, alive: new WeakRef(config) };
	};

	const { readings, alive } = await exercise();
	const dropped = await retained();
	return {
		...readings,
		residueBytes: dropped.totalBytes,
		collected: alive.deref() === undefined,
	};
};

const cell = process.env.MEM_CELL;
if (cell) {
	const [corpusName, configName] = cell.split("|");
	process.stdout.write(JSON.stringify(await measureCell(corpusName, configName)));
} else {
	const self = fileURLToPath(import.meta.url);
	const variantSel = process.argv[2] ?? "all";
	const variants = CONFIG_NAMES.filter(
		(n) => variantSel === "all" || n.toLowerCase().includes(variantSel.toLowerCase()),
	);
	if (!variants.length) throw new Error(`no variant matches '${variantSel}'`);
	const out: MemoryMatrix = {};
	const mb = (n: number): string => (n / 1024 / 1024).toFixed(2).padStart(7);

	for (const { name: corpusName } of CORPORA) {
		for (const name of variants) {
			const raw = execFileSync(process.execPath, ["--expose-gc", self], {
				env: { ...process.env, MEM_CELL: `${corpusName}|${name}` },
				encoding: "utf8",
				maxBuffer: 1 << 20,
			});
			const measured = JSON.parse(raw) as MemoryCell;
			(out[corpusName] ??= {})[name] = measured;
			console.error(
				`[${corpusName}] ${name.padEnd(28)}` +
					`  built ${mb(measured.built.totalBytes)}` +
					(["match", "miss", "long"] as const)
						.map((step) => `  ${step} ${mb(measured[step].totalBytes)}`)
						.join("") +
					`  residue ${mb(measured.residueBytes)} MB` +
					(measured.collected ? "" : "  NOT COLLECTED"),
			);
		}
	}

	ensureRawDir();
	writeFileSync(rawFile("memory.json"), JSON.stringify(out, null, "\t"));
}
