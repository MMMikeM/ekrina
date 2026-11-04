/**
 * Diagnostic, not yet published: every library scored on catalogue.ts's
 * families, a headline weighted by group, and a junk rate over queries nothing
 * answers. Runs only when asked (`CATALOGUE=1`, or `CATALOGUE=mixed` for one
 * corpus) and writes .raw/catalogue-<corpus>.json.
 */
import { writeFileSync } from "node:fs";
import { it } from "vite-plus/test";
import { ensureRawDir, rawFile } from "./artifact.ts";
import { catalogueSamples, type Group, junkProbes, WEIGHTS } from "./catalogue.ts";
import { configs } from "./configs.ts";
import { CORPORA, SAMPLE_SIZE } from "./corpus";
import { scoreFamilies } from "./mrr.ts";

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const round = (x: number): number => Number(x.toFixed(2));
const short = (library: string): string =>
	library.replace("@nozbe/", "").replace(" (all opts)", "+").replace(" (tuned)", "~").replace("ekrina", "ek");

const wanted = process.env.CATALOGUE;

for (const corpus of CORPORA) {
	it.skipIf(!wanted || (wanted !== "1" && wanted !== corpus.name))(`[${corpus.name}] the catalogue, weighted, against junk`, { timeout: 3_600_000 }, () => {
		const items = corpus.build(SAMPLE_SIZE);
		const all = configs(items);
		const samples = catalogueSamples(items);
		const families = scoreFamilies(samples, all, configs([...items].reverse()));
		const groupOf = new Map(samples.map((sample) => [sample.kind, sample.group]));
		const groups = [...new Set(samples.map((sample) => sample.group))];

		const perFamily = families.map((family) => ({
			group: groupOf.get(family.kind),
			family: family.kind,
			n: family.queries.length,
			...Object.fromEntries(Object.entries(family.mrr).map(([library, mrr]) => [short(library), mrr])),
		}));

		const probes = junkProbes(items);
		const scorecard = all
			.map(({ name, probe }) => {
				const byGroup = Object.fromEntries(
					groups.map((group) => [group, mean(families.filter((f) => groupOf.get(f.kind) === group).map((f) => f.mrr[name]))]),
				) as Record<Group, number>;
				const weighted = groups.reduce((sum, group) => sum + WEIGHTS[group] * byGroup[group], 0);
				const weightUsed = groups.reduce((sum, group) => sum + WEIGHTS[group], 0);
				const junkByKind = probes.map(({ queries }) => queries.filter((query) => probe(query).count > 0).length / queries.length);
				return {
					library: short(name),
					headline: round(weighted / weightUsed),
					junk: round(mean(junkByKind)),
					...Object.fromEntries(probes.map(({ kind }, k) => [`junk: ${kind}`, round(junkByKind[k])])),
					...Object.fromEntries(groups.map((group) => [group, round(byGroup[group])])),
				};
			})
			.sort((a, b) => b.headline - a.headline);

		console.log(`\n[${corpus.name}] MRR@10 per family`);
		console.table(perFamily);
		console.log(`[${corpus.name}] headline (group-weighted MRR@10) and junk rate (share of unanswerable queries answered, per kind and mean)`);
		console.table(scorecard);

		ensureRawDir();
		writeFileSync(
			rawFile(`catalogue-${corpus.name}.json`),
			JSON.stringify({ weights: WEIGHTS, probes, scorecard, perFamily, queries: families.map((f) => ({ family: f.kind, queries: f.queries })) }, null, "\t"),
		);
	});
}
