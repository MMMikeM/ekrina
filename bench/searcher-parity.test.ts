/**
 * Before its second pass, the searcher must return exactly the items per-item
 * fuzzyMatch accepts —
 * modulo the rescue cutoff, which legitimately suppresses corrected-tier hits
 * once ten literal hits exist, and a short query's corrections, which it
 * suppresses once anything matches as typed. Any other diff is a searcher gate
 * false-rejecting (the union masks, the survivor cache, or the rescue bigram
 * gate — none of which fuzzyMatch runs). Imports ../src on purpose: the guard
 * covers the source the gates live in.
 */
import { expect, it } from "vite-plus/test";
import { charMask } from "../src/gates";
import { SCORES } from "../src/scores";
import { createSearcher, fuzzyMatch, normaliseText, splitWords } from "../src/index";
import { prepareBoundedQuery } from "../src/query";
import { isShortQuery } from "../src/correction";
import { CORPORA } from "./corpus";
import { secondPass, withoutSecondPass } from "./ladder";

it("searcher agrees with per-item fuzzyMatch on every bench query", { timeout: 600_000 }, () => {
	for (const { name, build, queries } of CORPORA) {
		for (const size of [10_000, 100_000]) {
			const list = build(size);
			const search = createSearcher(list);
			for (const query of queries) {
				const got = new Map<string, number>();
				for (const r of withoutSecondPass(() => search(query))) {
					got.set(r.item, (got.get(r.item) ?? 0) + 1);
				}
				let literal = 0;
				let asTyped = 0;
				const missing: string[] = [];
				for (const item of list) {
					const m = withoutSecondPass(() => fuzzyMatch(item, query));
					if (!m) continue;
					if (m.score <= SCORES.CONTAINS) literal++;
					if (m.tier !== "corrected") asTyped++;
					const n = got.get(item) ?? 0;
					if (n > 0) got.set(item, n - 1);
					else missing.push(`${m.tier}:${item}`);
				}
				const nonRescueMissing = missing.filter((m) => !m.startsWith("corrected:"));
				expect(nonRescueMissing, `[${name}-${size}] "${query}"`).toEqual([]);
				const normalisedQuery = normaliseText(query);
				const short = isShortQuery(normalisedQuery, splitWords(normalisedQuery));
				if (short ? asTyped === 0 : literal < 10) {
					expect(missing, `[${name}-${size}] "${query}" (budget not exhausted)`).toEqual([]);
				}
			}
		}
	}
});

it(
	"an indexed searcher answers every bench query as a fresh lazy one does",
	{ timeout: 600_000 },
	() => {
		for (const { name, build, queries } of CORPORA) {
			for (const size of [10_000, 100_000]) {
				const list = build(size);
				const indexed = createSearcher(list);
				indexed.buildIndex();
				for (const query of queries) {
					expect(indexed(query), `[${name}-${size}] "${query}"`).toEqual(
						createSearcher(list)(query),
					);
				}
			}
		}
	},
);

// The second pass, without its gates and without scanning only the literal
// pass's survivors: what the searcher must return, item for item. A short
// query's rescue runs after it, and only when it found nothing, so a plain
// search that is all rescue gives the second pass an empty field.
const withSecondPass = (
	list: string[],
	query: string,
	plain: { item: string; score: number; tier: string }[],
): Map<string, number> => {
	const scores = new Map(plain.map((r) => [r.item, r.score]));
	const prepared = prepareBoundedQuery(query);
	if (!prepared) return scores;
	const allRescue = plain.length > 0 && plain.every((r) => r.tier === "corrected");
	const rescuedLast = isShortQuery(prepared.normalisedQuery, prepared.queryWords) && allRescue;
	const before = rescuedLast ? new Map<string, number>() : scores;
	const literal = [...before.values()].some((score) => score <= SCORES.CONTAINS);
	const reading = secondPass(prepared, literal ? "literal" : before.size > 0 ? "fuzzy" : "none");
	const expected = new Map(before);
	if (reading) {
		for (const item of list) {
			const held = before.get(item);
			if (held !== undefined && held <= SCORES.CONTAINS) continue;
			const field = item.trim();
			const normalised = normaliseText(field);
			const score = reading.match(field, normalised, null, charMask(normalised), false)?.score;
			if (score !== undefined && score < (held ?? Infinity)) expected.set(item, score);
		}
	}
	return rescuedLast && expected.size === 0 ? scores : expected;
};

it("a searcher's second pass returns exactly what its reading admits", { timeout: 600_000 }, () => {
	for (const { name, build, queries, samples } of CORPORA) {
		const list = build(10_000);
		for (const query of [...queries, ...samples.map((s) => s.query)]) {
			const plainResults = withoutSecondPass(() => createSearcher(list)(query));
			if (plainResults.filter((r) => r.score <= SCORES.CONTAINS).length >= 10) continue;
			const scores = (results: { item: string; score: number }[]) =>
				new Map(results.map((r) => [r.item, r.score]));
			const got = scores(createSearcher(list)(query));
			const expected = withSecondPass(list, query, plainResults);
			expect(got, `[${name}-10000] "${query}"`).toEqual(expected);
		}
	}
});
