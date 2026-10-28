import { describe, expect, it } from "vite-plus/test";
import { createFuzzySearch } from "../src/index";

// "statsu" is one adjacent swap from "status": a correction for the target.
const query = "statsu report";
const target = "Weekly status report";
// Each holds both query words as typed: ten literal (multi-word) hits.
const literals = Array.from({ length: 10 }, (_, i) => `Statsu report draft ${i + 1}`);

const tierOf = (results: { item: string; fields: ({ tier: string } | null)[] }[]) =>
	results.find((r) => r.item === target)?.fields[0]?.tier ?? null;

describe("the rescue budget does not depend on list order", () => {
	it("the target's tier does not depend on whether it comes before or after the literal hits", () => {
		const first = createFuzzySearch([target, ...literals]);
		const last = createFuzzySearch([...literals, target]);
		expect(tierOf(last(query))).toBe(tierOf(first(query)));
	});
});
