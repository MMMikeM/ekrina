/**
 * Diagnostic, never published: turns every axis in frontier.ts up one step at
 * a time until no library still finds the item, and reports how far each
 * library held. Runs only when asked (`FRONTIER=1`, or `FRONTIER=mixed` for
 * one corpus), for over an hour a corpus, and writes each axis to
 * .raw/frontier-<corpus>.json as it finishes. `FRONTIER_AXES=a,b` reruns only
 * the axes whose names contain one of those, merged over the saved ones.
 * A step whose list, queries, relevant items and builds all match one already
 * measured is read from .raw/frontier-cache-<corpus>.json instead of rerun.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { it } from "vite-plus/test";
import { ensureRawDir, rawFile } from "./artifact.ts";
import { type Config, configs } from "./configs.ts";
import { CORPORA } from "./corpus";
import { AXES, frontierSamples } from "./frontier.ts";
import { type Sample, scoreFamilies } from "./mrr.ts";
import { foldedWords, forgetFoldedWords } from "./words.ts";

const HOLDS = 0.5;
const MIN_SAMPLES = 8;
const SIZE = 10_000;
// Long fields make every library's index grow with the text, so the padding
// axis searches a shorter list: it measures field length, not list size.
const PADDED_SIZE = 1_000;
const PADDED_WORDS = 10_000_000;
const MIN_PADDED_OTHERS = 100;

const short = (library: string): string =>
	library.replace("@nozbe/", "").replace(" (all opts)", "+").replace(" (tuned)", "~").replace("ekrina", "ek");

type Curve = { step: number | string; n: number; items?: number; mrr: Record<string, number>; outOfMemory?: string[] };

type Built = { all: Config[]; reversed: Config[] };

const mrrOf = (samples: Sample[], built: Built): Record<string, number> =>
	scoreFamilies(samples, built.all, built.reversed)[0]?.mrr ?? {};

const sha = (...parts: (string | Buffer)[]): string => {
	const hash = createHash("sha256");
	for (const part of parts) hash.update(part).update("\0");
	return hash.digest("hex");
};

// Every file a measured MRR depends on besides the list and the queries: the
// built ekrina, every other library's pinned version, and the scoring code.
const BUILDS = sha(
	...["../dist/index.mjs", "../pnpm-lock.yaml", "./configs.ts", "./mrr.ts"].map((path) => readFileSync(new URL(path, import.meta.url))),
);

const stepKey = (listHash: string, list: string[], samples: Sample[]): string =>
	sha(
		BUILDS,
		listHash,
		JSON.stringify(samples.map(({ query, relevant }) => [query, relevant && list.flatMap((item, at) => (relevant(item) ? [at] : []))])),
	);

// Why an axis stopped: every library fell below HOLDS, the corpus could not
// supply enough queries that hard (the axis says why when it knows), or the
// dial had no further step.
type Stop = string;

// How far each library held: the last step before it first fell below HOLDS.
// A "+" marks a library that never broke, so its limit lies past where the
// axis stopped.
const heldTo = (curve: Curve[], library: string): string => {
	let held: number | string | null = null;
	for (const point of curve) {
		const before = held === null ? "—" : String(held);
		if (point.outOfMemory?.includes(library)) return `${before}, out of memory at ${point.step}`;
		if ((point.mrr[library] ?? 0) < HOLDS) return before;
		held = point.step;
	}
	return held === null ? "—" : `${held}+`;
};

const wanted = process.env.FRONTIER;
const onlyAxes = process.env.FRONTIER_AXES?.split(",").map((part) => part.trim()) ?? null;
const runs = (name: string): boolean => onlyAxes === null || onlyAxes.some((part) => name.includes(part));

type Saved = {
	frontier: Record<string, Record<string, string>>;
	curves: Record<string, { stop: Stop; stoppedAt: number | string | null; seconds: number; points: Curve[] }>;
};

const PADDING = "haystack / words before the match, one typo";
const LIST_SIZE = "haystack / list size, one typo";
const axisOrder = [...AXES.map((axis) => `${axis.group} / ${axis.name}`), LIST_SIZE, PADDING];

for (const corpus of CORPORA) {
	it.skipIf(!wanted || (wanted !== "1" && wanted !== corpus.name))(`[${corpus.name}] every library's limit on every axis`, { timeout: 14_400_000 }, () => {
		const items = corpus.build(SIZE);
		let built: Built | undefined;
		const libraries = configs(items.slice(0, 1)).map((config) => config.name);
		const file = rawFile(`frontier-${corpus.name}.json`);
		const cacheFile = rawFile(`frontier-cache-${corpus.name}.json`);
		// A library's entry reads "started" while it runs and "retrying" on its
		// second attempt, so a library that kills the process twice is recorded
		// as out of memory rather than crashing every later run.
		const cache: Record<string, Record<string, number> | number | "started" | "retrying"> = existsSync(cacheFile)
			? JSON.parse(readFileSync(cacheFile, "utf8"))
			: {};
		const keep = (key: string, value: (typeof cache)[string]): void => {
			cache[key] = value;
			ensureRawDir();
			writeFileSync(cacheFile, JSON.stringify(cache));
		};
		let fresh = 0;
		let reused = 0;
		const measuredTogether = (samples: Sample[], list: string[], listHash: string, builtFor: () => Built): Record<string, number> => {
			const key = stepKey(listHash, list, samples);
			const hit = cache[key];
			if (typeof hit === "object") {
				reused++;
				return hit;
			}
			fresh++;
			const mrr = mrrOf(samples, builtFor());
			keep(key, mrr);
			return mrr;
		};
		// The haystack axes build one library's pair of searchers at a time:
		// thousands of words a field, all of them at once outgrow a 12 GB heap.
		// A library out of memory on a smaller step is not tried on a larger one.
		const measuredApart = (
			samples: Sample[],
			list: string[],
			listHash: string,
			label: string,
			outOfMemoryBefore: string[] = [],
		): { mrr: Record<string, number>; outOfMemory: string[] } => {
			const key = stepKey(listHash, list, samples);
			const whole = cache[key];
			if (typeof whole === "object") {
				reused++;
				return { mrr: whole, outOfMemory: [] };
			}
			const reversedList = [...list].reverse();
			const mrr: Record<string, number> = {};
			const outOfMemory: string[] = [];
			for (const library of libraries) {
				const libraryKey = `${key}|${library}`;
				const hit = cache[libraryKey];
				if (typeof hit === "number") {
					reused++;
					mrr[library] = hit;
					continue;
				}
				if (hit === "retrying" || outOfMemoryBefore.includes(library)) {
					outOfMemory.push(library);
					mrr[library] = 0;
					continue;
				}
				keep(libraryKey, hit === "started" ? "retrying" : "started");
				process.stderr.write(`[${corpus.name}] ${label}: ${library}\n`);
				fresh++;
				mrr[library] = scoreFamilies(samples, configs(list, library), configs(reversedList, library))[0]?.mrr[library] ?? 0;
				keep(libraryKey, mrr[library]);
			}
			return { mrr, outOfMemory };
		};
		const itemsHash = sha(items.join("\n"));
		const builtItems = (): Built => (built ??= { all: configs(items), reversed: configs([...items].reverse()) });
		const saved: Saved = onlyAxes !== null && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { frontier: {}, curves: {} };

		const save = (name: string, points: Curve[], stop: Stop, stoppedAt: number | string | null, started: number): void => {
			const seconds = Math.round((Date.now() - started) / 1000);
			saved.curves[name] = { stop, stoppedAt, seconds, points };
			saved.frontier[name] = {
				stop: `${stop}${stoppedAt === null ? "" : ` at ${stoppedAt}`}`,
				...Object.fromEntries(libraries.map((library) => [short(library), heldTo(points, library)])),
			};
			const ordered = <T>(record: Record<string, T>): Record<string, T> =>
				Object.fromEntries(axisOrder.filter((axis) => axis in record).map((axis) => [axis, record[axis]]));
			ensureRawDir();
			writeFileSync(file, JSON.stringify({ frontier: ordered(saved.frontier), curves: ordered(saved.curves) }, null, "\t"));
			process.stderr.write(`[${corpus.name}] ${name}: ${saved.frontier[name].stop} (${seconds}s, ${fresh} steps measured, ${reused} reused so far)\n`);
		};

		for (const [at, axis] of AXES.entries()) {
			const name = `${axis.group} / ${axis.name}`;
			if (!runs(name)) continue;
			const started = Date.now();
			const points: Curve[] = [];
			let stop: Stop = "end of the dial";
			let stoppedAt: number | null = null;
			for (const step of axis.steps) {
				const samples = frontierSamples(items, at, step);
				if (samples.length < MIN_SAMPLES) {
					[stop, stoppedAt] = [axis.runsOut ?? "out of queries", step];
					break;
				}
				const mrr = measuredTogether(samples, items, itemsHash, builtItems);
				points.push({ step, n: samples.length, mrr });
				if (libraries.every((library) => (mrr[library] ?? 0) < HOLDS)) {
					[stop, stoppedAt] = ["no library holds", step];
					break;
				}
			}
			save(name, points, stop, stoppedAt, started);
		}

		// The haystack axes change the list rather than the query.
		const substitution = AXES.findIndex((axis) => axis.name === "neighbouring-key substitutions");
		if (runs(LIST_SIZE)) {
			const started = Date.now();
			const headSamples = frontierSamples(corpus.build(1_000), substitution, 1);
			const sizes: Curve[] = [];
			for (const size of [1_000, 10_000, 30_000, 100_000]) {
				const list = corpus.build(size);
				const { mrr, outOfMemory } = measuredApart(headSamples, list, sha(list.join("\n")), `${size} items`, sizes.at(-1)?.outOfMemory);
				sizes.push({ step: size, n: headSamples.length, mrr, ...(outOfMemory.length ? { outOfMemory } : {}) });
			}
			save(LIST_SIZE, sizes, "the corpus ends", "100k items", started);
		}

		if (runs(PADDING)) {
			const started = Date.now();
			const shorter = corpus.build(PADDED_SIZE);
			const typoSamples = frontierSamples(shorter, substitution, 1);
			// Filler that held a sample's target word would make every padded
			// field relevant, crediting any result at all as a hit.
			const fillerWords = [...new Set(shorter.flatMap(foldedWords))].filter(
				(word) => !typoSamples.some((sample) => sample.relevant?.(word)),
			);
			const filler = (i: number, words: number): string =>
				Array.from({ length: words }, (_, k) => fillerWords[(i * 7919 + k * 104_729) % fillerWords.length]).join(" ");
			const answers = new Set(shorter.filter((item) => typoSamples.some((sample) => sample.relevant?.(item))));
			// Past PADDED_WORDS in all, the list keeps every item a sample needs and
			// as many others as fit, so the same queries still have answers.
			const fits = (words: number): number[] => {
				let others = Math.max(MIN_PADDED_OTHERS, Math.floor(PADDED_WORDS / Math.max(1, words)) - answers.size);
				return shorter.flatMap((item, i) => (answers.has(item) || others-- > 0 ? [i] : []));
			};
			const longFields: Curve[] = [];
			for (const words of [0, 5, 20, 60, 120, 250, 500, 1000, 2000, 10_000, 100_000]) {
				const list = fits(words);
				const padded = list.map((i) => (words === 0 ? shorter[i] : `${filler(i, words)} ${shorter[i]}`));
				const { mrr, outOfMemory } = measuredApart(typoSamples, padded, sha(padded.join("\n")), `${words} words`, longFields.at(-1)?.outOfMemory);
				forgetFoldedWords();
				longFields.push({ step: words, n: typoSamples.length, items: list.length, mrr, ...(outOfMemory.length ? { outOfMemory } : {}) });
				const broke = libraries.every((library) => (mrr[library] ?? 0) < HOLDS);
				save(PADDING, longFields, broke ? "no library holds" : "end of the dial", broke ? words : null, started);
				if (broke) break;
			}
		}

		console.log(`\n[${corpus.name}] how far each library held (MRR@10 ≥ ${HOLDS}); "+" = never broke before the axis stopped`);
		console.table(saved.frontier);
	});
}
