/**
 * Corpora + queries from the committed corpus-*.json snapshots. Frozen on
 * purpose: every published rank and MRR derives from these exact sequences,
 * and regeneration (corpus-gen.test.ts, GEN_CORPUS=1) changes the probes too.
 * `ascii` is en-locale; `mixed` lands ~5% of items with a diacritic (every
 * 7th item from fr/pl generators). Every non-miss query records its `source`
 * item so hits.test.ts can check each library surfaces it, and where.
 */
import { readFileSync } from "node:fs";

// readFileSync, not JSON module imports: import attributes differ between
// vitest's bundler and plain node (bench/run.ts children).
const loadCorpus = (file: string): string[] =>
	JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8")) as string[];
const asciiJson: string[] = loadCorpus("./corpus-ascii.json");
const mixedJson: string[] = loadCorpus("./corpus-mixed.json");

// Generation was one reseed + sequential appends, so a prefix slice equals a
// smaller build (1k ⊂ 10k ⊂ 100k) and 2k-sample queries hit at any size.
const slicer =
	(data: string[]) =>
	(n: number): string[] => {
		if (n > data.length)
			throw new Error(`corpus snapshot has ${data.length} items; asked for ${n}`);
		return data.slice(0, n);
	};

const wordsOf = (s: string): string[] => s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const everyOther = (w: string): string => [...w].filter((_, k) => k % 2 === 0).join("");
const stripAccents = (s: string): string => s.normalize("NFD").replace(/\p{M}+/gu, "");

export type QuerySpec = {
	query: string;
	kind:
		| "long-word"
		| "short-word"
		| "short-word-typo"
		| "two-words"
		| "two-words-reversed"
		| "two-words-partial-reversed"
		| "two-words-joined"
		| "two-words-extra"
		| "two-words-typo"
		| "two-words-typo-second"
		| "two-words-typo-reversed"
		| "two-words-double-typo"
		| "plural-to-singular"
		| "prefix"
		| "infix"
		| "scatter-light"
		| "scatter-medium"
		| "scatter-heavy"
		| "transposition"
		| "insertion"
		| "substitution"
		| "acronym"
		| "accent-stripped"
		| "miss";
	// The corpus item the query was derived from — rank checks look for it.
	source: string | null;
};

// Swaps at/after the middle, breaking the subsequence property on purpose:
// transposition is edit-distance territory, not subsequence territory.
const transpose = (w: string): string => {
	for (let k = Math.max(1, Math.floor(w.length / 2) - 1); k + 1 < w.length; k++) {
		if (w[k] !== w[k + 1]) return w.slice(0, k) + w[k + 1] + w[k] + w.slice(k + 2);
	}
	return w;
};

// The other subsequence-breaking one-char typos; deletion is covered by
// `scatter-light`.
const doubleChar = (w: string): string => {
	const k = Math.floor(w.length / 2);
	return w.slice(0, k) + w[k] + w.slice(k);
};

const substitute = (w: string): string => {
	const k = Math.floor(w.length / 2);
	// A character the word does not contain, so the query's mask genuinely
	// loses a class.
	const replacement = w.includes("x") ? "q" : "x";
	return w.slice(0, k) + replacement + w.slice(k + 1);
};

// Derived from a fixed sample so every probe (bar the misses) actually matches.
const deriveQueries = (build: (n: number) => string[]): QuerySpec[] => {
	const sample = build(2000);
	const wordAt = (i: number): string => wordsOf(sample[i])[0] ?? "steel";
	const specs: QuerySpec[] = [
		{ query: wordAt(4).toLowerCase(), kind: "long-word", source: sample[4] },
		{ query: wordAt(517).toLowerCase(), kind: "short-word", source: sample[517] },
		{
			query: wordsOf(sample[8]).slice(0, 2).join(" ").toLowerCase(),
			kind: "two-words",
			source: sample[8],
		},
		// Substring engines pass the in-order phrase without trying; only genuinely
		// tokenised matching survives the reversal.
		{
			query: wordsOf(sample[8]).slice(0, 2).reverse().join(" ").toLowerCase(),
			kind: "two-words-reversed",
			source: sample[8],
		},
		// Mid-keystroke on the second word, reversed so no engine passes it as a
		// prefix of the source.
		{
			query: [(wordsOf(sample[8])[1] ?? "chair").slice(0, 3), wordsOf(sample[8])[0] ?? "steel"]
				.join(" ")
				.toLowerCase(),
			kind: "two-words-partial-reversed",
			source: sample[8],
		},
		// The space forgotten: a subsequence of the source, but not a phrase.
		{
			query: wordsOf(sample[8]).slice(0, 2).join("").toLowerCase(),
			kind: "two-words-joined",
			source: sample[8],
		},
		// No source: one word the item lacks splits AND engines from OR engines,
		// and neither answer is wrong.
		{
			query: [...wordsOf(sample[8]).slice(0, 2), wordAt(4)].join(" ").toLowerCase(),
			kind: "two-words-extra",
			source: null,
		},
		// Phrase typos take a different route entirely (presence gate + per-word
		// rescue): typo in the first word, the second, reversed order, and both
		// words mistyped — two edits, which a one-edit rescue must refuse.
		{
			query: [substitute(wordsOf(sample[8])[0] ?? "steel"), wordsOf(sample[8])[1] ?? "chair"]
				.join(" ")
				.toLowerCase(),
			kind: "two-words-typo",
			source: sample[8],
		},
		{
			query: [wordsOf(sample[8])[0] ?? "steel", substitute(wordsOf(sample[8])[1] ?? "chair")]
				.join(" ")
				.toLowerCase(),
			kind: "two-words-typo-second",
			source: sample[8],
		},
		{
			query: [wordsOf(sample[8])[1] ?? "chair", substitute(wordsOf(sample[8])[0] ?? "steel")]
				.join(" ")
				.toLowerCase(),
			kind: "two-words-typo-reversed",
			source: sample[8],
		},
		// No source: the right answer is nothing.
		{
			query: [
				substitute(wordsOf(sample[8])[0] ?? "steel"),
				substitute(wordsOf(sample[8])[1] ?? "chair"),
			]
				.join(" ")
				.toLowerCase(),
			kind: "two-words-double-typo",
			source: null,
		},
		{ query: sample[42].slice(0, 5).toLowerCase(), kind: "prefix", source: sample[42] },
	];

	// An interior slice, never a prefix: separates contains-anywhere matching
	// from start-anchored ranking.
	for (let i = 900; i < sample.length; i++) {
		const infixWord = wordsOf(sample[i])[0] ?? "";
		if (infixWord.length >= 8) {
			specs.push({ query: infixWord.slice(2, 7).toLowerCase(), kind: "infix", source: sample[i] });
			break;
		}
	}
	// Graded scatter probes from ONE ≥7-char source word; where a library stops
	// surfacing the source is its effective fuzzy limit. The word must be
	// near-unique: faker template words appear in ~80 items, and a source's
	// rank inside such a tie block is stable-sort corpus order — noise. This is
	// what makes rank mean rank on every probe derived from this word.
	const corpus10k = build(10_000).map((item) => item.toLowerCase());
	const isNearUnique = (word: string): boolean => {
		const needle = word.toLowerCase();
		let holders = 0;
		for (const item of corpus10k) {
			if (item.includes(needle) && wordsOf(item).includes(needle) && ++holders > 2) return false;
		}
		return true;
	};
	// A plural against a singular-only corpus: one deletion. The word must be
	// absent in plural form (or the probe measures nothing) and near-unique by
	// the same tie-block argument.
	{
		const present = new Set(sample.flatMap((s) => wordsOf(s).map((w) => w.toLowerCase())));
		outer: for (let i = 0; i < sample.length; i++) {
			for (const raw of wordsOf(sample[i])) {
				const word = raw.toLowerCase();
				if (word.length < 5 || word.endsWith("s") || present.has(`${word}s`)) continue;
				if (!isNearUnique(word)) continue;
				specs.push({ query: `${word}s`, kind: "plural-to-singular", source: sample[i] });
				break outer;
			}
		}
	}
	// Below ekrina's five-character typo floor on purpose: what the floor loses.
	for (let i = 1300; i < sample.length; i++) {
		const shortWord = wordsOf(sample[i])[0] ?? "";
		if (/^\p{L}{4}$/u.test(shortWord) && isNearUnique(shortWord)) {
			specs.push({
				query: substitute(shortWord).toLowerCase(),
				kind: "short-word-typo",
				source: sample[i],
			});
			break;
		}
	}
	for (let i = 1300; i < sample.length; i++) {
		const scatterWord = wordsOf(sample[i])[0] ?? "";
		if (scatterWord.length >= 7 && isNearUnique(scatterWord)) {
			const mid = Math.floor(scatterWord.length / 2);
			specs.push(
				{
					query: (scatterWord.slice(0, mid) + scatterWord.slice(mid + 1)).toLowerCase(),
					kind: "scatter-light",
					source: sample[i],
				},
				{
					query: [...scatterWord]
						.filter((_, k) => k % 3 !== 2)
						.join("")
						.toLowerCase(),
					kind: "scatter-medium",
					source: sample[i],
				},
				{ query: everyOther(scatterWord).toLowerCase(), kind: "scatter-heavy", source: sample[i] },
				// The three edits that break the subsequence property outright —
				// only edit-distance matching recovers these.
				{ query: transpose(scatterWord).toLowerCase(), kind: "transposition", source: sample[i] },
				{ query: doubleChar(scatterWord).toLowerCase(), kind: "insertion", source: sample[i] },
				{ query: substitute(scatterWord).toLowerCase(), kind: "substitution", source: sample[i] },
			);
			break;
		}
	}
	// Initials of the first 3+-word item ("Rath, Streich and Witting" → "rsaw");
	// subsequence engines can only hit these as scattered chains.
	const acronymItem = sample.find((item) => wordsOf(item).length >= 3);
	if (acronymItem) {
		specs.push({
			query: wordsOf(acronymItem)
				.map((w) => w[0])
				.join("")
				.toLowerCase(),
			kind: "acronym",
			source: acronymItem,
		});
	}
	const isAccentedWord = (w: string): boolean => w.length >= 4 && stripAccents(w) !== w;
	const accentedItem = sample.find((item) => wordsOf(item).some(isAccentedWord));
	if (accentedItem) {
		const accentedWord = wordsOf(accentedItem).find(isAccentedWord) as string;
		specs.push({
			query: stripAccents(accentedWord).toLowerCase(),
			kind: "accent-stripped",
			source: accentedItem,
		});
	}
	specs.push({ query: "qxzwkv", kind: "miss", source: null });
	return specs;
};

// The kinds timed cold, one process per cell: each takes a different path
// through a matcher (literal, phrase, rescue, prefix, initials, refusal), and
// timing every kind multiplied the processes for no new path.
export const TIMED_KINDS: QuerySpec["kind"][] = [
	"short-word",
	"two-words",
	"substitution",
	"prefix",
	"acronym",
	"miss",
];

// A sampled query is scored against every item a person typing it could have
// meant, so no library is credited for breaking a tie the right way. Refusal
// families have no relevant item at all and are reported, not scored.
export type SampledQuery = {
	kind: QuerySpec["kind"];
	query: string;
	relevant: ((item: string) => boolean) | null;
};

const SAMPLES_PER_FAMILY = 10;
const SAMPLE_SIZE = 10_000;

// Relevance is judged on the bench's own folding, never the library under test's.
const fold = (s: string): string => stripAccents(s).toLowerCase();
const foldedWordsCache = new Map<string, string[]>();
const foldedWords = (item: string): string[] => {
	let words = foldedWordsCache.get(item);
	if (words === undefined) foldedWordsCache.set(item, (words = wordsOf(fold(item))));
	return words;
};
const holdsWords =
	(...wanted: string[]) =>
	(item: string): boolean => {
		const words = foldedWords(item);
		return wanted.every((w) => words.includes(fold(w)));
	};
const holdsWordWhere =
	(test: (word: string) => boolean, ...alsoHolds: string[]) =>
	(item: string): boolean =>
		foldedWords(item).some(test) && holdsWords(...alsoHolds)(item);
const initialsOf = (item: string): string =>
	foldedWords(item)
		.map((w) => w[0])
		.join("");

// A fixed shuffle of the list, so sources come from every position rather
// than the head, where a list-order tie-break would favour them.
const shuffledIndices = (n: number, seed: number): number[] => {
	const order = Array.from({ length: n }, (_, i) => i);
	let state = seed;
	for (let i = n - 1; i > 0; i--) {
		state = (state * 1103515245 + 12345) & 0x7fffffff;
		const j = state % (i + 1);
		[order[i], order[j]] = [order[j], order[i]];
	}
	return order;
};

type Derived = { query: string; relevant: ((item: string) => boolean) | null } | null;
type Family = { kind: QuerySpec["kind"]; derive: (words: string[], item: string) => Derived };

const sampleQueries = (build: (n: number) => string[]): SampledQuery[] => {
	const items = build(SAMPLE_SIZE);
	const vocabulary = new Set(items.flatMap(foldedWords));
	// A corrupted query that is itself a corpus word is a correct query, not a typo.
	const typo = (query: string): string | null => (vocabulary.has(fold(query)) ? null : query);
	const noItemHolds = (...words: string[]): boolean => !items.some(holdsWords(...words));
	const twoWords = (words: string[]): words is [string, string, ...string[]] =>
		words.length >= 2 && words[0].length >= 3 && words[1].length >= 3;

	const families: Family[] = [
		{ kind: "long-word", derive: ([w]) => (w?.length >= 7 ? { query: w, relevant: holdsWords(w) } : null) },
		{
			kind: "short-word",
			derive: ([w]) => (w && w.length >= 4 && w.length <= 6 ? { query: w, relevant: holdsWords(w) } : null),
		},
		{
			kind: "two-words",
			derive: (ws) => (twoWords(ws) ? { query: `${ws[0]} ${ws[1]}`, relevant: holdsWords(ws[0], ws[1]) } : null),
		},
		{
			kind: "two-words-reversed",
			derive: (ws) => (twoWords(ws) ? { query: `${ws[1]} ${ws[0]}`, relevant: holdsWords(ws[0], ws[1]) } : null),
		},
		{
			kind: "two-words-partial-reversed",
			derive: (ws) => {
				if (!twoWords(ws) || ws[1].length < 5) return null;
				const typed = fold(ws[1].slice(0, 3));
				return {
					query: `${ws[1].slice(0, 3)} ${ws[0]}`,
					relevant: holdsWordWhere((w) => w.startsWith(typed), ws[0]),
				};
			},
		},
		{
			kind: "two-words-joined",
			derive: (ws) => {
				const query = twoWords(ws) ? typo(ws[0] + ws[1]) : null;
				return query ? { query, relevant: holdsWords(ws[0], ws[1]) } : null;
			},
		},
		{
			kind: "two-words-typo",
			derive: (ws) => {
				const t = twoWords(ws) && ws[0].length >= 5 ? typo(substitute(ws[0])) : null;
				return t ? { query: `${t} ${ws[1]}`, relevant: holdsWords(ws[0], ws[1]) } : null;
			},
		},
		{
			kind: "two-words-typo-second",
			derive: (ws) => {
				const t = twoWords(ws) && ws[1].length >= 5 ? typo(substitute(ws[1])) : null;
				return t ? { query: `${ws[0]} ${t}`, relevant: holdsWords(ws[0], ws[1]) } : null;
			},
		},
		{
			kind: "two-words-typo-reversed",
			derive: (ws) => {
				const t = twoWords(ws) && ws[0].length >= 5 ? typo(substitute(ws[0])) : null;
				return t ? { query: `${ws[1]} ${t}`, relevant: holdsWords(ws[0], ws[1]) } : null;
			},
		},
		{
			kind: "plural-to-singular",
			derive: (ws) => {
				const w = ws.find((word) => word.length >= 5 && !word.endsWith("s") && typo(`${word}s`));
				return w ? { query: `${w}s`, relevant: holdsWords(w) } : null;
			},
		},
		{
			kind: "short-word-typo",
			derive: ([w]) => {
				const t = w && /^\p{L}{4}$/u.test(w) ? typo(substitute(w)) : null;
				return t ? { query: t, relevant: holdsWords(w) } : null;
			},
		},
		{
			kind: "prefix",
			derive: ([w]) => {
				if (!w || w.length < 6) return null;
				const typed = w.slice(0, 5);
				return { query: typed, relevant: holdsWordWhere((word) => word.startsWith(fold(typed))) };
			},
		},
		{
			kind: "infix",
			derive: ([w]) => {
				if (!w || w.length < 8) return null;
				const typed = w.slice(2, 7);
				return { query: typed, relevant: holdsWordWhere((word) => word.includes(fold(typed))) };
			},
		},
		...(
			[
				["scatter-light", (w: string) => w.slice(0, w.length >> 1) + w.slice((w.length >> 1) + 1)],
				["scatter-medium", (w: string) => [...w].filter((_, k) => k % 3 !== 2).join("")],
				["scatter-heavy", everyOther],
				["transposition", transpose],
				["insertion", doubleChar],
				["substitution", substitute],
			] as const
		).map(
			([kind, corrupt]): Family => ({
				kind,
				derive: ([w]) => {
					const t = w && w.length >= 7 ? typo(corrupt(w)) : null;
					return t && t !== w ? { query: t, relevant: holdsWords(w) } : null;
				},
			}),
		),
		{
			kind: "acronym",
			derive: (ws, item) =>
				ws.length >= 3 ? { query: initialsOf(item), relevant: (other) => initialsOf(other) === initialsOf(item) } : null,
		},
		{
			kind: "accent-stripped",
			derive: (ws) => {
				const w = ws.find((word) => word.length >= 4 && stripAccents(word) !== word);
				return w ? { query: stripAccents(w), relevant: holdsWords(w) } : null;
			},
		},
		{
			kind: "two-words-extra",
			derive: (ws, item) => {
				if (!twoWords(ws)) return null;
				const other = foldedWords(items[(items.indexOf(item) + 4999) % items.length])[0];
				return other && noItemHolds(ws[0], ws[1], other)
					? { query: `${ws[0]} ${ws[1]} ${other}`, relevant: null }
					: null;
			},
		},
		{
			kind: "two-words-double-typo",
			derive: (ws) => {
				if (!twoWords(ws) || ws[0].length < 5 || ws[1].length < 5) return null;
				const first = typo(substitute(ws[0]));
				const second = typo(substitute(ws[1]));
				return first && second ? { query: `${first} ${second}`, relevant: null } : null;
			},
		},
	];

	const sampled: SampledQuery[] = [];
	for (const [seed, { kind, derive }] of families.entries()) {
		const seen = new Set<string>();
		for (const at of shuffledIndices(items.length, seed + 1)) {
			if (seen.size === SAMPLES_PER_FAMILY) break;
			const derived = derive(wordsOf(items[at].toLowerCase()), items[at]);
			if (!derived || seen.has(derived.query)) continue;
			seen.add(derived.query);
			sampled.push({ kind, ...derived });
		}
	}
	return sampled;
};

export type Corpus = {
	name: "ascii" | "mixed";
	build: (n: number) => string[];
	specs: QuerySpec[];
	queries: string[];
	samples: SampledQuery[];
};

const makeCorpus = (name: Corpus["name"], build: (n: number) => string[]): Corpus => {
	const specs = deriveQueries(build);
	return { name, build, specs, queries: specs.map((s) => s.query), samples: sampleQueries(build) };
};

export const CORPORA: Corpus[] = [
	makeCorpus("ascii", slicer(asciiJson)),
	makeCorpus("mixed", slicer(mixedJson)),
];
