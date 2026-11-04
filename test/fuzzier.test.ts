import { describe, expect, it } from "vite-plus/test";
import { createFuzzySearch, fuzzier, fuzzyMatch, SCORES, TYPO_PENALTY } from "../src/index";

const opt = { fuzzier };
const searcher = (list: string[]) => createFuzzySearch(list, [{ text: (s) => s, fuzzier }]);

describe("two edits inside one word", () => {
	it("two wrong characters in an eight-letter word", () => {
		expect(fuzzyMatch("Ergonomic Chair", "ergxnomiq", opt)).toEqual({
			score: 2 * TYPO_PENALTY + SCORES.PREFIX,
			tier: "corrected",
			corrected: "Ergonomic",
			ranges: [[0, 8]],
		});
	});

	it("a swap and a wrong character, at a later word", () => {
		const r = fuzzyMatch("Lake Daveshire", "dacvehsire", opt);
		expect(r?.corrected).toBe("Daveshire");
		expect(r?.score).toBeCloseTo(2 * TYPO_PENALTY + SCORES.BOUNDARY);
		expect(r?.ranges).toEqual([[5, 13]]);
	});

	it("a dropped and a doubled keystroke", () => {
		expect(fuzzyMatch("handcrafted", "handcraaftd", opt)?.corrected).toBe("handcrafted");
	});

	it("prefers the field's first word between equal corrections", () => {
		expect(fuzzyMatch("Ergonomqx Ergonomxq", "ergonomic", opt)?.ranges).toEqual([[0, 8]]);
	});

	it("is off unless imported and passed", () => {
		expect(fuzzyMatch("Ergonomic Chair", "ergxnomiq")).toBeNull();
	});

	it("never corrects a word under eight letters twice", () => {
		expect(fuzzyMatch("Stuart Jast", "stewart", opt)).toBeNull();
	});

	it("never corrects three edits", () => {
		expect(fuzzyMatch("ergonomic", "erxonqmix", opt)).toBeNull();
		expect(fuzzyMatch("ergonomic", "ergonomicxyz", opt)).toBeNull();
	});

	it("leaves a field that already matches to the ladder", () => {
		expect(fuzzyMatch("Ergonomic Chair", "ergonomic", opt)?.tier).toBe("prefix");
	});

	it("never reaches into text over 512 characters", () => {
		expect(fuzzyMatch(`${"word ".repeat(101)}ergonomic`, "ergxnomiq", opt)).toBeNull();
		expect(fuzzyMatch(`${"word ".repeat(100)}ergonomic`, "ergxnomiq", opt)?.tier).toBe("corrected");
	});

	it("finds the word among digits and trailing punctuation", () => {
		expect(fuzzyMatch("Model 2000 Ergonomic (EU)", "ergxnomiq", opt)?.ranges).toEqual([[11, 19]]);
	});

	it("corrects a query holding a letter that never folds to ASCII", () => {
		expect(fuzzyMatch("Søndergaard ApS", "søndrgrd", opt)?.corrected).toBe("Søndergaard");
	});

		it("finds the word in a field holding letters that never fold to ASCII", () => {
		expect(fuzzyMatch("Ørsted Ergonomic", "ergxnomiq", opt)?.ranges).toEqual([[7, 15]]);
	});

	it("spells a decomposed field's word in its composed form", () => {
		expect(fuzzyMatch("Cafe\u0301 Ergonomic", "ergxnomiq", opt)?.corrected).toBe("Ergonomic");
		expect(fuzzyMatch("Re\u0301sume\u0301", "rsme", opt)?.corrected).toBe("Résumé");
	});

	it("holds a word over 64 characters to no correction", () => {
		const long = "a".repeat(70);
		expect(fuzzyMatch(`${long}bc`, `${long}xy`, opt)).toBeNull();
	});

	it("needs a query holding a word", () => {
		expect(fuzzyMatch("!!!!!!!!", "!!!!!!!!", opt)?.tier).toBe("exact");
		expect(fuzzyMatch("ergonomic", "--------", opt)).toBeNull();
	});
});

describe("a word typed sparsely", () => {
	it("half its letters, in order, from its first", () => {
		expect(fuzzyMatch("Huguette Brown", "hget", opt)).toEqual({
			score: SCORES.CONTAINS + 0.05 + 0.5 * (4 / 8),
			tier: "corrected",
			corrected: "Huguette",
			ranges: [
				[0, 0],
				[2, 2],
				[4, 5],
			],
		});
	});

	it("highlights the letters typed inside a later word", () => {
		expect(fuzzyMatch("Port Huguette", "hgtte", opt)?.ranges).toEqual([
			[5, 5],
			[7, 7],
			[10, 12],
		]);
	});

	it("ranks a query typed in fewer pieces first", () => {
		const search = createFuzzySearch(["Hxgxextx", "Hagueta"], [{ text: (s) => s, fuzzier }]);
		expect(search("hget").map((r) => r.item)).toEqual(["Hagueta", "Hxgxextx"]);
	});

	it("must start with the word's first letter", () => {
		expect(fuzzyMatch("Huguette", "uget", opt)).toBeNull();
	});

	it("must cover half the word", () => {
		expect(fuzzyMatch("Huguettes", "hget", opt)).toBeNull();
	});

	it("needs four letters", () => {
		expect(fuzzyMatch("Huguette", "hgt", opt)).toBeNull();
	});

	it("needs every letter it typed, in order", () => {
		expect(fuzzyMatch("Huguette", "hgex", opt)).toBeNull();
		expect(fuzzyMatch("Huguette", "hteg", opt)).toBeNull();
		expect(fuzzyMatch("Tahugex", "hget", opt)).toBeNull();
	});

	it("needs every letter inside one word", () => {
		expect(fuzzyMatch("Hugoe Tam", "hget", opt)).toBeNull();
	});

	it("leaves a word with one letter too many to the ladder", () => {
		const search = searcher(["East Salmacester", "Lake Salma", "Nikolaus Group", "Nikola Czajka"]);
		expect(search("salmas")[0].item).toBe("Lake Salma");
		expect(search("nikolas").map((r) => r.score)).toEqual([TYPO_PENALTY + SCORES.PREFIX, TYPO_PENALTY + SCORES.PREFIX]);
	});

	it("finds the word in an accented field", () => {
		expect(fuzzyMatch("Résumé", "rsme", opt)?.corrected).toBe("Résumé");
	});

	it("takes the field's best-typed word", () => {
		expect(fuzzyMatch("Hagueta Hxgxextx", "hget", opt)?.corrected).toBe("Hagueta");
	});

	it("outranks a two-edit reading of the same word", () => {
		expect(fuzzyMatch("Handcrafted", "handcrftd", opt)?.ranges).toEqual([
			[0, 5],
			[7, 8],
			[10, 10],
		]);
	});

	it("replaces a weaker fuzzy chain on the same field", () => {
		expect(fuzzyMatch("Handcrafted", "hndcrfted")?.tier).toBe("fuzzy");
		expect(fuzzyMatch("Handcrafted", "hndcrfted", opt)?.score).toBeCloseTo(
			SCORES.CONTAINS + 0.05 + 0.5 * (2 / 11),
		);
	});

	it("never replaces a match as typed", () => {
		expect(fuzzyMatch("Huguette", "huguet", opt)?.tier).toBe("prefix");
	});
});

describe("a gate that only false-passes", () => {
	it("rejects a field missing three of the query's letters", () => {
		expect(fuzzyMatch("ergonomic", "ergoxyzic", opt)).toBeNull();
	});

	it("rejects a field holding too few of a repeated letter", () => {
		expect(fuzzyMatch("pizza", "zzzzzzzz", opt)).toBeNull();
	});
});

describe("one edit in each word of a phrase", () => {
	it("both words mistyped", () => {
		expect(fuzzyMatch("Handcrafted Wooden Table", "handcxafted wooxen", opt)).toEqual({
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
		expect(fuzzyMatch("Small Wooden Table", "TABLE wooxen smxll", opt)?.corrected).toBe(
			"TABLE Wooden Small",
		);
	});

	it("matches a repeated word to two field words", () => {
		expect(fuzzyMatch("Wooden Wooden", "wooxen woodxn", opt)?.ranges).toEqual([
			[0, 5],
			[7, 12],
		]);
	});

	it("corrects a decomposed query on its composed form", () => {
		expect(fuzzyMatch("Rustic Wooden", "rustíx wooxen", opt)?.corrected).toBe(
			"Rustic Wooden",
		);
	});

	it("refuses three edits across a phrase", () => {
		expect(fuzzyMatch("Handcrafted Wooden Tables", "handcxafted wooxen tablxs", opt)).toBeNull();
		expect(fuzzyMatch("Handcrafted Wooden Tables", "hnadcrafted wodoen talbes", opt)).toBeNull();
	});

	it("never corrects a word under five letters", () => {
		expect(fuzzyMatch("Handcrafted Oak Table", "handcxafted oxk", opt)).toBeNull();
		expect(fuzzyMatch("Big Oak", "bxg oxk", opt)).toBeNull();
	});

	it("refuses a word no field word is one edit from", () => {
		expect(fuzzyMatch("Handcrafted Wooden Table", "handcxafted plastic", opt)).toBeNull();
		expect(fuzzyMatch("Handcrafted Wooden Table", "handcxafted nedoow", opt)).toBeNull();
	});
});

describe("a space counts as one edit", () => {
	it("a space forgotten between two words with a typo beside it", () => {
		expect(fuzzyMatch("Lockman Dubuque", "lockmandubxque", opt)).toEqual({
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
		expect(fuzzyMatch("Port Catonsville", "cato nsville", opt)).toEqual({
			score: TYPO_PENALTY + SCORES.BOUNDARY,
			tier: "corrected",
			corrected: "Catonsville",
			ranges: [[5, 15]],
		});
	});

	it("a space typed inside a word, and one more mistake", () => {
		expect(fuzzyMatch("Catonsville", "cato nsvxlle", opt)?.corrected).toBe("Catonsville");
	});

	it("never a space and two more mistakes", () => {
		expect(fuzzyMatch("Catonsville", "cato nsvxllq", opt)).toBeNull();
		expect(fuzzyMatch("Lockman Dubuque", "lockmandxbxque", opt)).toBeNull();
	});

	it("needs eight letters once the space is gone", () => {
		expect(fuzzyMatch("Hillside", "hil sidx", opt)).toBeNull();
	});
});

describe("two edits in one word of a phrase", () => {
	it("an eight-letter phrase word mistyped twice", () => {
		expect(fuzzyMatch("Kristi Satterfield", "kristi satxerfqeld", opt)).toEqual({
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
		expect(fuzzyMatch("Kristi Wooden", "kristi woxdxn", opt)).toBeNull();
	});
});

describe("in a searcher", () => {
	it("joins the results while fewer than ten items match as typed", () => {
		const search = searcher(["Huguette Brown", "Hget Lane"]);
		expect(search("hget").map((r) => [r.item, r.fields[0]?.tier])).toEqual([
			["Hget Lane", "prefix"],
			["Huguette Brown", "corrected"],
		]);
		const crowded = searcher([...Array.from({ length: 10 }, (_, k) => `Hget ${k}`), "Huguette"]);
		expect(crowded("hget")).toHaveLength(10);
		expect(crowded("hget", { limit: 3 })).toHaveLength(3);
	});

	it("joins them keystroke by keystroke", () => {
		const search = searcher(["Hget Lane", "Huguette Brown", "Hugo"]);
		for (const prefix of ["h", "hg", "hge"]) search(prefix);
		expect(search("hget").map((r) => r.item)).toEqual(["Hget Lane", "Huguette Brown"]);
	});

	it("joins them once a keystroke adds punctuation", () => {
		const hgets = Array.from({ length: 10 }, (_, k) => `Hget ${k}`);
		const search = searcher([...hgets, "Hget. Lane", "Huguette Brown"]);
		search("hget");
		expect(search("hget.").map((r) => r.item).slice(0, 2)).toEqual(["Hget. Lane", "Huguette Brown"]);
	});

	it("replaces a weaker result on the same item", () => {
		const search = searcher(["Handcrafted"]);
		expect(search("hndcrfted")[0].fields[0]?.tier).toBe("corrected");
	});

	it("keeps a correction that already scores better", () => {
		expect(searcher(["huguette"])("hugutte")[0].fields[0]).toEqual({
			score: TYPO_PENALTY,
			tier: "corrected",
			corrected: "huguette",
			ranges: [[0, 7]],
		});
	});

	it("corrects a phrase only when nothing matches it", () => {
		const search = searcher(["Handcrafted Wooden Chair", "Handcraxted Wooxen Table"]);
		expect(search("handcrafted wooden").map((r) => r.item)).toEqual(["Handcrafted Wooden Chair"]);
	});

		it("scores each field that opts in and keeps the best", () => {
		const search = createFuzzySearch(
			[{ title: "Hxgxextx", body: "Hagueta" }],
			[
				{ text: (r) => r.title, fuzzier },
				{ text: (r) => r.body, fuzzier },
			],
		);
		const [result] = search("hget");
		expect(result.fields.map((field) => field?.corrected)).toEqual(["Hxgxextx", "Hagueta"]);
		expect(result.score).toBe(result.fields[1]?.score);
		const [reversed] = createFuzzySearch(
			[{ title: "Hagueta", body: "Hxgxextx" }],
			[
				{ text: (r) => r.title, fuzzier },
				{ text: (r) => r.body, fuzzier },
			],
		)("hget");
		expect(reversed.score).toBe(reversed.fields[0]?.score);
		expect(reversed.fields[1]?.corrected).toBe("Hxgxextx");
	});

	it("corrects a list that matches nothing", () => {
		const search = searcher(["Ergonomic Chair", "Ergonomic Desk", "Rustic Steel Pizza"]);
		expect(search("ergxnomiq").map((r) => r.item)).toEqual(["Ergonomic Chair", "Ergonomic Desk"]);
		expect(search("rustix stexl")[0].fields[0]?.corrected).toBe("Rustic Steel");
		expect(search("pizza").map((r) => r.fields[0]?.tier)).toEqual(["boundary"]);
	});

	it("breaks a tie between its matches by list order", () => {
		for (const items of [
			["Hxgxet", "Hgueet"],
			["Hgueet", "Hxgxet"],
		]) {
			expect(searcher(items)("hget").map((r) => r.item)).toEqual(items);
		}
	});

	it("ranks an item by where its best field's match ends", () => {
		const bodies = (items: { title: string; body: string }[]) =>
			createFuzzySearch(items, [
				{ text: (r) => r.title, fuzzier },
				{ text: (r) => r.body, fuzzier },
			])("hget").map((r) => r.item.body);
		const beaten = [
			{ title: "Hxgxet", body: "Hgueetx" },
			{ title: "Hxgxet", body: "zzz" },
		];
		expect(bodies(beaten)).toEqual(["Hgueetx", "zzz"]);
		const tied = [
			{ title: "Hxgxetx", body: "Hxgxxet" },
			{ title: "Hxgxxet", body: "zzz" },
		];
		expect(bodies(tied)).toEqual(["Hxgxxet", "zzz"]);
	});

	it("keeps a one-edit fix the literal pass never reached", () => {
		const search = searcher(["Hugte Lane", "Steel Table", "Huguette Brown", "Hugtx"]);
		expect(search("hugte").map((r) => r.item)).toEqual(["Hugte Lane", "Hugtx", "Huguette Brown"]);
	});

	it("answers afresh after a query whose field text threw", () => {
		let throwing = false;
		const search = createFuzzySearch(
			["Hget Lane", "Huguette Brown"],
			[
				{
					text: (s) => {
						if (throwing && s.startsWith("Hu")) throw new Error("unreadable");
						return s;
					},
					fuzzier,
				},
			],
		);
		throwing = true;
		expect(() => search("hget")).toThrow("unreadable");
		throwing = false;
		expect(search("hget").map((r) => r.item)).toEqual(["Hget Lane", "Huguette Brown"]);
	});

	it("is off when a caller passes `false` or `null` for it", () => {
		const off = [false, null] as unknown as undefined[];
		for (const fuzzier of off) {
			expect(fuzzyMatch("Ergonomic", "ergxnomiq", { fuzzier })).toBeNull();
			expect(createFuzzySearch(["Ergonomic"], [{ text: (s) => s, fuzzier }])("ergo")).toHaveLength(1);
		}
	});

	it("is off unless a field opts in", () => {
		expect(createFuzzySearch(["Ergonomic Chair"])("ergxnomiq")).toEqual([]);
		const search = createFuzzySearch(
			[{ title: "Ergonomic Chair", body: "Ergonomic" }],
			[{ text: (r) => r.title }, { text: (r) => r.body, fuzzier, atBest: 1 }],
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

	it("skips a query too short for any reading", () => {
		expect(searcher(["Stuart Jast"])("xyz")).toEqual([]);
	});

	it("skips an item whose field is missing", () => {
		const search = createFuzzySearch(
			[{ name: null }, { name: "Ergonomic" }],
			[{ text: (r) => r.name, fuzzier }],
		);
		expect(search("ergxnomiq").map((r) => r.item.name)).toEqual(["Ergonomic"]);
		expect(search("________")).toEqual([]);
	});

	it("lets an accented item through the check on its raw text", () => {
		expect(searcher(["Ergönomic Chair"])("ergxnomiq")[0].fields[0]?.corrected).toBe("Ergönomic");
		expect(searcher(["Ergonomíc"])("ergonxmiq")[0].fields[0]?.corrected).toBe("Ergonomíc");
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
