import { describe, expect, it } from "vite-plus/test";
import { createFuzzySearch, fuzzyMatch, SCORES } from "../src/index";

const isLiteral = (text: string, query: string) => {
	const result = fuzzyMatch(text, query);
	return result !== null && result.score <= SCORES.CONTAINS;
};

describe("multi-word queries match word starts, not only whole words", () => {
	it("matches when the last query word is only the start of a word", () => {
		expect(fuzzyMatch("Northwind renewal prep", "northwind ren")?.tier).toBe("prefix");
		expect(fuzzyMatch("Northwind renewal prep", "north ren")?.tier).toBe("multi-word");
		expect(fuzzyMatch("Quarterly plan for acme 2027", "plan ac")?.tier).toBe("multi-word");
		expect(fuzzyMatch("## heading 6545d81a-15bb-4d13-872c-0a6f718d7bdb b", "heading 0a6")?.tier).toBe("multi-word");
	});

	it("matches when an earlier query word is only the start of a word", () => {
		expect(fuzzyMatch("Quarterly plan for acme 2027", "quart plan")?.tier).toBe("multi-word");
		expect(fuzzyMatch("Northwind renewal prep", "north renewal")?.tier).toBe("multi-word");
	});

	it("keeps matching word starts in any order, as whole words already do", () => {
		expect(fuzzyMatch("Northwind renewal prep", "ren north")?.tier).toBe("multi-word");
	});

	it("still needs each word to start a word of the text, not sit inside one", () => {
		expect(isLiteral("Northwind renewal prep", "north enewal")).toBe(false);
		expect(isLiteral("Northwind renewal prep", "orth renewal")).toBe(false);
	});

	it("keeps a title literally matched on every keystroke once its first word is typed", () => {
		const search = createFuzzySearch(["Northwind renewal prep", "Weekly status report"]);
		for (const query of ["north", "north r", "north re", "north ren", "north rene", "north renewal"]) {
			const hit = search(query).find((result) => result.item === "Northwind renewal prep");
			expect(hit?.score, query).toBeLessThanOrEqual(SCORES.CONTAINS);
		}
	});
});

describe("a repeated query word", () => {
	it("needs its own occurrence in the field", () => {
		expect(fuzzyMatch("John Smith", "john john")).toBeNull();
		expect(fuzzyMatch("e", "e e")).toBeNull();
	});
});
