import { describe, expect, it } from "vite-plus/test";
import { createSearcher, fuzzyMatch, SCORES, TYPO_PENALTY } from "../src/index";

const searcher = (list: string[]) => createSearcher(list);

describe("two edits inside one word", () => {
	it("two wrong characters in an eight-letter word", () => {
		expect(fuzzyMatch("Ergonomic Chair", "ergxnomiq")).toEqual({
			score: 2 * TYPO_PENALTY + SCORES.PREFIX,
			tier: "corrected",
			corrected: "Ergonomic",
			ranges: [[0, 8]],
		});
	});

	it("a swap and a wrong character, at a later word", () => {
		const r = fuzzyMatch("Lake Daveshire", "dacvehsire");
		expect(r?.corrected).toBe("Daveshire");
		expect(r?.score).toBeCloseTo(2 * TYPO_PENALTY + SCORES.BOUNDARY);
		expect(r?.ranges).toEqual([[5, 13]]);
	});

	it("a dropped and a doubled keystroke", () => {
		expect(fuzzyMatch("handcrafted", "handcraaftd")?.corrected).toBe("handcrafted");
	});

	it("prefers the field's first word between equal corrections", () => {
		expect(fuzzyMatch("Ergonomqx Ergonomxq", "ergonomic")?.ranges).toEqual([[0, 8]]);
	});

	it("never corrects a word under eight letters twice", () => {
		expect(fuzzyMatch("Stuart Jast", "stewart")).toBeNull();
	});

	it("never corrects three edits", () => {
		expect(fuzzyMatch("ergonomic", "erxonqmix")).toBeNull();
		expect(fuzzyMatch("ergonomic", "ergonomicxyz")).toBeNull();
	});

	it("leaves a field that already matches to the ladder", () => {
		expect(fuzzyMatch("Ergonomic Chair", "ergonomic")?.tier).toBe("prefix");
	});

	it("never reaches into text over 512 characters", () => {
		expect(fuzzyMatch(`${"word ".repeat(101)}ergonomic`, "ergxnomiq")).toBeNull();
		expect(fuzzyMatch(`${"word ".repeat(100)}ergonomic`, "ergxnomiq")?.tier).toBe("corrected");
	});

	it("finds the word among digits and trailing punctuation", () => {
		expect(fuzzyMatch("Model 2000 Ergonomic (EU)", "ergxnomiq")?.ranges).toEqual([[11, 19]]);
	});

	it("corrects a query holding a letter that never folds to ASCII", () => {
		expect(fuzzyMatch("Søndergaard ApS", "søndrgrd")?.corrected).toBe("Søndergaard");
	});

		it("finds the word in a field holding letters that never fold to ASCII", () => {
		expect(fuzzyMatch("Ørsted Ergonomic", "ergxnomiq")?.ranges).toEqual([[7, 15]]);
	});

	it("spells a decomposed field's word in its composed form", () => {
		expect(fuzzyMatch("Cafe\u0301 Ergonomic", "ergxnomiq")?.corrected).toBe("Ergonomic");
		expect(fuzzyMatch("Re\u0301sume\u0301", "rsme")?.corrected).toBe("Résumé");
	});

	it("holds a word over 64 characters to no correction", () => {
		const long = "a".repeat(70);
		expect(fuzzyMatch(`${long}bc`, `${long}xy`)).toBeNull();
	});

	it("needs a query holding a word", () => {
		expect(fuzzyMatch("!!!!!!!!", "!!!!!!!!")?.tier).toBe("exact");
		expect(fuzzyMatch("ergonomic", "--------")).toBeNull();
	});
});

describe("a word typed sparsely", () => {
	it("half its letters, in order, from its first", () => {
		expect(fuzzyMatch("Huguette Brown", "hget")).toEqual({
			score: SCORES.CONTAINS + 0.05 + 1.5 * (4 / 8) + 0.15 * 3,
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
		expect(fuzzyMatch("Port Huguette", "hgtte")?.ranges).toEqual([
			[5, 5],
			[7, 7],
			[10, 12],
		]);
	});

	it("ranks a query typed in fewer pieces first", () => {
		const search = createSearcher(["Hxgxextx", "Hagueta"]);
		expect(search("hget").map((r) => r.item)).toEqual(["Hagueta", "Hxgxextx"]);
	});

	it("must start with the word's first letter", () => {
		expect(fuzzyMatch("Huguette", "uget")).toBeNull();
	});

	it("must cover half the word", () => {
		expect(fuzzyMatch("Huguettes", "hget")).toBeNull();
	});

	it("needs four letters", () => {
		expect(fuzzyMatch("Huguette", "hgt")).toBeNull();
	});

	it("needs every letter it typed, in order", () => {
		expect(fuzzyMatch("Huguette", "hgex")).toBeNull();
		expect(fuzzyMatch("Huguette", "hteg")).toBeNull();
		expect(fuzzyMatch("Tahugex", "hget")).toBeNull();
	});

	it("needs every letter inside one word", () => {
		expect(fuzzyMatch("Hugoe Tam", "hget")).toBeNull();
	});

	it("leaves a word with one letter too many to the ladder", () => {
		const search = searcher(["East Salmacester", "Lake Salma", "Nikolaus Group", "Nikola Czajka"]);
		expect(search("salmas")[0].item).toBe("Lake Salma");
		expect(search("nikolas").map((r) => r.score)).toEqual([TYPO_PENALTY + SCORES.PREFIX, TYPO_PENALTY + SCORES.PREFIX]);
	});

	it("finds the word in an accented field", () => {
		expect(fuzzyMatch("Résumé", "rsme")?.corrected).toBe("Résumé");
	});

	it("takes the field's best-typed word", () => {
		expect(fuzzyMatch("Hagueta Hxgxextx", "hget")?.corrected).toBe("Hagueta");
	});

	it("outranks a two-edit reading of the same word", () => {
		expect(fuzzyMatch("Handcrafted", "handcrftd")?.ranges).toEqual([
			[0, 5],
			[7, 8],
			[10, 10],
		]);
	});

	it("replaces a weaker fuzzy chain on the same field", () => {
		expect(fuzzyMatch("Handcrafted", "hndcrfted")?.tier).toBe("corrected");
		expect(fuzzyMatch("Handcrafted", "hndcrfted")?.score).toBeCloseTo(
			SCORES.CONTAINS + 0.05 + 1.5 * (2 / 11) + 0.15,
		);
	});

	it("never replaces a match as typed", () => {
		expect(fuzzyMatch("Huguette", "huguet")?.tier).toBe("prefix");
	});
});

describe("a key held down", () => {
	it("costs one edit, so a short word still takes one more", () => {
		expect(fuzzyMatch("Mark Twain", "twaaain")).toEqual({
			score: SCORES.BOUNDARY + 2 * TYPO_PENALTY,
			tier: "corrected",
			corrected: "Twain",
			ranges: [[5, 9]],
		});
	});

	it("however long the run, which a gate on the letters as typed would refuse", () => {
		expect(fuzzyMatch("Mark Twain", "twaaaaaain")?.corrected).toBe("Twain");
	});

	it("keeps a double letter the word really has", () => {
		expect(fuzzyMatch("Coffee", "coffffee")).toMatchObject({
			score: SCORES.NORMALISED_EXACT + TYPO_PENALTY,
			corrected: "Coffee",
		});
	});

	it("leaves no room for two more edits", () => {
		expect(fuzzyMatch("Mark Twain", "twaaaxn")).toBeNull();
	});

	it("is read once a word, never twice", () => {
		expect(fuzzyMatch("Mark Twain", "twaaainnn")).toBeNull();
	});

	it("needs five letters once the run is cut", () => {
		expect(fuzzyMatch("Ab Lane", "aaab")).toBeNull();
	});

	it("stays out of a list where the word matches as typed", () => {
		const search = createSearcher(["Twaaain Street", "Mark Twain"]);
		expect(search("twaaain").map((r) => r.item)).toEqual(["Twaaain Street"]);
	});
});

describe("a swap in a four-letter word", () => {
	const search = (items: string[]) => createSearcher(items);

	it("is undone beside a fuzzy chain", () => {
		const items = ["Louder Than Bombs", "Taha Hussein"];
		expect(search(items)("tahn")[0]).toEqual({
			item: "Louder Than Bombs",
			score: SCORES.BOUNDARY + TYPO_PENALTY,
			fields: [{ score: SCORES.BOUNDARY + TYPO_PENALTY, tier: "corrected", corrected: "Than", ranges: [[7, 10]] }],
		});
	});

	it("finishes a longer word it starts", () => {
		expect(search(["Thanksgiving", "Taha Hussein"])("tahn")[0]?.fields[0]).toMatchObject({
			score: SCORES.PREFIX + TYPO_PENALTY,
			corrected: "Than",
		});
	});

	it("is not tried once a field matches it literally", () => {
		expect(search(["Louder Than Bombs", "Tahnee Welch"])("tahn").map((r) => r.item)).toEqual([
			"Tahnee Welch",
		]);
	});

	it("lands only at a word start", () => {
		expect(search(["Athan Street", "Taha Hussein"])("tahn").map((r) => r.item)).toEqual([
			"Taha Hussein",
		]);
	});
});

describe("a gate that only false-passes", () => {
	it("rejects a field missing three of the query's letters", () => {
		expect(fuzzyMatch("ergonomic", "ergoxyzic")).toBeNull();
	});

	it("rejects a field holding too few of a repeated letter", () => {
		expect(fuzzyMatch("pizza", "zzzzzzzz")).toBeNull();
	});
});

describe("one edit in each word of a phrase", () => {
	it("both words mistyped, priced on the tier the corrected phrase lands on", () => {
		expect(fuzzyMatch("Handcrafted Wooden Table", "handcxafted wooxen")).toEqual({
			score: 2 * TYPO_PENALTY + SCORES.PREFIX,
			tier: "corrected",
			corrected: "Handcrafted Wooden",
			ranges: [[0, 17]],
		});
		expect(fuzzyMatch("Handcrafted Wooden Table", "wooxen handcxafted")).toEqual({
			score: 2 * TYPO_PENALTY + SCORES.MULTI_WORD,
			tier: "corrected",
			corrected: "Wooden Handcrafted",
			ranges: [
				[0, 10],
				[12, 17],
			],
		});
	});

	it("keeps a word typed correctly as the caller typed it", () => {
		expect(fuzzyMatch("Small Wooden Table", "TABLE wooxen smxll")?.corrected).toBe(
			"TABLE Wooden Small",
		);
	});

	it("matches a repeated word to two field words", () => {
		expect(fuzzyMatch("Wooden Wooden", "wooxen woodxn")?.corrected).toBe("Wooden Wooden");
	});

	it("corrects a decomposed query on its composed form", () => {
		expect(fuzzyMatch("Rustic Wooden", "rustíx wooxen")?.corrected).toBe(
			"Rustic Wooden",
		);
	});

	it("refuses three edits across a phrase", () => {
		expect(fuzzyMatch("Handcrafted Wooden Tables", "handcxafted wooxen tablxs")).toBeNull();
		expect(fuzzyMatch("Handcrafted Wooden Tables", "hnadcrafted wodoen talbes")).toBeNull();
	});

	it("never corrects a word under five letters", () => {
		expect(fuzzyMatch("Handcrafted Oak Table", "handcxafted oxk")).toBeNull();
		expect(fuzzyMatch("Big Oak", "bxg oxk")).toBeNull();
	});

	it("refuses a word no field word is one edit from", () => {
		expect(fuzzyMatch("Handcrafted Wooden Table", "handcxafted plastic")).toBeNull();
		expect(fuzzyMatch("Handcrafted Wooden Table", "handcxafted nedoow")).toBeNull();
	});
});

describe("a space counts as one edit", () => {
	it("a space forgotten between two words with a typo beside it", () => {
		expect(fuzzyMatch("Lockman Dubuque", "lockmandubxque")).toEqual({
			score: 2 * TYPO_PENALTY + SCORES.NORMALISED_EXACT,
			tier: "corrected",
			corrected: "Lockman Dubuque",
			ranges: [[0, 14]],
		});
	});

	it("a space typed inside a word", () => {
		expect(fuzzyMatch("Port Catonsville", "cato nsville")).toEqual({
			score: TYPO_PENALTY + SCORES.BOUNDARY,
			tier: "corrected",
			corrected: "Catonsville",
			ranges: [[5, 15]],
		});
	});

	it("a space typed between two short halves of a word", () => {
		expect(fuzzyMatch("Hillside", "hill side")).toEqual({
			score: TYPO_PENALTY + SCORES.NORMALISED_EXACT,
			tier: "corrected",
			corrected: "Hillside",
			ranges: [[0, 7]],
		});
		expect(fuzzyMatch("Hillside Road", "hill sdie")?.corrected).toBe("Hillside");
		expect(searcher(["Database Admin", "Data Lake"])("data base").map((r) => r.item)).toEqual([
			"Database Admin",
		]);
	});

	it("a space typed inside a word, and one more mistake", () => {
		expect(fuzzyMatch("Catonsville", "cato nsvxlle")?.corrected).toBe("Catonsville");
	});

	it("never a space and two more mistakes", () => {
		expect(fuzzyMatch("Catonsville", "cato nsvxllq")).toBeNull();
		expect(fuzzyMatch("Lockman Dubuque", "lockmandxbxque")).toBeNull();
	});

	it("needs eight letters once the space is gone to fix another mistake", () => {
		expect(fuzzyMatch("Hillside", "hil sidx")).toBeNull();
	});

	it("rejoins a split word beside weaker matches", () => {
		const items = ["Mlle Anne Marty", "Marianne Lowe"];
		expect(searcher(items)("mari anne").map((r) => r.item)).toEqual(["Marianne Lowe", "Mlle Anne Marty"]);
		const typed = searcher(["Mari Annx Shop", "Marianne Lowe"])("mari annx");
		expect(typed.map((r) => r.item)).toEqual(["Mari Annx Shop"]);
	});

	it("rejoins a shorter word when the space was the only mistake", () => {
		expect(fuzzyMatch("Clinton Kub", "cli nton")?.corrected).toBe("Clinton");
		expect(fuzzyMatch("Clinton Kub", "cli ntxn")).toBeNull();
		expect(fuzzyMatch("Kristy", "kri sty")?.corrected).toBe("Kristy");
		expect(fuzzyMatch("Kristy", "kr isty")?.corrected).toBe("Kristy");
		expect(fuzzyMatch("Kris", "kr is")).toBeNull();
	});
});

describe("two edits in one word of a phrase", () => {
	it("an eight-letter phrase word mistyped twice", () => {
		expect(fuzzyMatch("Kristi Satterfield", "kristi satxerfqeld")).toEqual({
			score: 2 * TYPO_PENALTY + SCORES.NORMALISED_EXACT,
			tier: "corrected",
			corrected: "kristi Satterfield",
			ranges: [[0, 17]],
		});
	});

	it("a shorter phrase word gets one", () => {
		expect(fuzzyMatch("Kristi Wooden", "kristi woxdxn")).toBeNull();
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
		const items = search("hget.").map((r) => r.item);
		expect(items[0]).toBe("Hget. Lane");
		expect(items).toContain("Huguette Brown");
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

	it("scores each field and keeps the best", () => {
		const search = createSearcher(
			[{ title: "Hxgxextx", body: "Hagueta" }],
			[
				{ selectField: (r) => r.title },
				{ selectField: (r) => r.body },
			],
		);
		const [result] = search("hget");
		expect(result.fields.map((field) => field?.corrected)).toEqual(["Hxgxextx", "Hagueta"]);
		expect(result.score).toBe(result.fields[1]?.score);
		const [reversed] = createSearcher(
			[{ title: "Hagueta", body: "Hxgxextx" }],
			[
				{ selectField: (r) => r.title },
				{ selectField: (r) => r.body },
			],
		)("hget");
		expect(reversed.score).toBe(reversed.fields[0]?.score);
		expect(reversed.fields[1]?.corrected).toBe("Hxgxextx");
	});

	it("ranks the item a correction spells whole above one it starts", () => {
		const search = searcher(["Ergonomic Chair", "Ergonomic"]);
		expect(search("ergxnomiq").map((r) => [r.item, r.score])).toEqual([
			["Ergonomic", 2 * TYPO_PENALTY + SCORES.NORMALISED_EXACT],
			["Ergonomic Chair", 2 * TYPO_PENALTY + SCORES.PREFIX],
		]);
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
			createSearcher(items, [
				{ selectField: (r) => r.title },
				{ selectField: (r) => r.body },
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

	it("corrects a phrase in whichever field holds it", () => {
		const search = createSearcher(
			[
				{ title: "Steel Desk", body: "Handcrafted Wooden Chair" },
				{ title: "Handcrafted Wooden Table", body: "Steel" },
			],
			[
				{ selectField: (r) => r.title },
				{ selectField: (r) => r.body },
			],
		);
		expect(search("handcxafted wooxen").map((r) => r.item.title)).toEqual([
			"Steel Desk",
			"Handcrafted Wooden Table",
		]);
	});

	it("corrects a phrase holding a letter outside ASCII or an underscore", () => {
		const tiers = (list: string[], query: string) =>
			searcher(list)(query).map((r) => r.fields[0]?.tier);
		expect(tiers(["Søndergaard ApS Holding"], "søndrgaard holdixg")).toEqual(["corrected"]);
		expect(tiers(["snake_case helper"], "snake_cse helpxr")).toEqual(["corrected"]);
	});

	it("keeps a one-edit fix the literal pass never reached", () => {
		const search = searcher(["Hugte Lane", "Steel Table", "Huguette Brown", "Hugtx"]);
		expect(search("hugte").map((r) => r.item)).toEqual(["Hugte Lane", "Hugtx", "Huguette Brown"]);
	});

	it("answers afresh after a query whose field text threw", () => {
		let throwing = false;
		const search = createSearcher(
			["Hget Lane", "Huguette Brown"],
			[
				{
					selectField: (s) => {
						if (throwing && s.startsWith("Hu")) throw new Error("unreadable");
						return s;
					},
				},
			],
		);
		throwing = true;
		expect(() => search("hget")).toThrow("unreadable");
		throwing = false;
		expect(search("hget").map((r) => r.item)).toEqual(["Hget Lane", "Huguette Brown"]);
	});

	it("skips a query too short to correct twice", () => {
		expect(searcher(["Stuart Jast"])("stewart")).toEqual([]);
	});

	it("skips a query too short for any reading", () => {
		expect(searcher(["Stuart Jast"])("xyz")).toEqual([]);
	});

	it("skips an item whose field is missing", () => {
		const search = createSearcher(
			[{ name: null }, { name: "Ergonomic" }],
			[{ selectField: (r) => r.name }],
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
