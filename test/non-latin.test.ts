import { describe, expect, it } from "vite-plus/test";
import { createFuzzySearch } from "../src/index";

const cities = ["Привет мир", "Москва река", "Санкт-Петербург"];
const firstHit = (query: string): string | undefined => createFuzzySearch(cities)(query)[0]?.item;

describe("a list in a script outside Latin", () => {
	it("finds a word", () => {
		expect(firstHit("москва")).toBe("Москва река");
	});

	it("matches one character where it starts a word", () => {
		expect(createFuzzySearch(cities)("м").map((result) => result.item)).toEqual([
			"Москва река",
			"Привет мир",
		]);
	});

	it("corrects a substitution", () => {
		expect(firstHit("москза")).toBe("Москва река");
	});

	it("corrects a swap", () => {
		expect(firstHit("мсоква")).toBe("Москва река");
	});
});
