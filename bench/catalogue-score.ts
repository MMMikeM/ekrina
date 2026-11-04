import type { FamilyRow, ScorecardRow } from "./artifact.ts";
import { type CatalogueSample, junkProbes } from "./catalogue.ts";
import { configs } from "./configs.ts";
import { scoreFamilies, scoreJunk, scorecardOf } from "./mrr.ts";

/** Every library's families, junk rows and scorecard over `items`, as hits.test.ts scores a corpus. */
export const scoreCatalogue = (
	items: string[],
	samples: CatalogueSample[],
): { families: FamilyRow[]; scorecard: ScorecardRow[] } => {
	const all = configs(items);
	const families = [
		...scoreFamilies(samples, all, configs([...items].reverse())),
		...scoreJunk(junkProbes(items), all),
	];
	return { families, scorecard: scorecardOf(families, all) };
};
