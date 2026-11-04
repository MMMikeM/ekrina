import fc from "fast-check";
import { describe, expect, it } from "vite-plus/test";
import { createFuzzySearch, fuzzyMatch, normaliseText } from "../src/index";

// A small alphabet with accents, case, digits and separators, so random fields
// and queries actually match each other often enough to exercise every tier.
const unit = fc.constantFrom(..."abcdeABé ê-'1".split(""), "é");
const text = fc.string({ unit, maxLength: 24 });
const query = fc.string({ unit, minLength: 1, maxLength: 8 });
const list = fc.array(text, { minLength: 1, maxLength: 30 });

// A random query rarely lands near a random field, so half the cases type a
// word the field holds, mistyped: the near misses the corrections exist for.
const word = fc.string({ unit: fc.constantFrom(..."abcdeéAB1".split("")), minLength: 4, maxLength: 12 });
const edit = fc.record({ kind: fc.constantFrom("drop", "swap", "change", "double"), at: fc.nat() });
const mistype = (typed: string, { kind, at }: { kind: string; at: number }): string => {
	const k = at % typed.length;
	if (kind === "drop") return typed.length > 1 ? typed.slice(0, k) + typed.slice(k + 1) : typed;
	if (kind === "swap") return typed.slice(0, k) + typed.slice(k + 1, k + 2) + typed[k] + typed.slice(k + 2);
	if (kind === "change") return typed.slice(0, k) + "x" + typed.slice(k + 1);
	return typed.slice(0, k) + typed[k] + typed.slice(k);
};
const nearMiss = fc
	.tuple(text, word, text, fc.array(edit, { minLength: 1, maxLength: 4 }))
	.map(([before, held, after, edits]): [string, string] => [
		`${before} ${held} ${after}`,
		edits.reduce(mistype, held),
	]);
const fieldAndQuery = fc.oneof(fc.tuple(text, query), nearMiss);
const listAndQuery = fc.oneof(
	fc.tuple(list, query),
	fc.tuple(list, nearMiss).map(([items, [field, typed]]): [string[], string] => [[...items, field], typed]),
);

describe("properties that hold for any input", () => {
	it("normaliseText keeps one code unit per code unit of NFC(text).trim()", () => {
		fc.assert(
			fc.property(text, (input) => {
				expect(normaliseText(input)).toHaveLength(input.normalize("NFC").trim().length);
			}),
		);
	});
});

describe(`properties of every match`, () => {
	it("every range indexes the caller's own string, in order and without overlap", () => {
		fc.assert(
			fc.property(fieldAndQuery, ([field, typed]) => {
				const result = fuzzyMatch(field, typed);
				if (result === null) return;
				let previousEnd = -1;
				for (const [start, end] of result.ranges) {
					expect(start).toBeGreaterThan(previousEnd);
					expect(end).toBeGreaterThanOrEqual(start);
					expect(end).toBeLessThan(field.length);
					previousEnd = end;
				}
			}),
		);
	});

	it("results come back best first", () => {
		fc.assert(
			fc.property(listAndQuery, ([items, typed]) => {
				const scores = createFuzzySearch(items)(typed).map((result) => result.score);
				expect(scores).toEqual([...scores].sort((a, b) => a - b));
			}),
		);
	});

	// The survivor cache reuses the previous keystroke's gate verdicts, which is
	// sound only if every gate is monotone under query extension.
	it("typing a query keystroke by keystroke returns what a fresh search does", () => {
		fc.assert(
			fc.property(listAndQuery, ([items, typed]) => {
				const typing = createFuzzySearch(items);
				for (let length = 1; length < typed.length; length++) typing(typed.slice(0, length));
				expect(typing(typed)).toEqual(createFuzzySearch(items)(typed));
			}),
		);
	});

	it("a limit returns exactly the first results an unlimited search would", () => {
		fc.assert(
			fc.property(listAndQuery, fc.integer({ min: 1, max: 12 }), ([items, typed], limit) => {
				const search = createFuzzySearch(items);
				expect(search(typed, { limit })).toEqual(createFuzzySearch(items)(typed).slice(0, limit));
			}),
		);
	});
});
