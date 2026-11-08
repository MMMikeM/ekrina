import { execFileSync, execSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { paretoPictures, renderPareto } from "../docs/pareto.ts";
import {
	type Artifact,
	type ColdMatrix,
	type MemoryMatrix,
	type FamilyRow,
	type ProbeTable,
	type ScorecardRow,
	ensureRawDir,
	load,
	rawFile,
	readRaw,
	save,
} from "./artifact.ts";
import { BrokenClaim, figureEvaluator } from "./figures.ts";
import { handTypedFigures, inject } from "./inject.ts";
import { META } from "./libraries.ts";
import { gzipBytes } from "./size.ts";
import { omittedFrom, regions } from "./tables.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const DOC = new URL("../docs/benchmarks.md", import.meta.url);
const METHOD = new URL("../docs/benchmarks/method.md", import.meta.url);
const FAMILIES = new URL("../docs/benchmarks/families.md", import.meta.url);
const README = new URL("../README.md", import.meta.url);
const COMPARE = new URL("../docs/compare.md", import.meta.url);
const LIBRARY_DIR = new URL("../docs/libraries/", import.meta.url);
// Pages outside the generated set that quote current measurements.
const QUOTING = [
	"../docs/benchmarking.md",
	"../site/src/content/docs/how-it-works/fuzzy-tier.md",
	"../site/src/content/docs/guides/long-text.md",
	"../site/src/content/docs/guides/migrate-from-microfuzz.mdx",
].map((path) => new URL(path, import.meta.url));

const flags = new Set(process.argv.slice(2).filter((a) => !a.includes("=")));
const options = new Map(
	process.argv
		.slice(2)
		.filter((a) => a.includes("="))
		.map((a) => a.split("=", 2) as [string, string]),
);

// Fresh processes per cold cell. One: the timed set is small, and the
// contamination guard in run.ts compares sums rather than single cells.
const RUNS = Number(options.get("--runs") ?? 1);
const SCOPE = options.get("--scope") ?? process.env.BENCH ?? "";
const CHECK = flags.has("--check");
const DOCS_ONLY = flags.has("--docs");
// `--only=ekrina` re-measures one library's cells and merges them over the
// committed artifact, leaving every other row at the value it was published
// with. Unlike --scope this DOES write, because the cells it produces are whole
// — the matrix is complete, one library of it is fresher than the rest.
const ONLY = options.get("--only") ?? "";

// `--all` measures every library and publishes. Without it or --only a run
// measures ekrina's rows once and, like a scoped run, prints and stops:
// letting a partial matrix reach the artifact would overwrite published cells.
const ALL = flags.has("--all");
const LIBRARIES = ONLY || (ALL ? "all" : "ekrina");

const measures = !DOCS_ONLY && !CHECK;
const DRY = SCOPE !== "" || (measures && !ALL && !ONLY);
const named =
	flags.has("--speed") || flags.has("--quality") || flags.has("--memory") || flags.has("--size");
const stages = {
	cold: measures && (flags.has("--speed") || !named),
	quality: measures && (flags.has("--quality") || (!named && !DRY)),
	memory: measures && (flags.has("--memory") || (!named && !DRY)),
	size: measures && (flags.has("--size") || (!named && !DRY)),
};

// A scoped run has no artifact to render afterwards, so the runner's own
// output is the result and has to reach the terminal.
const vitest = (args: string, env: Record<string, string> = {}): void => {
	execSync(`pnpm exec vp test ${args}`, {
		cwd: here,
		stdio: ["ignore", DRY ? "inherit" : "ignore", "inherit"],
		env: { ...process.env, BENCH_ONLY: LIBRARIES, BENCH_REPEAT: DRY ? "" : "1", ...env },
	});
};

// The process-cold runner (bench/run.ts): fresh node process per sample, one
// invocation for the whole matrix — it interleaves cells internally and exits
// nonzero on a contaminated run.
const runner = (variant: string, test: string, extra: string[]): void => {
	execFileSync(process.execPath, [`${here}run.ts`, variant, test, ...extra, `--count=${RUNS}`], {
		cwd: here,
		stdio: ["ignore", "inherit", "inherit"],
	});
};

// Overlay measured cells onto the committed ones, leaf by leaf, so a narrowed
// run replaces exactly the rows it measured.
const overlay = <T>(into: Record<string, T>, from: Record<string, T>): void => {
	for (const [key, value] of Object.entries(from)) {
		const existing = into[key];
		if (existing && typeof value === "object" && value !== null && !Array.isArray(value)) {
			overlay(existing as Record<string, unknown>, value as Record<string, unknown>);
		} else {
			into[key] = value;
		}
	}
};

// An --only run splices cells measured today into a matrix measured earlier,
// which is only honest if the machine is comparable across the two sessions.
// Re-time one library the run does NOT touch and require its committed value
// to reproduce: fail past 25%, warn past 10%.
const anchorCheck = (artifact: Artifact): void => {
	const matches = (variant: string): boolean => variant.toLowerCase().includes(ONLY.toLowerCase());
	const anchor = ["fuzzysort", "uFuzzy", "ekrina"].find((v) => !matches(v));
	if (!anchor) return;
	console.error(`anchor: re-timing ${anchor} short-word@10k against the committed matrix…`);
	const out = execFileSync(
		process.execPath,
		[`${here}run.ts`, anchor, "short-word", "--count=3", "--size=10k", "--json"],
		{ cwd: here, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
	);
	const fresh = JSON.parse(out) as ColdMatrix;
	for (const [corpus, kinds] of Object.entries(fresh)) {
		for (const sizes of Object.values(kinds)) {
			for (const [size, variants] of Object.entries(sizes)) {
				for (const [variant, cell] of Object.entries(variants)) {
					const committed = artifact.coldMatrix[corpus]?.["short-word"]?.[size]?.[variant];
					if (!committed) continue;
					const drift = Math.abs(cell.queryMs - committed.queryMs) / committed.queryMs;
					const line = `${corpus}/short-word@10k ${variant}: ${committed.queryMs.toFixed(2)} -> ${cell.queryMs.toFixed(2)} ms (${(100 * drift).toFixed(0)}%)`;
					if (drift > 0.25) {
						throw new Error(
							`anchor drifted past 25% — this machine is not comparable to the session that measured the matrix; rerun the full matrix instead.\n  ${line}`,
						);
					}
					if (drift > 0.1) console.error(`WARNING anchor drift: ${line}`);
				}
			}
		}
	}
};

// The expected-changed vs expected-stable heuristic: every re-measured cell
// against its committed value, so the operator can confirm the cells that
// moved are the ones the change predicts.
const reportDeltas = (artifact: Artifact, fresh: ColdMatrix): void => {
	const rows: { cell: string; pct: number; line: string }[] = [];
	for (const [corpus, kinds] of Object.entries(fresh)) {
		for (const [kind, sizes] of Object.entries(kinds)) {
			for (const [size, variants] of Object.entries(sizes)) {
				for (const [variant, cell] of Object.entries(variants)) {
					const committed = artifact.coldMatrix[corpus]?.[kind]?.[size]?.[variant];
					if (!committed) continue;
					const pct = (100 * (cell.queryMs - committed.queryMs)) / committed.queryMs;
					rows.push({
						cell: `${corpus}/${kind}@${Number(size) / 1000}k ${variant}`,
						pct,
						line: `${committed.queryMs.toFixed(2)} -> ${cell.queryMs.toFixed(2)} ms  ${pct > 0 ? "+" : ""}${pct.toFixed(0)}%`,
					});
				}
			}
		}
	}
	rows.sort((a, b) => a.pct - b.pct);
	const moved = rows.filter((r) => Math.abs(r.pct) >= 10);
	console.error(
		`\ndelta report: ${rows.length} cells re-measured, ${rows.length - moved.length} within ±10%.`,
	);
	for (const r of moved) console.error(`  ${r.cell.padEnd(46)} ${r.line}`);
	console.error("");
};

const runCold = (artifact: Artifact): void => {
	ensureRawDir();
	if (SCOPE) {
		// Tokens: a corpus, a size, or corpus-size — mapped onto the runner's
		// own filters; prints and stops.
		const token = SCOPE.split(",")[0];
		const [corpus, size] = token.includes("-") ? token.split("-") : [token, ""];
		console.error(`cold stage (scoped to ${token})…`);
		runner(LIBRARIES, corpus || "all", size ? [`--size=${size}`] : []);
		return;
	}
	if (DRY) {
		console.error("cold stage: ekrina's rows, one process per cell…");
		runner(LIBRARIES, "all", []);
		return;
	}
	if (ONLY) anchorCheck(artifact);
	console.error(`cold stage: full matrix, ${RUNS} processes per cell…`);
	const out = fileURLToPath(rawFile("cold-matrix.json"));
	runner(LIBRARIES, "all", [`--out=${out}`]);
	if (ONLY) {
		const fresh = readRaw<ColdMatrix>("cold-matrix.json");
		reportDeltas(artifact, fresh);
		overlay(artifact.coldMatrix, fresh);
	} else {
		artifact.coldMatrix = readRaw<ColdMatrix>("cold-matrix.json");
	}
};

type HitsRun = Record<
	string,
	{ scorecard: ScorecardRow[]; tables: ProbeTable[]; families: FamilyRow[] }
>;

const runQuality = (artifact: Artifact): void => {
	ensureRawDir();
	console.error("quality stage: ranks + session + long text…");
	vitest("run hits.test.ts");
	// Both build a table per library, so a narrowed run would write one holding
	// only the measured rows. Left at their published values instead.
	if (!ONLY) vitest("run session.test.ts longtext.test.ts");

	if (DRY) return;

	const hits = readRaw<HitsRun>("hits.json");
	const fresh: {
		scorecard: Artifact["scorecard"]["corpora"];
		probes: Artifact["probes"];
		families: NonNullable<Artifact["families"]>;
	} = {
		scorecard: {},
		probes: {},
		families: {},
	};
	for (const corpus of Object.keys(hits)) {
		const { scorecard, tables, families } = hits[corpus];
		if (ONLY) {
			const kept = (artifact.scorecard.corpora[corpus] ?? []).filter(
				(row) => !scorecard.some((m) => m.library === row.library),
			);
			artifact.scorecard.corpora[corpus] = [...kept, ...scorecard].sort((a, b) => b.mrr - a.mrr);
			for (const [i, probe] of tables.entries()) {
				overlay(artifact.probes[corpus][i].cells, probe.cells);
			}
			for (const [i, family] of families.entries()) {
				const kept = artifact.families?.[corpus]?.[i];
				if (!kept) continue;
				overlay(kept.mrr, family.mrr);
				overlay(kept.medianRows, family.medianRows);
			}
		} else {
			fresh.scorecard[corpus] = scorecard;
			fresh.probes[corpus] = tables;
			fresh.families[corpus] = families;
		}
	}
	// A full run replaces every corpus, so one dropped from the bench leaves no row behind.
	if (!ONLY) {
		artifact.scorecard.corpora = fresh.scorecard;
		artifact.probes = fresh.probes;
		artifact.families = fresh.families;
	}
	if (!ONLY) {
		artifact.session = readRaw("session.json");
		artifact.longtext = readRaw("longtext.json");
	}
};

// Measures the built dist, which `vpr bench` builds before this runs.
const runSize = (artifact: Artifact): void => {
	const libraries = Object.keys(META).filter((library) =>
		LIBRARIES === "all" ? true : library.toLowerCase().includes(LIBRARIES.toLowerCase()),
	);
	artifact.gzipBytes ??= {};
	for (const library of libraries) {
		const bytes = gzipBytes(library);
		const committed = artifact.gzipBytes[library];
		console.error(
			`size ${library}: ${bytes} B gzipped${committed === undefined || committed === bytes ? "" : ` (was ${committed} B)`}`,
		);
		artifact.gzipBytes[library] = bytes;
	}
};

const runMemory = (artifact: Artifact): void => {
	console.error("memory stage: retained footprint at 100k, one process per cell…");
	execFileSync(process.execPath, ["--expose-gc", `${here}memory.ts`, LIBRARIES], {
		cwd: here,
		stdio: ["ignore", "inherit", "inherit"],
	});
	if (DRY) return;
	const fresh = readRaw<MemoryMatrix>("memory.json");
	if (ONLY && artifact.memory) overlay(artifact.memory, fresh);
	else artifact.memory = fresh;
};

const artifact = load();

if (ONLY) {
	console.error(
		`--only=${ONLY}: re-measuring matching rows and merging over bench/results.json.\n` +
			"Every other row keeps the value it was published with, so the comparison now\n" +
			"spans two measurement sessions. Fine for iterating on one library; rerun the\n" +
			"full matrix before treating the cross-library ordering as evidence.",
	);
}

if (stages.cold) runCold(artifact);
if (stages.quality) runQuality(artifact);
if (stages.memory) runMemory(artifact);
if (stages.size) runSize(artifact);

if (DRY) {
	console.error(
		"\nartifact and docs left untouched; `--all` measures every library and publishes.",
	);
	process.exit(0);
}

const tables = { ...regions(artifact), ...paretoPictures(artifact) };

if (stages.cold || stages.quality || stages.memory || stages.size) save(artifact);

// docs/benchmarks.md carries the headline tables, docs/benchmarks/ the method
// and the family tables, README.md and docs/compare.md the comparison, each
// library page its own.
const docs = [
	DOC,
	METHOD,
	FAMILIES,
	README,
	COMPARE,
	...readdirSync(LIBRARY_DIR)
		.filter((file) => file.endsWith(".md"))
		.map((file) => new URL(file, LIBRARY_DIR)),
	...QUOTING,
];
const nameOf = (url: URL): string => relative(repoRoot, fileURLToPath(url));
const evaluate = figureEvaluator(artifact, tables);
const brokenClaims: string[] = [];
const injected = docs.map((url) => {
	const figure = (source: string): string => {
		try {
			return evaluate(source);
		} catch (error) {
			if (!(error instanceof BrokenClaim)) throw error;
			brokenClaims.push(`${nameOf(url)}: ${error.message}`);
			return "";
		}
	};
	try {
		return { url, ...inject(readFileSync(url, "utf8"), tables, figure) };
	} catch (error) {
		throw new Error(`${nameOf(url)}: ${(error as Error).message}`, { cause: error });
	}
});
const handTyped = injected.flatMap(({ url, doc }) =>
	handTypedFigures(doc).map(({ line, text }) => `${nameOf(url)}:${line}: ${text}`),
);
const stale = injected.flatMap(({ url, stale }) => stale.map((id) => `${nameOf(url)}:${id}`));
const unmarked = Object.keys(tables).filter((id) =>
	injected.every(({ unmarked }) => unmarked.includes(id)),
);

if (unmarked.length) console.error(`generated but marked in no doc: ${unmarked.join(", ")}`);

if (brokenClaims.length) {
	console.error("claims the numbers no longer back; rewrite each sentence:");
	for (const claim of brokenClaims) console.error(`  ${claim}`);
}
if (handTyped.length) {
	console.error("measurements typed by hand, outside any marker:");
	for (const line of handTyped) console.error(`  ${line}`);
}

if (CHECK) {
	if (stale.length) {
		console.error(`stale regions: ${stale.join(", ")}`);
		console.error("run `pnpm vpr bench --docs` to bring them up to date.");
	}
	if (stale.length || unmarked.length || handTyped.length || brokenClaims.length) process.exit(1);
	console.error("the docs agree with bench/results.json.");
} else {
	for (const { url, doc } of injected) writeFileSync(url, doc);
	renderPareto(artifact);
	console.error(
		stale.length
			? `rewrote ${stale.length} region(s): ${stale.join(", ")}`
			: "docs already current.",
	);
	for (const corpus of Object.keys(artifact.coldMatrix)) {
		const omitted = omittedFrom(artifact, corpus);
		if (omitted.length)
			console.error(`[${corpus}] omitted (no diacritic folding): ${omitted.join(", ")}`);
	}
	if (brokenClaims.length || handTyped.length) process.exit(1);
}
