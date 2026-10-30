import { describe, expect, it } from "vite-plus/test";
import { createFuzzySearch, fuzzyMatch } from "../src/index";

const msToRun = (run: () => unknown): number => {
	const start = Date.now();
	run();
	return Date.now() - start;
};

// Each of these took 0.8–6 s while the long-text gate was a regex.
const hostile: [string, string, string][] = [
	["a head with no tail after it", "b" + "a".repeat(64_000), "aaab"],
	["a phrase whose words never occur", "aaa ".repeat(16_000) + "b", "aaaa bbbb"],
	["word starts that all fail late", "xa b c d" + " a".repeat(32_000), "abcd"],
	["runs that all fail late", "xab c d e" + " abc".repeat(32_000), "abcde"],
	["a typo correction over repetition", "b" + "a".repeat(64_000), "a".repeat(30) + "b"],
];

describe("matching long text an attacker controls", () => {
	for (const [label, text, query] of hostile) {
		it(`answers in linear time: ${label}`, () => {
			expect(msToRun(() => fuzzyMatch(text, query))).toBeLessThan(250);
		});
	}

	it("a searcher answers in linear time over one hostile field", () => {
		const search = createFuzzySearch(["xa b c d" + " a".repeat(32_000)]);
		expect(msToRun(() => search("abcd"))).toBeLessThan(250);
	});
});

describe("long text still matches the way short text does", () => {
	const short = "Handcrafted Wooden Chair";
	const long = "lorem ipsum dolor sit amet ".repeat(20) + short;

	for (const query of ["wooden", "craft", "chair wooden", "hcrafted", "handcrafed", "woodn chair"]) {
		it(`\`${query}\` reaches the same tier past the long-text gate`, () => {
			expect(fuzzyMatch(long, query)?.tier).toBe(fuzzyMatch(short, query)?.tier);
		});
	}

	it("a searcher finds a phrase in a long field", () => {
		const search = createFuzzySearch([long, "Steel Table"]);
		expect(search("wooden chair").map((result) => result.item)).toEqual([long]);
	});
});
