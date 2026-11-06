/**
 * createSearcher: string arrays, the selectField overload, sort order, stability.
 * (Per-field specs + demoteBy live in fields.test.ts.)
 */
import { describe, expect, it } from "vite-plus/test";
import { createSearcher, fuzzyMatch } from "../src/index";

describe("string collections", () => {
	const search = createSearcher(["apple", "banana", "cherry", "grape"]);

	it("returns matching items with how each matched", () => {
		expect(search("ban")).toEqual([
			{ item: "banana", score: 0.5, tier: "prefix", ranges: [[0, 2]], text: "banana" },
		]);
	});

	it("excludes non-matching items", () => {
		expect(search("xyz")).toEqual([]);
	});

	it("empty collection → []", () => {
		expect(createSearcher([])("anything")).toEqual([]);
	});

	it("an empty object of fields means nothing to search, so every query → []", () => {
		expect(createSearcher(["apple"], {})("apple")).toEqual([]);
	});
});

describe("empty and whitespace queries", () => {
	const search = createSearcher(["apple"]);
	it.each([[""], ["   "], ["\t"]])("query %j → []", (query) => {
		expect(search(query)).toEqual([]);
	});
});

describe("one-character queries", () => {
	const search = createSearcher(["apple", "apricot", "banana"]);

	it("a single character matches where it starts a word", () => {
		expect(search("a").map((r) => r.item)).toEqual(["apple", "apricot"]);
		expect(createSearcher(["a"])("a")[0]?.tier).toBe("exact");
	});

	it("a single character never matches inside a word", () => {
		expect(search("n")).toEqual([]);
		expect(fuzzyMatch("banana", "n")).toBeNull();
		expect(fuzzyMatch("apple", "a")?.tier).toBe("prefix");
	});

	it("two characters match anywhere again", () => {
		expect(search("an").map((r) => r.item)).toEqual(["banana"]);
	});
});

describe("ordering within a score", () => {
	it("a whole word ranks before the longer words it starts", () => {
		const search = createSearcher(["Willa Corkery", "Williamson", "Will Smith"]);
		expect(search("will").map((r) => [r.item, r.score])).toEqual([
			["Will Smith", 0.5],
			["Willa Corkery", 0.5],
			["Williamson", 0.5],
		]);
	});

	it("list order still breaks ties between whole words", () => {
		const search = createSearcher(["Will Jones", "Will Smith"]);
		expect(search("will").map((r) => r.item)).toEqual(["Will Jones", "Will Smith"]);
	});
});

describe("limit", () => {
	const words = ["alpha", "alpine", "palace", "salad", "plaza", "lapel", "atlas", "apple", "pal"];
	const search = createSearcher(words);

	it("returns what slicing the full results returns", () => {
		for (const query of ["al", "pal", "apl", "lpa", "alpah", "a", "zz"]) {
			for (const limit of [1, 2, 3, 50]) {
				expect(search(query, { limit }), `${query} limit ${limit}`).toEqual(
					createSearcher(words)(query).slice(0, limit),
				);
			}
		}
	});

	it("must be a positive integer", () => {
		for (const limit of [0, -1, 1.5, Number.NaN]) {
			expect(() => search("al", { limit })).toThrow(RangeError);
		}
	});
});

describe("selectField overload", () => {
	const users = [
		{ id: 1, name: "John Doe" },
		{ id: 2, name: "Jane Smith" },
	];

	it("searches the extracted text; item is the original reference", () => {
		createSearcher(users, (u) => u.name)("john");
		const results = createSearcher(users, (u) => u.name)("john");
		expect(results).toHaveLength(1);
		expect(results[0]!.item).toBe(users[0]);
		expect(results[0]).toMatchObject({ score: 0.5, tier: "prefix", ranges: [[0, 3]], text: "John Doe" });
	});

	it("skips items whose text is null", () => {
		const collection: Array<{ name?: string }> = [{ name: "apple" }, { name: undefined }];
		const results = createSearcher(collection, (i) => i.name ?? null)("app");
		expect(results).toHaveLength(1);
		expect(results[0]!.item).toBe(collection[0]);
	});
});

describe("sort order — full tier ladder in one search", () => {
	const collection = [
		"evergreen teapot", // contains (2)
		"tea garden green", // multi-word (1.5)
		"green tea", // exact (0)
		"greedy nectar team", // fuzzy (>2)
		"iced Green Tea", // boundary (1)
		"green tea ice cream", // prefix (0.5)
		"Green Tea", // normalised-exact (0.1)
		"matcha green tea", // boundary-cased (0.9)
	];
	const results = createSearcher(collection)("green tea");

	it("walks the ladder in order", () => {
		expect(results.map((r) => r.item)).toEqual([
			"green tea",
			"Green Tea",
			"green tea ice cream",
			"matcha green tea",
			"iced Green Tea",
			"tea garden green",
			"evergreen teapot",
			"greedy nectar team",
		]);
	});

	it("scores are non-decreasing", () => {
		for (let i = 1; i < results.length; i++) {
			expect(results[i]!.score).toBeGreaterThanOrEqual(results[i - 1]!.score);
		}
	});
});

describe("sort stability", () => {
	it("equal scores preserve collection order", () => {
		expect(createSearcher(["banana", "bandana"])("ban").map((r) => r.item)).toEqual([
			"banana",
			"bandana",
		]);
		expect(createSearcher(["bandana", "banana"])("ban").map((r) => r.item)).toEqual([
			"bandana",
			"banana",
		]);
	});
});

describe("prefix-narrowing cache", () => {
	const collection = [
		"the quick brown fox",
		"quick silver",
		"brown bread",
		"fox trot",
		"Señor García",
		"unrelated zebra",
	];

	it("typing a query char by char matches a fresh searcher at every step", () => {
		const typed = createSearcher(collection);
		for (const q of ["b", "br", "bro", "brow", "brown", "brown f", "brown fo", "brown fox"]) {
			expect(typed(q)).toEqual(createSearcher(collection)(q));
		}
	});

	it("a correction appears once the query is long enough to correct", () => {
		// "bor" is too short to correct and no item holds it as a subsequence, so
		// nothing survives it; "borw" is one swap from "brow", and the narrowed
		// rescan must not lose it.
		const search = createSearcher(collection);
		expect(search("bor").map((r) => r.item)).toEqual([]);
		expect(search("borw").map((r) => r.item)).toEqual(["brown bread", "the quick brown fox"]);
	});

	it("non-extension queries (backspace, replacement) fall back to a full scan", () => {
		const search = createSearcher(collection);
		expect(search("quick brown")).toHaveLength(1);
		expect(search("quick")).toHaveLength(2); // shorter than the cached query
		expect(search("garcia")).toHaveLength(1); // unrelated replacement
		expect(search("zebra")).toHaveLength(1);
	});

	it("repeating the same query returns identical results", () => {
		const search = createSearcher(collection);
		expect(search("quick")).toEqual(search("quick"));
	});
});

describe("unicode", () => {
	it("diacritic-insensitive match", () => {
		const r = createSearcher(["Señor García"], (s) => s)("garcia")[0]!;
		expect(r.score).toBe(1);
		expect(r?.ranges).toEqual([[6, 11]]);
	});

	it("normalised-exact for special characters", () => {
		expect(createSearcher(["Łódź"])("lodz")[0]!.score).toBe(0.1);
	});

	it("finds a mid-word match whose accent is a separate combining mark", () => {
		const decomposed = "Re\u0301sume\u0301";
		expect(fuzzyMatch(decomposed, "esum")?.tier).toBe("contains");
		expect(createSearcher([decomposed])("esum").map((r) => r?.tier)).toEqual([
			"contains",
		]);
	});
});
