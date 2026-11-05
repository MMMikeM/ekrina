/**
 * Diagnostic, never published: every library scored on a grid of typing
 * mistakes (limits.ts) and on queries nothing answers. Slow, since it runs
 * Fuse over every cell, so it runs only when asked: `LIMITS=1`.
 */
import { writeFileSync } from "node:fs";
import { it } from "vite-plus/test";
import { ensureRawDir, rawFile } from "./artifact.ts";
import { configs } from "./configs.ts";
import { CORPORA, SAMPLE_SIZE } from "./corpus";
import { limitSamples, unanswerable } from "./limits.ts";
import { scoreFamilies } from "./mrr.ts";

const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[xs.length >> 1] ?? 0;
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const short = (library: string): string =>
	library.replace("@nozbe/", "").replace(" (all opts)", "+").replace(" (tuned)", "~").replace("ekrina", "ek");

const runOut: Record<string, unknown> = {};

for (const corpus of CORPORA) {
	it.skipIf(!process.env.LIMITS)(`[${corpus.name}] each library's limits`, { timeout: 1_800_000 }, () => {
		const items = corpus.build(SAMPLE_SIZE);
		const all = configs(items);
		const samples = limitSamples(items);
		const families = scoreFamilies(samples, all, configs([...items].reverse()));
		const axisOf = new Map(samples.map((sample) => [sample.kind, sample.axis]));

		const grid = families.map((family) => ({
			axis: axisOf.get(family.kind),
			cell: family.kind,
			n: family.queries.length,
			...Object.fromEntries(Object.entries(family.mrr).map(([library, mrr]) => [short(library), mrr])),
		}));
		console.log(`\n[${corpus.name}] MRR@10 per cell`);
		console.table(grid);

		const axes = [...new Set(samples.map((sample) => sample.axis))];
		const byAxis = axes.map((axis) => ({
			axis,
			...Object.fromEntries(
				all.map(({ name }) => [
					short(name),
					Number(mean(families.filter((f) => axisOf.get(f.kind) === axis).map((f) => f.mrr[name])).toFixed(2)),
				]),
			),
		}));
		console.log(`[${corpus.name}] mean MRR@10 per axis`);
		console.table(byAxis);

		const precision = unanswerable(items).flatMap(({ kind, queries }) =>
			all.map(({ name, probe }) => {
				const counts = queries.map((query) => probe(query).count);
				return {
					probe: kind,
					library: name,
					n: queries.length,
					answered: Number((counts.filter((count) => count > 0).length / counts.length).toFixed(2)),
					medianRows: median(counts),
				};
			}),
		);
		console.log(`[${corpus.name}] queries nothing answers: share answered, median rows`);
		console.table(precision.map(({ library, ...rest }) => ({ library: short(library), ...rest })));

		const flooding = all.map(({ name }) => ({
			library: short(name),
			medianRowsAcrossCells: median(families.map((family) => family.medianRows[name])),
		}));
		runOut[corpus.name] = { grid, byAxis, precision, flooding, queries: families.map((f) => ({ cell: f.kind, queries: f.queries })) };
		ensureRawDir();
		writeFileSync(rawFile("limits.json"), JSON.stringify(runOut, null, "\t"));
	});
}
