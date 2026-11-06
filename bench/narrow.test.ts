/**
 * Can one regex replace the whole prebuilt index?
 *
 * The eager mask exists to keep the gate off most of the corpus and to admit
 * near-misses for the one-edit rescue. Both jobs can be done by a single
 * alternation compiled per query and run over the caller's own strings —
 * characters expanded query-side to the code points that normalise to them, so
 * no normalised copy has to exist first.
 *
 * The assertion that matters is containment: every item today's search returns
 * must survive. Anything else is a tuning question; this is not.
 */
import { expect, it } from "vite-plus/test";
import { splitWords } from "../src/boundaries";
import { normaliseText } from "../src/normalise";
import { createSearcher } from "../src/search";
import { CORPORA } from "./corpus";

const time = (fn: () => void): number => {
	for (let i = 0; i < 3; i++) fn();
	const t = performance.now();
	for (let i = 0; i < 10; i++) fn();
	return (performance.now() - t) / 10;
};

const classEscape = (s: string): string => s.replace(/[\^\]\\-]/g, "\\$&");

const unfold = new Map<string, string[]>();
for (let cp = 0x20; cp <= 0x24f; cp++) {
	const ch = String.fromCodePoint(cp);
	const folded = normaliseText(ch);
	if (folded.length === 1)
		(unfold.get(folded) ?? (unfold.set(folded, []).get(folded) as string[])).push(ch);
}
const cls = (ch: string): string => `[${(unfold.get(ch) ?? [ch]).map(classEscape).join("")}]`;
const notCls = (ch: string): string => cls(ch).replace("[", "[^");

const subsequence = (chars: string[]): string => {
	const from = (i: number): string => {
		let out = cls(chars[i]);
		for (let k = i + 1; k < chars.length; k++) out += `${notCls(chars[k])}*${cls(chars[k])}`;
		return out;
	};
	const n = Math.min(3, chars.length);
	const run = chars.slice(0, n).map(cls).join("");
	const after = n < chars.length ? `${notCls(chars[n])}*${from(n)}` : "";
	return `(?<![\\p{L}\\p{N}_])${from(0)}|${run}${after}`;
};

const WILDCARD = "\u0000";

// All three one-edit families the rescue can reach: an adjacent swap, one
// character too many, and one character wrong. The third is what
// substitutionRescue recovers and what buildRescueVariants never enumerates —
// it needs a wildcard, not a literal.
const oneEdit = (chars: string[]): string[] => {
	const out = new Set<string>();
	const lit = (cs: string[]): string => cs.map((c) => (c === WILDCARD ? "[^]" : cls(c))).join("");
	for (let j = 0; j < chars.length - 1; j++) {
		if (chars[j] === chars[j + 1]) continue;
		const s = chars.slice();
		[s[j], s[j + 1]] = [s[j + 1], s[j]];
		out.add(lit(s));
	}
	for (let j = 0; j < chars.length; j++) {
		out.add(lit(chars.slice(0, j).concat(chars.slice(j + 1))));
		out.add(lit(chars.slice(0, j).concat(WILDCARD, chars.slice(j + 1))));
	}
	return [...out];
};

it("one narrowing pass contains every result", { timeout: 600_000 }, () => {
	for (const { name, build, queries } of CORPORA) {
		const list = build(100_000);
		const raw = list.map((s) => s.trim());
		const search = createSearcher(list);
		const index = new Map(list.map((s, i) => [s, i]));
		const extra = ["mar", "marble", "cot", "cotto", "wooden"];

		process.stderr.write(`\n${name} 100k\n`);
		for (const query of [...queries, ...extra]) {
			const nq = normaliseText(query);
			if (splitWords(nq).length > 1 || nq.length < 2) continue;
			const chars = [...nq];
			const literal = new RegExp(`(?:${subsequence(chars)})`, "ui");
			const combined = new RegExp(`(?:${subsequence(chars)}|${oneEdit(chars).join("|")})`, "ui");

			let sink = 0;
			const litMs = time(() => {
				for (let i = 0; i < raw.length; i++) if (literal.test(raw[i])) sink++;
			});
			const comMs = time(() => {
				for (let i = 0; i < raw.length; i++) if (combined.test(raw[i])) sink++;
			});
			expect(sink).toBeGreaterThanOrEqual(0);

			const survivors = new Set<number>();
			for (let i = 0; i < raw.length; i++) if (combined.test(raw[i])) survivors.add(i);
			const results = search(query);
			const missed = results.filter((r) => !survivors.has(index.get(r.item as string) as number));

			process.stderr.write(
				`  ${query.padEnd(12)} literal ${litMs.toFixed(2).padStart(5)} ms` +
					`  +1edit ${comMs.toFixed(2).padStart(6)} ms` +
					`  survivors ${String(survivors.size).padStart(6)}` +
					`  results ${String(results.length).padStart(5)}` +
					`  missed ${missed.length}${missed.length ? ` ${JSON.stringify(missed.slice(0, 3).map((m) => m.item))}` : ""}\n`,
			);
			expect(missed.map((m) => m.item)).toEqual([]);
		}
	}
});
