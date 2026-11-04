/**
 * Diagnostic, not yet published: every library scored on catalogue.ts's
 * families, a headline weighted by group, and a junk rate over queries nothing
 * answers. Runs only when asked (`CATALOGUE=1`, or `CATALOGUE=mixed` for one
 * corpus) and writes .raw/catalogue-<corpus>.json.
 */
import { writeFileSync } from "node:fs";
import { it } from "vite-plus/test";
import { ensureRawDir, rawFile } from "./artifact.ts";
import { catalogueSamples, WEIGHTS } from "./catalogue.ts";
import { scoreCatalogue } from "./catalogue-score.ts";
import { CORPORA, SAMPLE_SIZE } from "./corpus";

const wanted = process.env.CATALOGUE;

for (const corpus of CORPORA) {
	it.skipIf(!wanted || (wanted !== "1" && wanted !== corpus.name))(`[${corpus.name}] the catalogue, weighted, against junk`, { timeout: 3_600_000 }, () => {
		const items = corpus.build(SAMPLE_SIZE);
		const score = scoreCatalogue(items, catalogueSamples(items));
		console.table(score.scorecard);
		ensureRawDir();
		writeFileSync(rawFile(`catalogue-${corpus.name}.json`), JSON.stringify({ weights: WEIGHTS, ...score }, null, "\t"));
	});
}
