import { describe, expect, it } from "vite-plus/test";
import { createFuzzySearch, fuzzyMatch, normaliseText } from "../src/index";

const msToRun = (run: () => unknown): number => {
	const start = Date.now();
	run();
	return Date.now() - start;
};

// Machines and coverage instrumentation differ by 20x, so a cost that must not
// grow with the query is pinned as a ratio of two runs on the same machine.
const fastestMsToRun = (run: () => unknown): number =>
	Math.max(1, Math.min(msToRun(run), msToRun(run), msToRun(run)));

// Linear work doubles with the text, and the quadratic paths these tests guard
// against quadrupled.
const growthWhenDoubled = (runAtScale: (scale: 1 | 2) => unknown): number => {
	const tenRuns = (scale: 1 | 2) => () => {
		for (let run = 0; run < 10; run++) runAtScale(scale);
	};
	return fastestMsToRun(tenRuns(2)) / fastestMsToRun(tenRuns(1));
};

// Each of these took 0.8–6 s while the long-text gate was a regex.
const hostile: [string, (scale: number) => string, string][] = [
	["a head with no tail after it", (scale) => "b" + "a".repeat(64_000 * scale), "aaab"],
	["a phrase whose words never occur", (scale) => "aaa ".repeat(16_000 * scale) + "b", "aaaa bbbb"],
	["word starts that all fail late", (scale) => "xa b c d" + " a".repeat(32_000 * scale), "abcd"],
	["runs that all fail late", (scale) => "xab c d e" + " abc".repeat(32_000 * scale), "abcde"],
	[
		"a typo correction over repetition",
		(scale) => "b" + "a".repeat(16_000 * scale),
		"a".repeat(30) + "b",
	],
];

describe(`matching long text an attacker controls`, () => {
	for (const [label, textAtScale, query] of hostile) {
		it(`answers in linear time: ${label}`, () => {
			const text = { 1: textAtScale(1), 2: textAtScale(2) };
			expect(growthWhenDoubled((scale) => fuzzyMatch(text[scale], query))).toBeLessThan(3);
		});
	}

	it("a searcher answers in linear time over one hostile field", () => {
		const field = { 1: "xa b c d" + " a".repeat(32_000), 2: "xa b c d" + " a".repeat(64_000) };
		const search = (scale: 1 | 2) => createFuzzySearch([field[scale]])("abcd");
		expect(growthWhenDoubled(search)).toBeLessThan(3);
	});
});

describe("long text still matches the way short text does", () => {
	const short = "Handcrafted Wooden Chair";
	const long = "lorem ipsum dolor sit amet ".repeat(20) + short;

	for (const query of ["wooden", "craft", "chair wooden", "handcrafed", "woodn chair"]) {
		it(`\`${query}\` reaches the same tier past the long-text gate`, () => {
			expect(fuzzyMatch(long, query)?.tier).toBe(fuzzyMatch(short, query)?.tier);
		});
	}

	it("a word typed sparsely is read as that word only up to 512 characters", () => {
		expect(fuzzyMatch(short, "hcrafted")?.tier).toBe("corrected");
		expect(fuzzyMatch(long, "hcrafted")?.tier).toBe("fuzzy");
	});

	it("a searcher finds a phrase in a long field", () => {
		const search = createFuzzySearch([long, "Steel Table"]);
		expect(search("wooden chair").map((result) => result.item)).toEqual([long]);
	});
});

const mixedWord = (length: number): string =>
	Array.from({ length }, (_, i) => String.fromCharCode(97 + ((i * 7) % 26))).join("");
const withTypo = (word: string): string => {
	const at = word.length >> 1;
	return word.slice(0, at) + (word[at] === "z" ? "y" : "z") + word.slice(at + 1);
};
const alphabet = "abcdefghijklmnopqrstuvwxyz ";

// Each of these threw, hung, or ran for seconds while queries had no length bound.
describe("a query an attacker controls", () => {
	it("is matched on its first 256 characters", () => {
		const field = "a".repeat(256) + "zzz";
		expect(fuzzyMatch(field, "a".repeat(300))?.tier).toBe("prefix");
		expect(createFuzzySearch([field, "b"])("a".repeat(300))).toHaveLength(1);
	});

	it("does not count leading spaces towards its 256 characters", () => {
		const padded = " ".repeat(300) + "chair";
		expect(fuzzyMatch("chair", padded)?.tier).toBe("exact");
		expect(createFuzzySearch(["chair"])(padded)).toHaveLength(1);
	});

	it("is never cut halfway through a character", () => {
		const field = "a".repeat(255) + "😀x";
		const [, end] = fuzzyMatch(field, "a".repeat(255) + "😀zzz")?.ranges.at(-1) ?? [0, 0];
		expect(field.charCodeAt(end)).not.toBe(0xd83d);
	});

	it("corrects a typo in a word of up to 64 characters, and no longer", () => {
		expect(fuzzyMatch(mixedWord(64), withTypo(mixedWord(64)))?.tier).toBe("corrected");
		expect(fuzzyMatch(mixedWord(65), withTypo(mixedWord(65)))).toBeNull();
	});

	it("does not correct a dropped character in a phrase word over 64 characters", () => {
		const word = mixedWord(70);
		const dropped = word.slice(0, 35) + word.slice(36);
		expect(fuzzyMatch(`hello ${word}`, `hello ${dropped}`)?.tier).not.toBe("corrected");
	});

	it("matches regular-expression syntax literally", () => {
		expect(fuzzyMatch("price (USD) [net]", "(usd) [net]")?.tier).toBe("boundary");
		expect(createFuzzySearch(["a.b", "axb"])("a.b").map((result) => result.item)).toEqual(["a.b"]);
		expect(createFuzzySearch(["plain"])("^$|\\*+?{}")).toEqual([]);
	});

	it("can name any number of rare characters and still be folded correctly", () => {
		for (let batch = 0; batch < 300; batch++) {
			const start = 0x4e00 + batch * 256;
			normaliseText(Array.from({ length: 256 }, (_, i) => String.fromCodePoint(start + i)).join(""));
		}
		expect(normaliseText("Ärger ПРИВЕТ Ḁ")).toBe("arger привет a");
	});
});

const longField = alphabet.repeat(12);
const hostileQueries: [string, string, string][] = [
	["a single word of 16,000 characters", alphabet, mixedWord(16_000)],
	["a single word of 16,000 characters, against a long field", longField, mixedWord(16_000)],
	["a phrase with an absent word of 16,385 characters", longField, `hello ${mixedWord(16_385)}`],
	["a word repeated 4,000 times", "the cat sat on the mat ".repeat(2_700), Array(4_000).fill("the").join(" ")],
	[
		"a phrase of 4,900 distinct characters",
		"Blue Wooden Chair — Oak",
		Array.from({ length: 4_900 }, (_, i) => String.fromCodePoint(0x4e00 + i)).join("") + " blue",
	],
];

describe(`a query an attacker controls`, () => {
	for (const [label, text, query] of hostileQueries) {
		it(`answers quickly without throwing: ${label}`, () => {
			expect(msToRun(() => fuzzyMatch(text, query))).toBeLessThan(250);
			expect(msToRun(() => createFuzzySearch([text, "Red Sofa"])(query))).toBeLessThan(250);
		});
	}

	it("costs no more than a short query when matched against every row of a list", () => {
		const rows = Array.from({ length: 10_000 }, (_, i) => `Blue Wooden Chair ${i}`);
		const matchEveryRow = (query: string) => () => rows.map((row) => fuzzyMatch(row, query));
		const short = fastestMsToRun(matchEveryRow("chair"));
		expect(fastestMsToRun(matchEveryRow(mixedWord(256)))).toBeLessThan(short * 4);
	});

	it("walks a field once for a repeated word, however many mid-word hits it skips", () => {
		const field = "xthe ".repeat(12_800) + "the xthe ".repeat(64);
		const copiesOfThe = (copies: number) => () => {
			for (let run = 0; run < 30; run++) fuzzyMatch(field, Array(copies).fill("the").join(" "));
		};
		const twoCopies = fastestMsToRun(copiesOfThe(2));
		expect(fastestMsToRun(copiesOfThe(64))).toBeLessThan(twoCopies * 4);
	});
});
