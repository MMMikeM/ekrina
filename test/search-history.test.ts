import { describe, expect, it } from "vite-plus/test";
import { createFuzzySearch } from "../src/index";

const typing = (query: string): string[] =>
	Array.from({ length: query.length }, (_, k) => query.slice(0, k + 1));

const backspacing = (from: string, to: string): string[] =>
	Array.from({ length: from.length - to.length }, (_, k) => from.slice(0, from.length - k - 1));

type Session = { name: string; queries: string[] };

const replaysEachSession = (list: string[], sessions: Session[]): void => {
	for (const { name, queries } of sessions) {
		it(name, () => {
			const search = createFuzzySearch(list);
			for (const query of queries) {
				expect(search(query), query).toEqual(createFuzzySearch(list)(query));
			}
		});

		it(`${name}, with the index built first`, () => {
			const search = createFuzzySearch(list);
			search.buildIndex();
			for (const query of queries) {
				expect(search(query), query).toEqual(createFuzzySearch(list)(query));
			}
		});
	}
};

describe("a searcher answers every query as a fresh one would, whatever came before", () => {
	describe("with ten literal hits and a correction competing for the page", () => {
		// "statsu" is one adjacent swap from "status". The target comes first so
		// a fresh searcher reaches it before the budget can run out.
		const list = [
			"Weekly status report",
			...Array.from({ length: 10 }, (_, i) => `Statsu report draft ${i + 1}`),
		];

		it("the dead ends below really match nothing", () => {
			const search = createFuzzySearch(list);
			expect(search("statsu reportqz")).toEqual([]);
			expect(search("qqzz")).toEqual([]);
		});

		replaysEachSession(list, [
			{ name: "typing the query key by key", queries: typing("statsu report") },
			{ name: "the same query twice", queries: ["statsu report", "statsu report"] },
			{
				name: "backspacing out of a dead end",
				queries: ["statsu reportqz", ...backspacing("statsu reportqz", "statsu report")],
			},
			{ name: "after a query with no matches", queries: ["qqzz", "statsu report"] },
			{
				name: "backspacing from a longer phrase",
				queries: ["statsu report draft", ...backspacing("statsu report draft", "statsu report")],
			},
			{ name: "growing one word into a phrase", queries: ["statsu", "statsu report"] },
			{ name: "shrinking a phrase to one word", queries: ["statsu report", "statsu"] },
			{ name: "replacing the query outright", queries: ["weekly", "statsu report"] },
		]);
	});

	describe("with every query word four characters long", () => {
		const list = ["Soft Gold Hat", "Soft Gold Ball", "Gold Leaf Frame", "Softball Glove"];

		it("the dead end below really matches nothing", () => {
			expect(createFuzzySearch(list)("sfot goldqz")).toEqual([]);
		});

		replaysEachSession(list, [
			{ name: "typing the query key by key", queries: typing("sfot gold") },
			{ name: "the same query twice", queries: ["sfot gold", "sfot gold"] },
			{
				name: "backspacing out of a dead end",
				queries: ["sfot goldqz", ...backspacing("sfot goldqz", "sfot gold")],
			},
			{ name: "growing one word into a phrase", queries: ["sfot", "sfot gold"] },
			{ name: "shrinking a phrase to one word", queries: ["sfot gold", "sfot"] },
		]);
	});

	describe("with every query word under four characters", () => {
		const list = ["Big Oak Table", "Big Oak Chair", "Red Box", "Oakley Bag"];

		replaysEachSession(list, [
			{ name: "typing the query key by key", queries: typing("bg oak") },
			{ name: "the same query twice", queries: ["bg oak", "bg oak"] },
			{ name: "backspacing from a longer phrase", queries: ["bg oak t", "bg oak "] },
		]);
	});
});
