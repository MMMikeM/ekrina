import { describe, expect, it } from "vite-plus/test";
import { createSearcher, isLiteral, SCORES } from "../src/index";

type Post = { title: string; body: string };

describe("named fields", () => {
	it("a result names the field that matched best, with the text its ranges index", () => {
		const posts: Post[] = [{ title: "Event Loop", body: "the javascript runtime model" }];
		const r = createSearcher(posts, { title: (p) => p.title, body: (p) => p.body })("loop")[0];
		expect(r).toEqual({
			item: posts[0],
			score: 1,
			field: "title",
			tier: "boundary",
			ranges: [[6, 9]],
			text: "Event Loop",
			fields: { title: { tier: "boundary", ranges: [[6, 9]], text: "Event Loop" } },
		});
	});

	it("fields holds every field that matched, in the order they were named, guesses included", () => {
		const commands = [{ title: "Toggle Terminal", keywords: "tgl terminal" }];
		const r = createSearcher(commands, {
			title: (c) => c.title,
			keywords: { selectField: (c) => c.keywords, demoteBy: SCORES.CONTAINS },
		})("tgl")[0];
		expect(r?.field).toBe("keywords");
		expect(r?.fields).toEqual({
			title: { tier: "fuzzy", ranges: [[0, 0], [3, 4]], text: "Toggle Terminal" },
			keywords: { tier: "prefix", ranges: [[0, 2]], text: "tgl terminal" },
		});
		expect(Object.keys(r?.fields ?? {})).toEqual(["title", "keywords"]);
		expect(r?.fields.title && isLiteral(r.fields.title)).toBe(false);
	});

	it("a field keeps its best match when a later reading offers a worse one", () => {
		const r = createSearcher([{ a: "Jhelum", b: "x" }], { a: (i) => i.a, b: (i) => i.b })("jheum")[0];
		expect(r?.fields).toEqual({
			a: { tier: "corrected", corrected: "jhelum", ranges: [[0, 5]], text: "Jhelum" },
		});
	});

	it("demoteBy ranks a field lower without changing how it matched", () => {
		const posts: Post[] = [{ title: "dog", body: "cat" }];
		const r = createSearcher(posts, {
			title: (p) => p.title,
			body: { selectField: (p) => p.body, demoteBy: 2 },
		})("cat")[0];
		expect(r).toMatchObject({ score: 2, field: "body", tier: "exact", ranges: [[0, 2]], text: "cat" });
		expect(r && isLiteral(r)).toBe(true);
	});

	it("demoteBy keeps body from outranking title", () => {
		const posts: Post[] = [
			{ title: "Redux Toolkit stuff", body: "unrelated text" },
			{ title: "unrelated title", body: "Redux" },
		];
		const demoted = createSearcher(posts, {
			title: (p) => p.title,
			body: { selectField: (p) => p.body, demoteBy: SCORES.CONTAINS },
		});
		expect(demoted("redux")[0]?.item.title).toBe("Redux Toolkit stuff");
		const level = createSearcher(posts, { title: (p) => p.title, body: (p) => p.body });
		expect(level("redux")[0]?.item.title).toBe("unrelated title");
	});

	it("a better match in a demoted field loses to a weaker one undemoted", () => {
		const items = [{ a: "pineapple", b: "app store" }];
		const two = (demoteBy: number) =>
			createSearcher(items, { a: (i) => i.a, b: { selectField: (i) => i.b, demoteBy } })("app")[0];
		expect(two(0)).toMatchObject({ score: 0.5, field: "b", tier: "prefix" });
		expect(two(2)).toMatchObject({ score: 2, field: "a", tier: "contains" });
	});

	it("tolerates null field texts", () => {
		const posts: Post[] = [{ title: "hello", body: "world" }];
		const r = createSearcher(posts, { none: () => null, title: (p) => p.title })("hello")[0];
		expect(r).toMatchObject({ field: "title", tier: "exact" });
	});

	it("tolerates null field texts when a correction reads the item's letter pairs", () => {
		const posts: Post[] = [{ title: "Keyboard Shortcuts", body: "settings" }];
		const r = createSearcher(posts, { title: (p) => p.title, none: () => null })("kxyboard")[0];
		expect(r).toMatchObject({ field: "title", tier: "corrected", corrected: "keyboard" });
	});

	it("acronym can be toggled per field", () => {
		const items = [{ name: "United States", note: "United States" }];
		const r = createSearcher(items, {
			note: (i) => i.note,
			name: { selectField: (i) => i.name, acronym: true },
		})("us")[0];
		// The same text without acronyms only reaches the fuzzy tier, above 2.
		expect(r).toMatchObject({ field: "name", tier: "acronym" });
	});

	it("an empty object of fields searches nothing", () => {
		expect(createSearcher(["cat"], {})("cat")).toEqual([]);
	});
});

describe("a single-field search", () => {
	it("has no field name, and its text is the item's", () => {
		expect(createSearcher(["Open Recent"])("open")[0]).toEqual({
			item: "Open Recent",
			score: 0.5,
			tier: "prefix",
			ranges: [[0, 3]],
			text: "Open Recent",
		});
	});

	it("takes a spec when its one field needs options, and still names none", () => {
		const r = createSearcher([{ name: "United States" }], {
			selectField: (c) => c.name,
			acronym: true,
		})("us")[0];
		expect(r).toEqual({
			item: { name: "United States" },
			score: SCORES.ACRONYM,
			tier: "acronym",
			ranges: [
				[0, 0],
				[7, 7],
			],
			text: "United States",
		});
	});
});

describe("a tie between fields", () => {
	const two = (a: string, b: string) =>
		createSearcher([{ a, b }], { a: (i) => i.a, b: (i) => i.b })("cat")[0];

	it("goes to the field whose match ends on a word boundary", () => {
		expect(two("catalog", "cat food")).toMatchObject({ score: 0.5, field: "b" });
	});

	it("then to the field named first", () => {
		expect(two("cat food", "cat toys")).toMatchObject({ score: 0.5, field: "a" });
	});

	it("a whole word in any tied field ranks the item first", () => {
		const search = createSearcher(
			[
				{ name: "Willa Young", alias: "Willow" },
				{ name: "Willa Young", alias: "Will Z" },
			],
			{ name: (row) => row.name, alias: (row) => row.alias },
		);
		expect(search("will").map((result) => result.item.alias)).toEqual(["Will Z", "Willow"]);
	});
});

describe("selections the searcher rejects", () => {
	const items = ["Open Recent"];

	it("an array of field specs, the 1.x form", () => {
		const specs = [{ selectField: (item: string) => item }];
		// @ts-expect-error an array no longer type-checks either
		expect(() => createSearcher(items, specs)).toThrow(
			new TypeError(
				"createSearcher takes a field, or an object of named fields such as { title: (item) => item.title }",
			),
		);
	});

	it("an options object such as { getText }", () => {
		const getText = { getText: (item: string) => [item] };
		// @ts-expect-error getText returns an array, which no field may
		expect(() => createSearcher(items, getText)).toThrow(
			new TypeError("pass the function itself: createSearcher(items, (item) => item.title)"),
		);
	});

	it("a field without selectField, such as 1.x's { text }", () => {
		const text = { title: { text: (item: string) => item } };
		// @ts-expect-error the 1.x shape no longer type-checks either
		expect(() => createSearcher(items, text)).toThrow(
			new TypeError("field title needs selectField, which replaced text in 2.0"),
		);
	});

	it("a field named selectField, which would read as a spec", () => {
		const fields = { selectField: { selectField: (item: string) => item } };
		// @ts-expect-error the name is reserved for a spec
		expect(() => createSearcher(items, fields)).toThrow(
			new TypeError("a field can't be named selectField"),
		);
	});

	it("1.x's atBest on a lone spec too", () => {
		const atBest = { selectField: (item: string) => item, atBest: SCORES.CONTAINS };
		expect(() => createSearcher(items, atBest)).toThrow(new TypeError("atBest is demoteBy since 2.0"));
	});

	it("1.x's atBest, rather than ignoring it", () => {
		const atBest = { title: { selectField: (item: string) => item, atBest: SCORES.CONTAINS } };
		expect(() => createSearcher(items, atBest)).toThrow(
			new TypeError("atBest is demoteBy since 2.0"),
		);
	});

	it("a field named like an integer, since those names sort first", () => {
		expect(() => createSearcher(items, { 1: (item) => item })).toThrow(
			new TypeError("a field can't be named 1: integer-like names sort before the others"),
		);
	});
});

describe("isLiteral", () => {
	it("is true for the tiers of the query as typed, and false for guesses", () => {
		expect(createSearcher(["Open Recent"])("open").every(isLiteral)).toBe(true);
		expect(isLiteral({ tier: "contains" })).toBe(true);
		expect(isLiteral({ tier: "fuzzy" })).toBe(false);
		expect(isLiteral({ tier: "corrected" })).toBe(false);
	});
});
