import { type CatalogueSample, type Group, junkProbes, WEIGHTS } from "./catalogue.ts";
import { configs } from "./configs.ts";
import { scoreFamilies } from "./mrr.ts";

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const round = (x: number): number => Number(x.toFixed(2));
export const short = (library: string): string =>
	library.replace("@nozbe/", "").replace(" (all opts)", "+").replace(" (tuned)", "~").replace("ekrina", "ek");

export type CatalogueScore = {
	scorecard: Record<string, string | number>[];
	perFamily: Record<string, string | number | undefined>[];
	probes: { kind: string; queries: string[] }[];
	queries: { family: string; queries: string[] }[];
};

/** Every library's per-family MRR@10, group-weighted headline and junk rate over `items`. */
export const scoreCatalogue = (items: string[], samples: CatalogueSample[]): CatalogueScore => {
	const all = configs(items);
	const families = scoreFamilies(samples, all, configs([...items].reverse()));
	const groupOf = new Map(samples.map((sample) => [sample.kind, sample.group]));
	const groups = [...new Set(samples.map((sample) => sample.group))];
	const probes = junkProbes(items);

	const perFamily = families.map((family) => ({
		group: groupOf.get(family.kind),
		family: family.kind,
		n: family.queries.length,
		...Object.fromEntries(Object.entries(family.mrr).map(([library, mrr]) => [short(library), mrr])),
	}));

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

	return { scorecard, perFamily, probes, queries: families.map((f) => ({ family: f.kind, queries: f.queries })) };
};
