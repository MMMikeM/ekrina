import { describe, expect, it } from "vite-plus/test";
import { createFuzzySearch, SCORES } from "../src/index";
import type { FieldSpec, FuzzySearcher } from "../src/index";

type Product = { title: string; tags: string | null };

const products: Product[] = [
	{ title: "Handcrafted Wooden Chair", tags: "furniture oak" },
	{ title: "  Ergonomic Steel Desk", tags: "office" },
	{ title: "Café Crème Mug", tags: null },
	{ title: "Practical Metal Lamp", tags: "lighting metal" },
	{ title: "Wooden Bookshelf", tags: "furniture pine" },
	{ title: "United States Atlas", tags: "books maps" },
	{ title: "Rustic Granite Table", tags: "furniture stone" },
];

const fields: FieldSpec<Product>[] = [
	{ text: (p) => p.title, acronym: true },
	{ text: (p) => p.tags, atBest: SCORES.CONTAINS },
];

const queries = [
	"wooden",
	"chair wooden",
	"woodne",
	"woxden",
	"erg",
	"creme",
	"usa",
	"metal lamp",
	"lamp metxl",
	"furniture",
	"qxzwkv",
];

const indexed = <T>(search: FuzzySearcher<T>): FuzzySearcher<T> => {
	search.buildIndex();
	return search;
};

describe("buildIndex", () => {
	it("an indexed searcher answers every query exactly as a fresh lazy one does", () => {
		const eager = indexed(createFuzzySearch(products, fields));
		for (const query of queries) {
			expect(eager(query), query).toEqual(createFuzzySearch(products, fields)(query));
		}
	});

	it("holds for a plain string list, whose masks the index shares", () => {
		const titles = products.map((p) => p.title);
		const eager = indexed(createFuzzySearch(titles));
		for (const query of queries) expect(eager(query), query).toEqual(createFuzzySearch(titles)(query));
	});

	it("typing a query keystroke by keystroke matches a lazy searcher at every step", () => {
		const lazy = createFuzzySearch(products, fields);
		const eager = indexed(createFuzzySearch(products, fields));
		const typed = "wooden chair";
		for (let k = 1; k <= typed.length; k++) {
			const prefix = typed.slice(0, k);
			expect(eager(prefix), prefix).toEqual(lazy(prefix));
		}
	});

	it("building mid-session, after narrowing, leaves the answers unchanged", () => {
		const lazy = createFuzzySearch(products, fields);
		const search = createFuzzySearch(products, fields);
		for (const query of ["wo", "woo", "wood"]) {
			search(query);
			lazy(query);
		}
		search.buildIndex();
		for (const query of ["woode", "wooden", "woxden", "metal"]) {
			expect(search(query), query).toEqual(lazy(query));
		}
	});

	it("a second call reads no item text", () => {
		let reads = 0;
		const search = createFuzzySearch(products, (p) => {
			reads++;
			return p.title;
		});
		search.buildIndex();
		expect(reads).toBe(products.length);
		search.buildIndex();
		expect(reads).toBe(products.length);
	});

	it("an empty list or an empty spec array still answers nothing", () => {
		expect(indexed(createFuzzySearch([] as string[]))("anything")).toEqual([]);
		expect(indexed(createFuzzySearch(["apple"], []))("apple")).toEqual([]);
	});
});
