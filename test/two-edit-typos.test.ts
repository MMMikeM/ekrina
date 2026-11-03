import { describe, expect, it } from "vite-plus/test";
import { createFuzzySearch, fuzzyMatch, SCORES, TYPO_PENALTY, twoEditTypos } from "../src/index";

const typos = { typos: twoEditTypos };
const searcher = (list: string[]) => createFuzzySearch(list, [{ text: (s) => s, typos: twoEditTypos }]);

describe("two edits inside one word", () => {
	it("two wrong characters in an eight-letter word", () => {
		expect(fuzzyMatch("Ergonomic Chair", "ergxnomiq", typos)).toEqual({
			score: 2 * TYPO_PENALTY + SCORES.PREFIX,
			tier: "corrected",
			corrected: "Ergonomic",
			ranges: [[0, 8]],
		});
	});

	it("a swap and a wrong character, at a later word", () => {
		const r = fuzzyMatch("Lake Daveshire", "dacvehsire", typos);
		expect(r?.corrected).toBe("Daveshire");
		expect(r?.score).toBeCloseTo(2 * TYPO_PENALTY + SCORES.BOUNDARY);
		expect(r?.ranges).toEqual([[5, 13]]);
	});

	it("a dropped and a doubled keystroke", () => {
		expect(fuzzyMatch("handcrafted", "handcraaftd", typos)?.corrected).toBe("handcrafted");
	});

	it("prefers the field's first word between equal corrections", () => {
		expect(fuzzyMatch("Ergonomqx Ergonomxq", "ergonomic", typos)?.ranges).toEqual([[0, 8]]);
	});

	it("is off unless imported and passed", () => {
		expect(fuzzyMatch("Ergonomic Chair", "ergxnomiq")).toBeNull();
	});

	it("never corrects a word under eight letters twice", () => {
		expect(fuzzyMatch("Stuart Jast", "stewart", typos)).toBeNull();
	});

	it("never corrects three edits", () => {
		expect(fuzzyMatch("ergonomic", "erxonqmix", typos)).toBeNull();
		expect(fuzzyMatch("ergonomic", "ergonomicxyz", typos)).toBeNull();
	});

	it("leaves a field that already matches to the ladder", () => {
		expect(fuzzyMatch("Ergonomic Chair", "ergonomic", typos)?.tier).toBe("prefix");
	});

	it("never reaches into text over 512 characters", () => {
		expect(fuzzyMatch(`${"word ".repeat(101)}ergonomic`, "ergxnomiq", typos)).toBeNull();
		expect(fuzzyMatch(`${"word ".repeat(100)}ergonomic`, "ergxnomiq", typos)?.tier).toBe("corrected");
	});

	it("spells a decomposed field's word in its composed form", () => {
		const r = fuzzyMatch("Café Ergonomic", "ergxnomiq", typos);
		expect(r?.corrected).toBe("ergonomic");
	});

	it("holds a word over 64 characters to no correction", () => {
		const long = "a".repeat(70);
		expect(fuzzyMatch(`${long}bc`, `${long}xy`, typos)).toBeNull();
	});

	it("needs a query holding a word", () => {
		expect(fuzzyMatch("!!!!!!!!", "!!!!!!!!", typos)?.tier).toBe("exact");
		expect(fuzzyMatch("ergonomic", "--------", typos)).toBeNull();
	});
});

describe("a gate that only false-passes", () => {
	it("rejects a field missing three of the query's letters", () => {
		expect(fuzzyMatch("ergonomic", "ergoxyzic", typos)).toBeNull();
	});

	it("rejects a field holding too few of a repeated letter", () => {
		expect(fuzzyMatch("pizza", "zzzzzzzz", typos)).toBeNull();
	});
});

describe("one edit in each word of a phrase", () => {
	it("both words mistyped", () => {
		expect(fuzzyMatch("Handcrafted Wooden Table", "handcxafted wooxen", typos)).toEqual({
			score: 2 * TYPO_PENALTY + SCORES.MULTI_WORD,
			tier: "corrected",
			corrected: "Handcrafted Wooden",
			ranges: [
				[0, 10],
				[12, 17],
			],
		});
	});

	it("keeps a word typed correctly as the caller typed it", () => {
		expect(fuzzyMatch("Small Wooden Table", "TABLE wooxen smxll", typos)?.corrected).toBe(
			"TABLE Wooden Small",
		);
	});

	it("matches a repeated word to two field words", () => {
		expect(fuzzyMatch("Wooden Wooden", "wooxen woodxn", typos)?.ranges).toEqual([
			[0, 5],
			[7, 12],
		]);
	});

	it("corrects a decomposed query on its composed form", () => {
		expect(fuzzyMatch("Rustic Wooden", "rustíx wooxen", typos)?.corrected).toBe(
			"Rustic Wooden",
		);
	});

	it("refuses three edits across a phrase", () => {
		expect(fuzzyMatch("Handcrafted Wooden Tables", "handcxafted wooxen tablxs", typos)).toBeNull();
		expect(fuzzyMatch("Handcrafted Wooden Tables", "hnadcrafted wodoen talbes", typos)).toBeNull();
	});

	it("never corrects a word under five letters", () => {
		expect(fuzzyMatch("Handcrafted Oak Table", "handcxafted oxk", typos)).toBeNull();
		expect(fuzzyMatch("Big Oak", "bxg oxk", typos)).toBeNull();
	});

	it("refuses a word no field word is one edit from", () => {
		expect(fuzzyMatch("Handcrafted Wooden Table", "handcxafted plastic", typos)).toBeNull();
		expect(fuzzyMatch("Handcrafted Wooden Table", "handcxafted nedoow", typos)).toBeNull();
	});
});

describe("a space counts as one edit", () => {
	it("a space forgotten between two words with a typo beside it", () => {
		expect(fuzzyMatch("Lockman Dubuque", "lockmandubxque", typos)).toEqual({
			score: 2 * TYPO_PENALTY + SCORES.PREFIX,
			tier: "corrected",
			corrected: "Lockman Dubuque",
			ranges: [
				[0, 6],
				[8, 14],
			],
		});
	});

	it("a space typed inside a word", () => {
		expect(fuzzyMatch("Port Catonsville", "cato nsville", typos)).toEqual({
			score: TYPO_PENALTY + SCORES.BOUNDARY,
			tier: "corrected",
			corrected: "Catonsville",
			ranges: [[5, 15]],
		});
	});

	it("a space typed inside a word, and one more mistake", () => {
		expect(fuzzyMatch("Catonsville", "cato nsvxlle", typos)?.corrected).toBe("Catonsville");
	});

	it("never a space and two more mistakes", () => {
		expect(fuzzyMatch("Catonsville", "cato nsvxllq", typos)).toBeNull();
		expect(fuzzyMatch("Lockman Dubuque", "lockmandxbxque", typos)).toBeNull();
	});

	it("needs eight letters once the space is gone", () => {
		expect(fuzzyMatch("Hillside", "hil sidx", typos)).toBeNull();
	});
});

describe("two edits in one word of a phrase", () => {
	it("an eight-letter phrase word mistyped twice", () => {
		expect(fuzzyMatch("Kristi Satterfield", "kristi satxerfqeld", typos)).toEqual({
			score: 2 * TYPO_PENALTY + SCORES.MULTI_WORD,
			tier: "corrected",
			corrected: "kristi Satterfield",
			ranges: [
				[0, 5],
				[7, 17],
			],
		});
	});

	it("a shorter phrase word gets one", () => {
		expect(fuzzyMatch("Kristi Wooden", "kristi woxdxn", typos)).toBeNull();
	});
});

describe("in a searcher", () => {
	it("corrects only once nothing in the list matches", () => {
		const search = searcher(["Ergonomic Chair", "Ergonomic Desk", "Rustic Steel Pizza"]);
		expect(search("ergxnomiq").map((r) => r.item)).toEqual(["Ergonomic Chair", "Ergonomic Desk"]);
		expect(search("rustix stexl")[0].fields[0]?.corrected).toBe("Rustic Steel");
		expect(search("pizza").map((r) => r.fields[0]?.tier)).toEqual(["boundary"]);
	});

	it("is off unless a field opts in", () => {
		expect(createFuzzySearch(["Ergonomic Chair"])("ergxnomiq")).toEqual([]);
		const search = createFuzzySearch(
			[{ title: "Ergonomic Chair", body: "Ergonomic" }],
			[{ text: (r) => r.title }, { text: (r) => r.body, typos: twoEditTypos, atBest: 1 }],
		);
		expect(search("ergxnomiq")[0].fields).toEqual([
			null,
			{
				score: 2 * TYPO_PENALTY + SCORES.PREFIX + 1,
				tier: "corrected",
				corrected: "Ergonomic",
				ranges: [[0, 8]],
			},
		]);
	});

	it("skips a query too short to correct twice", () => {
		expect(searcher(["Stuart Jast"])("stewart")).toEqual([]);
	});

	it("highlights a padded field in its own offsets", () => {
		expect(searcher(["  Ergonomic"])("ergxnomiq")[0].fields[0]?.ranges).toEqual([[2, 10]]);
	});

	it("keeps narrowing on the next keystroke", () => {
		const search = searcher(["Ergonomic Chair", "Rustic Steel Pizza"]);
		expect(search("ergxnomi")).toHaveLength(1);
		expect(search("ergxnomiq").map((r) => r.item)).toEqual(["Ergonomic Chair"]);
		expect(search("ergo").map((r) => r.item)).toEqual(["Ergonomic Chair"]);
	});
});
