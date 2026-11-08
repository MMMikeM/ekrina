import { describe, expect, it } from "vite-plus/test";
import type { Artifact } from "./artifact.ts";
import { BrokenClaim, figureEvaluator, parseFigure } from "./figures.ts";

const table = [
	"| Library          | batch/query | rel |",
	"|------------------|------------:|----:|",
	"| **Ekrina**       |     0.36 ms | **100%** |",
	"| Ekrina (indexed) |     0.31 ms |  86% |",
	"| _all (geomean)_  |     0.50 ms | 139% |",
].join("\n");
const artifact = { coldMatrix: { en: { batch: { "10000": { ekrina: { restMs: 0.3626 } } } } } };
const figure = figureEvaluator(artifact as unknown as Artifact, { speed: table });

describe("figures", () => {
	it("a cell reads as the table shows it, with emphasis dropped", () => {
		expect(figure('cell("speed", "Ekrina", "batch/query")')).toBe("0.36 ms");
		expect(figure('cell("speed", "all (geomean)", "rel")')).toBe("139%");
	});

	it("arithmetic composes over cells and raw artifact values", () => {
		expect(
			figure(
				'pct(div(n("speed", "Ekrina (indexed)", "batch/query"), n("speed", "Ekrina", "batch/query")))',
			),
		).toBe("86%");
		expect(figure('fixed(raw("coldMatrix", "en", "batch", "10000", "ekrina", "restMs"), 2)')).toBe(
			"0.36",
		);
		expect(figure("times(div(4.97, 0.36), 1)")).toBe("13.8×");
		expect(figure('span(5.61, 5.83, 1, "×")')).toBe("5.6–5.8×");
		expect(figure('span(5.61, 5.64, 1, "×")')).toBe("5.6×");
		expect(figure("fraction(div(11.59, 136.13))")).toBe("a twelfth");
		expect(figure("fractions(div(11.59, 136.13), div(15.25, 136.13))")).toBe(
			"a twelfth to a ninth",
		);
		expect(figure("fractions(0.26, 0.24)")).toBe("a quarter");
		expect(figure('constant("18%")')).toBe("18%");
		expect(figure('unsourced("0.8%", "400-word draw")')).toBe("0.8%");
		expect(() => figure('unsourced("0.8%", " ")')).toThrow("names no source");
	});

	it("a claim renders nothing while it holds and fails the build once it does not", () => {
		expect(figure('assert(within(0.34, 0.31, 0.15), "acronym ties indexed")')).toBe("");
		expect(() => figure('assert(within(0.36, 0.31, 0.15), "Ekrina ties indexed")')).toThrow(
			new BrokenClaim("Ekrina ties indexed"),
		);
	});

	it("a bare condition, an unknown figure or a missing cell is an error, not a value", () => {
		expect(() => figure("lt(1, 2)")).toThrow("wrap it in assert");
		expect(() => figure("eval(1)")).toThrow("no figure 'eval'");
		expect(() => figure('cell("speed", "fuzzysort", "batch/query")')).toThrow("no row 'fuzzysort'");
	});

	it("a figure is one call of literals and calls, nothing else", () => {
		expect(parseFigure('div(n("a", "b", "c"), 2)')).toEqual({
			name: "div",
			args: [{ name: "n", args: ["a", "b", "c"] }, 2],
		});
		expect(() => parseFigure("1 + 2")).toThrow();
		expect(() => parseFigure("a(1) b(2)")).toThrow("one call");
	});
});

describe("figures over families and orderings", () => {
	const family = (group: string, mrr: number, rows: number) => ({
		kind: `${group} ${mrr}`,
		scored: true,
		group,
		queries: [],
		mrr: { fuse: mrr },
		medianRows: { fuse: rows },
	});
	const families = {
		en: [
			family("typos", 1, 3),
			family("typos", 0, 5),
			family("noise", 1, 7),
			{ kind: "nonsense", scored: false, queries: [], mrr: {}, medianRows: { fuse: 100 } },
		],
	};
	const scorecard = (rows: Array<[string, number]>): string =>
		["| Library | MRR |", "|---|--:|", ...rows.map(([row, mrr]) => `| ${row} | ${mrr} |`)].join(
			"\n",
		);
	const ordered = figureEvaluator({ families } as unknown as Artifact, {
		en: scorecard([
			["x", 0.9],
			["y", 0.5],
			["z", 0.5],
		]),
		native: scorecard([
			["x", 0.8],
			["y", 0.6],
			["z", 0.4],
		]),
		emoji: scorecard([
			["x", 0.4],
			["y", 0.6],
			["z", 0.1],
		]),
	});

	it("the headline MRR is the group-weighted mean before rounding", () => {
		expect(ordered('fixed(headlineMrr("en", "fuse"), 3)')).toBe("0.611");
		expect(() => ordered('headlineMrr("en", "fuzzysort")')).toThrow("no en families score");
	});

	it("result-set size is the median over scored families only", () => {
		expect(ordered('medianRows("en", "fuse")')).toBe("5");
	});

	it("a ratio reads as a whole number in words", () => {
		expect(ordered("inWords(div(136.13, 15.25))")).toBe("nine");
		expect(ordered("inWords(div(283.39, 15.25))")).toBe("nineteen");
		expect(ordered("inWords(46.52)")).toBe("forty-seven");
		expect(() => ordered("inWords(100)")).toThrow("no words for 100");
	});

	it("two tables share an order unless some pair of rows swaps, and a tie is no swap", () => {
		expect(ordered('assert(sameOrder("MRR", "en", "native"), "same")')).toBe("");
		expect(() => ordered('assert(sameOrder("MRR", "en", "native", "emoji"), "same")')).toThrow(
			new BrokenClaim("same"),
		);
	});
});

describe("figures across table cells and raw timings", () => {
	const families = [
		"| Group | Family           | Ekrina | fuzzy |",
		"|-------|------------------|-------:|------:|",
		"| typos | neighbouring key |   1.00 |  0.10 |",
		"| typos | dropped letter   |   0.95 |  0.62 |",
		"| noise | accents added    |   1.00 |  0.00 |",
	].join("\n");
	const longtext = [
		"| doc chars | fuzzy junk |",
		"|----------:|-----------:|",
		"|       256 |       0.5% |",
		"|       512 |       1.0% |",
	].join("\n");
	const cold = (oneShotMs: number) => ({ "10000": { ekrina: { oneShotMs } } });
	const timed = {
		probes: {
			en: [
				{ query: "gensler", cells: { ekrina: { count: 1 } } },
				{ query: "lopez pexro", cells: {} },
			],
		},
		coldMatrix: {
			en: {
				"short-word": cold(3),
				acronym: cold(9),
				miss: cold(5),
				batch: {
					"10000": { ekrina: { perQueryMs: [0.2, 0.35] }, fuse: { perQueryMs: [9, 182] } },
				},
			},
		},
		session: {
			steps: ["hin", "hint"],
			rows: [{ library: "ekrina", stepMs: [3.99, 0.25], sessionMs: 4.24 }],
		},
	};
	const across = figureEvaluator(timed as unknown as Artifact, {
		"families-native": families,
		"families-en": families,
		longtext,
	});

	it("rows match by any label column, so a family table reads by family or by group", () => {
		expect(across('labelCell("families-native", "dropped letter", "fuzzy")')).toBe("0.62");
		expect(across('lowest("families-native+families-en", "typos", "Ekrina+fuzzy")')).toBe("0.1");
		expect(across('highest("families-native", "dropped letter+accents added", "fuzzy")')).toBe(
			"0.62",
		);
		expect(() => across('labelCell("families-native", "typos", "fuzzy")')).toThrow("2 rows");
	});

	it("a table labelled by a right-aligned first column reads by that column", () => {
		expect(across('highest("longtext", "256+512", "fuzzy junk")')).toBe("1");
	});

	it("a listed row missing from any listed table is an error, not a row left out", () => {
		expect(() => across('lowest("families-native", "stuck key", "Ekrina")')).toThrow(
			"no row 'stuck key'",
		);
		expect(() =>
			across('highest("families-native", "dropped letter+droped letter", "Ekrina")'),
		).toThrow("no row 'droped letter'");
	});

	it("raw timings read by probe query, library and step rather than by array position", () => {
		expect(across('probeCount("en", "gensler", "ekrina")')).toBe("1");
		expect(across('fastestBatchQuery("en", 10000, "lopez pexro")')).toBe("0.35");
		expect(across('slowestBatchQuery("en", 10000, "lopez pexro")')).toBe("182");
		expect(across('oneShotWithout("en", 10000, "ekrina", "acronym")')).toBe("4");
		expect(across('sessionMs("ekrina", "hint")')).toBe("0.25");
		expect(across('sessionMs("ekrina", "session")')).toBe("4.24");
	});
});
