/**
 * Per-field search: an array of field specs with independent acronym / demoteBy,
 * plus the FuzzyResult invariants (fields alignment, score = min).
 */
import { describe, expect, it } from "vite-plus/test";
import { createFuzzySearch, SCORES } from "../src/index";

type Post = { title: string; body: string; tags?: string[] };

describe("field specs", () => {
	it("scores each field independently", () => {
		const posts: Post[] = [{ title: "Event Loop", body: "the javascript runtime model" }];
		const r = createFuzzySearch(posts, [{ selectField: (p) => p.title }, { selectField: (p) => p.body }])(
			"loop",
		)[0]!;
		expect(r.fields[0]).toEqual({ score: 1, tier: "boundary", ranges: [[6, 9]] });
		expect(r.fields[1]).toBeNull(); // "loop" is no compact chunk assembly of the body
		expect(r.score).toBe(1);
	});

	it("demoteBy shifts the field's score and the min", () => {
		const posts: Post[] = [{ title: "cat", body: "cat" }];
		const r = createFuzzySearch(posts, [
			{ selectField: (p) => p.title },
			{ selectField: (p) => p.body, demoteBy: 2 },
		])("cat")[0]!;
		expect(r.fields[0]?.score).toBe(0); // exact
		expect(r.fields[1]?.score).toBe(2); // exact 0 demoted by 2
		expect(r.fields[1]?.tier).toBe("exact"); // tier is the raw match tier
		expect(r.score).toBe(0);
	});

	it("demoteBy keeps body from outranking title", () => {
		const posts: Post[] = [
			{ title: "Redux Toolkit stuff", body: "unrelated text" }, // A: title prefix (0.5)
			{ title: "unrelated title", body: "Redux" }, // B: body normalised-exact (0.1)
		];
		const fields = [
			{ selectField: (p: Post) => p.title },
			{ selectField: (p: Post) => p.body, demoteBy: SCORES.CONTAINS },
		];
		expect(createFuzzySearch(posts, fields)("redux")[0]!.item.title).toBe("Redux Toolkit stuff");
		// without demoteBy, the body match wins
		const unshifted = fields.map((f) => ({ selectField: f.selectField }));
		expect(createFuzzySearch(posts, unshifted)("redux")[0]!.item.title).toBe("unrelated title");
	});

	it("tolerates null field texts", () => {
		const posts: Post[] = [{ title: "hello", body: "world" }];
		const r = createFuzzySearch(posts, [{ selectField: () => null }, { selectField: (p) => p.title }])(
			"hello",
		)[0]!;
		expect(r.fields[0]).toBeNull();
		expect(r.fields[1]?.tier).toBe("exact");
	});

	it("tolerates null field texts when a correction reads the item's letter pairs", () => {
		const posts: Post[] = [{ title: "Keyboard Shortcuts", body: "settings" }];
		const r = createFuzzySearch(posts, [{ selectField: (p) => p.title }, { selectField: () => null }])(
			"kxyboard",
		)[0]!;
		expect(r.fields[0]).toMatchObject({ tier: "corrected", corrected: "keyboard" });
		expect(r.fields[1]).toBeNull();
	});

	it("acronym can be toggled per field", () => {
		const items = [{ name: "United States", note: "United States" }];
		const r = createFuzzySearch(items, [
			{ selectField: (i) => i.name, acronym: true },
			{ selectField: (i) => i.note, acronym: false },
		])("us")[0]!;
		expect(r.fields[0]?.tier).toBe("acronym");
		expect(r.fields[1]?.tier).toBe("fuzzy"); // same text, acronym off → falls to the fuzzy tier
	});
});

describe("FuzzyResult invariants", () => {
	const search = createFuzzySearch(
		[{ a: "hello world", b: "xyz" }],
		[{ selectField: (i) => i.a }, { selectField: (i) => i.b }],
	);

	it("fields is parallel to the specs, null where no match", () => {
		const r = search("world")[0]!;
		expect(r.fields).toHaveLength(2);
		expect(r.fields[0]?.tier).toBe("boundary-cased"); // all-lowercase "hello world"
		expect(r.fields[1]).toBeNull();
	});

	it("score equals the minimum of the matched fields' scores", () => {
		const r = createFuzzySearch(
			[{ a: "pineapple", b: "app store" }],
			[{ selectField: (i) => i.a }, { selectField: (i) => i.b }],
		)("app")[0]!;
		const matched = r.fields.filter((f) => f !== null).map((f) => f!.score);
		expect(r.score).toBe(Math.min(...matched));
	});
});

describe("fields that tie on score", () => {
	it("a whole word in any tied field ranks the item first", () => {
		const search = createFuzzySearch(
			[
				{ name: "Willa Young", alias: "Willow" },
				{ name: "Willa Young", alias: "Will Z" },
			],
			[{ selectField: (row) => row.name }, { selectField: (row) => row.alias }],
		);
		expect(search("will").map((result) => result.item.alias)).toEqual(["Will Z", "Willow"]);
	});
});

describe("selections the searcher rejects", () => {
	const items = ["Open Recent"];

	it("an options object, such as { getText }", () => {
		const getText = { getText: (item: string) => [item] };
		// @ts-expect-error the 1.x shape no longer type-checks either
		expect(() => createFuzzySearch(items, getText)).toThrow(
			new TypeError("createFuzzySearch takes a function or an array of field specs"),
		);
	});

	it("a field spec without selectField, such as 1.x's { text }", () => {
		const text = [{ text: (item: string) => item }];
		// @ts-expect-error the 1.x shape no longer type-checks either
		expect(() => createFuzzySearch(items, text)).toThrow(
			new TypeError("a field spec needs selectField, which replaced text in 2.0"),
		);
	});

	it("1.x's atBest, rather than ignoring it", () => {
		const atBest = [{ selectField: (item: string) => item, atBest: SCORES.CONTAINS }];
		expect(() => createFuzzySearch(items, atBest)).toThrow(
			new TypeError("atBest is demoteBy since 2.0"),
		);
	});
});
