import { type FuzzySearcher, type MatchOptions, createFuzzySearch, fuzzier } from "../src/index";

type Mode = {
	name: string;
	options: MatchOptions;
	searcher: (list: string[]) => FuzzySearcher<string>;
};

// An invariant holds whether or not a caller opts in, so the suites that pin
// one run in both modes.
export const MODES: Mode[] = [
	{ name: "by default", options: {}, searcher: (list) => createFuzzySearch(list) },
	{
		name: "with fuzzier",
		options: { fuzzier },
		searcher: (list) => createFuzzySearch(list, [{ text: (item) => item, fuzzier }]),
	},
];
