import { describe, expect, it } from "vite-plus/test";
import { createFuzzySearch, fuzzyMatch } from "../src/index";

// Typed with combining accents, a query is longer than its normalised form, so
// a correction can't splice the caller's own characters back in and falls back
// to the normalised spelling.
const desserts = ["Crème brûlée", "Café noir"];
const corrected = (query: string): string | undefined =>
	createFuzzySearch(desserts)(query)[0]?.fields[0]?.corrected;

describe("a query typed with combining accents", () => {
	it("is still corrected by a substitution", () => {
		expect(fuzzyMatch("Br\u00fbl\u00e9e", "bru\u0302lxe")?.corrected).toBe("brulee");
	});

	it("is still corrected by an extra character", () => {
		expect(corrected("cre\u0300mx")).toBe("crem");
	});

	it("is still corrected by a swap", () => {
		expect(corrected("cre\u0300me brlue")).toBe("creme brule");
	});

	it("has a phrase word corrected on its own", () => {
		expect(corrected("cre\u0300me brulxe")).toBe("creme brulee");
	});

	it("is still corrected by a missing character", () => {
		expect(fuzzyMatch("Crème brûlée", "cre\u0300me bulee")?.corrected).toBe("creme brulee");
	});
});
