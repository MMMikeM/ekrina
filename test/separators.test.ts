import { describe, expect, it } from "vite-plus/test";
import { createSearcher, fuzzyMatch, SCORES } from "../src/index";

describe("a query whose separator the field spells differently", () => {
	const items = ["new york", "new-york", "new\u00a0york", "new\u2014york"];

	it("still matches every spelling literally", () => {
		for (const query of items) {
			expect(
				createSearcher(items)(query)
					.map((r) => r.item)
					.sort(),
			).toEqual([...items].sort());
		}
	});

	it("is a multi-word match, not a correction", () => {
		expect(fuzzyMatch("New York", "new\u00a0york")).toMatchObject({
			score: SCORES.MULTI_WORD,
			tier: "multi-word",
		});
		expect(fuzzyMatch("New York", "new\u2014york")?.tier).toBe("multi-word");
	});

	it("still has a typo in it corrected", () => {
		expect(createSearcher(["new york"])("new\u00a0yrok")[0]).toMatchObject({
			tier: "corrected",
		});
	});
});
