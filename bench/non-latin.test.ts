// Reaches into ../src for charMask on purpose, as funnel.test.ts does.
import { describe, expect, it } from "vite-plus/test";
import { createFuzzySearch, normaliseText } from "ekrina";
import { charMask } from "../src/gates";
import { CONFIG_NAMES, configs } from "./configs.ts";
import { CORPORA } from "./corpus";

const SIZE = 10_000;

// No й or ё: normaliseText folds them onto и and е, which would merge two letters.
const CYRILLIC: Record<string, string> = {
	a: "а", b: "б", c: "ц", d: "д", e: "е", f: "ф", g: "г", h: "х", i: "и",
	j: "ж", k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", q: "щ", r: "р",
	s: "с", t: "т", u: "у", v: "в", w: "ш", x: "э", y: "ы", z: "з",
};

const toCyrillic = (s: string): string =>
	s.replace(/[a-z]/gi, (ch) => {
		const mapped = CYRILLIC[ch.toLowerCase()];
		return ch === ch.toLowerCase() ? mapped : mapped.toUpperCase();
	});

// The ascii corpus still carries a few accented letters, which would stay Latin
// on the Cyrillic side and fold onto a letter the Cyrillic query never contains.
const stripAccents = (s: string): string => s.normalize("NFD").replace(/\p{M}+/gu, "");

const ascii = CORPORA.find((c) => c.name === "ascii");
if (!ascii) throw new Error("ascii corpus missing");
const latin = ascii.build(SIZE).map(stripAccents);
const cyrillic = latin.map(toCyrillic);
const queries = ascii.queries.map(stripAccents);

const SCRIPTS = [
	{ list: latin, queries },
	{ list: cyrillic, queries: queries.map(toCyrillic) },
] as const;

const median = (xs: number[]): number => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];

describe("a corpus in Cyrillic", () => {
	it("the letter map stays one to one through normalisation", () => {
		const letters = Object.values(CYRILLIC);
		const lower = new Set(letters.map(normaliseText));
		const upper = new Set(letters.map((l) => normaliseText(l.toUpperCase())));
		expect(lower.size).toBe(26);
		expect(upper).toEqual(lower);
	});

	it("gets exactly the answers its Latin original gets", { timeout: 120_000 }, () => {
		const [fromLatin, fromCyrillic] = SCRIPTS.map(({ list }) => {
			const indexOf = new Map(list.map((item, i) => [item, i]));
			const search = createFuzzySearch(list);
			return (query: string) =>
				search(query).map(({ item, score, fields }) => ({
					at: indexOf.get(item),
					score,
					fields: fields.map((f) => f && { ...f, corrected: f.corrected && toCyrillic(f.corrected) }),
				}));
		});
		for (const query of queries) {
			expect(fromCyrillic(toCyrillic(query)), query).toEqual(fromLatin(query));
		}
	});

	// Every letter outside a–z lands in one of two parity buckets, so a few
	// Cyrillic letters set both and the mask admits the whole corpus.
	it.fails("the mask gate cuts it as hard as it cuts Latin", () => {
		const admitted = SCRIPTS.map(({ list, queries }) => {
			const masks = list.map((item) => charMask(normaliseText(item)));
			const rates = queries.map((query) => {
				const queryMask = charMask(normaliseText(query));
				return masks.filter((mask) => (queryMask & ~mask) === 0).length / masks.length;
			});
			return rates.reduce((sum, r) => sum + r, 0) / rates.length;
		});
		const [l, c] = admitted.map((rate) => `${(100 * rate).toFixed(1)}%`);
		process.stderr.write(`  mask admits ${l} of Latin, ${c} of Cyrillic\n`);
		expect(admitted[1]).toBeLessThanOrEqual(2 * admitted[0]);
	});

	it("every library's hits and timings, Latin against Cyrillic", { timeout: 600_000 }, () => {
		const rows: Record<string, string | number>[] = [];
		for (const name of CONFIG_NAMES) {
			const runs = SCRIPTS.map(({ list, queries }) => {
				const counts: number[] = [];
				const first = median(
					Array.from({ length: 5 }, () => {
						const config = configs(list, name)[0];
						const t = performance.now();
						counts.length = 0;
						for (const query of queries) counts.push(config.count(query));
						return performance.now() - t;
					}),
				);
				const config = configs(list, name)[0];
				for (const query of queries) config.count(query);
				const warm = median(
					Array.from({ length: 5 }, () => {
						const t = performance.now();
						for (const query of queries) config.count(query);
						return performance.now() - t;
					}),
				);
				return { counts, first, warm };
			});
			const [l, c] = runs;
			const answered = l.counts.flatMap((n, k) => (n > 0 ? [k] : []));
			const alike = answered.filter((k) => c.counts[k] === l.counts[k]).length;
			rows.push({
				library: name,
				"same hits as Latin": `${alike}/${answered.length}`,
				"latin hits": l.counts.reduce((a, b) => a + b, 0),
				"cyrillic hits": c.counts.reduce((a, b) => a + b, 0),
				"first pass ms": `${l.first.toFixed(1)} → ${c.first.toFixed(1)}`,
				"warm pass ms": `${l.warm.toFixed(1)} → ${c.warm.toFixed(1)}`,
			});
		}
		const columns = Object.keys(rows[0]);
		const cells = rows.map((r) => columns.map((col) => String(r[col])));
		const widths = columns.map((col, k) => Math.max(col.length, ...cells.map((r) => r[k].length)));
		const line = (row: string[]): string =>
			`  ${row.map((cell, k) => cell.padEnd(widths[k])).join("  ")}\n`;
		process.stderr.write([columns, ...cells].map(line).join(""));
	});
});
