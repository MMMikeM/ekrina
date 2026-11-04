/**
 * Diagnostic: the catalogue over candidate corpora that are not committed yet.
 * `PILOT=<dir>` scores every `<name>.json` list of strings in that directory,
 * cut to the first 10k of a fixed shuffle, with `<dir>/misspellings.json`
 * (bench/misspellings.json's shape) adding real misspellings when present. Writes
 * .raw/pilot-<name>.json.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "vite-plus/test";
import { ensureRawDir, rawFile } from "./artifact.ts";
import { catalogueSamples, type Misspellings, WEIGHTS } from "./catalogue.ts";
import { scoreCatalogue } from "./catalogue-score.ts";
import { SAMPLE_SIZE } from "./corpus";
import { shuffledIndices } from "./words.ts";

const dir = process.env.PILOT;
const misspellingsFile = dir ? join(dir, "misspellings.json") : "";
const misspellings: Misspellings | undefined =
	dir && existsSync(misspellingsFile) ? JSON.parse(readFileSync(misspellingsFile, "utf8")).misspellings : undefined;
const lists = dir ? readdirSync(dir).filter((file) => file.endsWith(".json") && file !== "misspellings.json") : [];

if (lists.length === 0) it.skip("[pilot] needs PILOT=<dir> of corpora", () => {});

for (const file of lists) {
	const name = file.replace(/\.json$/, "");
	it.skipIf(!dir)(`[${name}] the catalogue on a pilot corpus`, { timeout: 3_600_000 }, () => {
		const all: string[] = JSON.parse(readFileSync(join(dir as string, file), "utf8"));
		const items = all.length <= SAMPLE_SIZE ? all : shuffledIndices(all.length, 1).slice(0, SAMPLE_SIZE).map((at) => all[at]);
		const samples = catalogueSamples(items, misspellings);
		const score = scoreCatalogue(items, samples);
		console.table(score.scorecard);
		ensureRawDir();
		writeFileSync(rawFile(`pilot-${name}.json`), JSON.stringify({ weights: WEIGHTS, items: items.length, ...score }, null, "\t"));
	});
}
