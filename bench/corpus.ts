/**
 * Corpora + queries from the committed corpus-*.json snapshots. Frozen on
 * purpose: every published rank and MRR derives from these exact sequences,
 * and regenerating them (corpus-wikidata-gen.test.ts, corpus-emoji-gen.test.ts)
 * redraws every query too. `en` holds the English labels of the best-known
 * Wikidata people, places, works, organisations and products; `native` the same
 * items under their native names where Wikidata records one, so a tenth of it is
 * in a non-Latin script. Every representative query records its `source` item
 * so hits.test.ts can check each library surfaces it, and where.
 */
import { readFileSync } from "node:fs";
import { type CatalogueSample, catalogueSamples, HELD_OUT_SEED, type Misspellings } from "./catalogue.ts";
import { foldedWords, stripAccents, wordsOf } from "./words.ts";

// readFileSync, not JSON module imports: import attributes differ between
// vitest's bundler and plain node (bench/run.ts children).
const loadJson = <T>(file: string): T => JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8")) as T;

/** Correct word → misspellings seen in the wild, from Wikipedia's list (misspellings.json). */
const MISSPELLINGS: Misspellings = loadJson<{ misspellings: Misspellings }>("./misspellings.json").misspellings;

// Interleaved at generation, so a prefix slice keeps the corpus's mix
// (1k ⊂ 10k ⊂ 100k) and queries derived from a small slice hit at any size.
const slicer =
	(data: string[]) =>
	(n: number): string[] => {
		if (n > data.length) throw new Error(`corpus snapshot has ${data.length} items; asked for ${n}`);
		return data.slice(0, n);
	};

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

const plain = (word: string | undefined): word is string => word !== undefined && /^[a-z]+$/.test(word);
const everyOther = (w: string): string => [...w].filter((_, k) => k % 2 === 0).join("");

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

// Each kind takes the first item, from a fixed start, that can carry it: two
// plain words, a long enough word, a word few items hold. A query a library
// ranks inside a block of identical candidates measures list order, so every
// word the probes are built on is held by at most two items of the 10k list.
const deriveQueries = (build: (n: number) => string[]): { specs: QuerySpec[]; warmup: string } => {
	const sample = build(2000);
	const list = build(10_000);
	const holding = new Map<string, Set<number>>();
	for (const [at, item] of list.entries()) {
		for (const word of foldedWords(item)) holding.set(word, (holding.get(word) ?? new Set()).add(at));
	}
	const vocabulary = new Set(holding.keys());
	const holders = (first: string, ...rest: string[]): number =>
		[...(holding.get(first) ?? [])].filter((at) => rest.every((word) => holding.get(word)?.has(at))).length;
	const isNearUnique = (first: string, ...rest: string[]): boolean => holders(first, ...rest) <= 2;
	const isTypo = (query: string): boolean => !query.split(" ").every((word) => vocabulary.has(word));
	const firstFrom = <T>(start: number, pick: (item: string) => T | null): [T, string] => {
		for (let i = start; i < sample.length; i++) {
			const found = pick(sample[i]);
			if (found !== null) return [found, sample[i]];
		}
		throw new Error(`no item from ${start} carries this probe`);
	};
	const firstWord = (min: number, max = Infinity) => (item: string): string | null => {
		const word = foldedWords(item)[0];
		return plain(word) && word.length >= min && word.length <= max && isNearUnique(word) ? word : null;
	};

	const [longWord, longSource] = firstFrom(4, firstWord(7));
	const [shortWord, shortSource] = firstFrom(500, firstWord(4, 6));
	const [[a, b], pairSource] = firstFrom(8, (item) => {
		const [x, y] = foldedWords(item);
		const typed = plain(x) && plain(y) && x.length >= 5 && y.length >= 5;
		return typed && isNearUnique(x, y) && isTypo(substitute(x)) && isTypo(substitute(y)) ? [x, y] : null;
	});
	const [extra] = firstFrom(4, (item) => {
		const word = foldedWords(item)[0];
		return plain(word) && word.length >= 5 && word !== a && word !== b && holders(a, b, word) === 0 ? word : null;
	});
	const [prefix, prefixSource] = firstFrom(42, (item) => {
		const word = foldedWords(item)[0];
		return plain(word) && word.length >= 6 ? word.slice(0, 5) : null;
	});
	const [infix, infixSource] = firstFrom(900, (item) => {
		const word = firstWord(8)(item);
		return word ? word.slice(2, 7) : null;
	});
	// A plural against a singular-only corpus: one deletion. The plural must be
	// absent, or the probe measures nothing.
	const [plural, pluralSource] = firstFrom(0, (item) => {
		const word = foldedWords(item).find((w) => plain(w) && w.length >= 5 && !w.endsWith("s") && isNearUnique(w));
		return word && !vocabulary.has(`${word}s`) ? `${word}s` : null;
	});
	// Below ekrina's five-character typo floor on purpose: what the floor loses.
	const [shortTypo, shortTypoSource] = firstFrom(1300, (item) => {
		const word = firstWord(4, 4)(item);
		return word && isTypo(substitute(word)) ? substitute(word) : null;
	});
	// Graded scatter probes from one source word; where a library stops
	// surfacing the source is its effective fuzzy limit.
	const [scatterWord, scatterSource] = firstFrom(1300, (item) => {
		const word = firstWord(7)(item);
		return word && [substitute(word), transpose(word), doubleChar(word)].every(isTypo) ? word : null;
	});
	const mid = Math.floor(scatterWord.length / 2);
	const [acronym, acronymSource] = firstFrom(0, (item) => {
		const words = foldedWords(item);
		return words.length >= 3 && words.length <= 4 && words.every(plain) ? words.map((w) => w[0]).join("") : null;
	});
	const [accentStripped, accentSource] = firstFrom(0, (item) => {
		const word = wordsOf(item.toLowerCase()).find((w) => w.length >= 4 && stripAccents(w) !== w);
		return word ? stripAccents(word) : null;
	});

	const specs: QuerySpec[] = [
		{ query: longWord, kind: "long-word", source: longSource },
		{ query: shortWord, kind: "short-word", source: shortSource },
		{ query: `${a} ${b}`, kind: "two-words", source: pairSource },
		// Substring engines pass the in-order phrase without trying; only genuinely
		// tokenised matching survives the reversal.
		{ query: `${b} ${a}`, kind: "two-words-reversed", source: pairSource },
		// Mid-keystroke on the second word, reversed so no engine passes it as a
		// prefix of the source.
		{ query: `${b.slice(0, 3)} ${a}`, kind: "two-words-partial-reversed", source: pairSource },
		// The space forgotten: a subsequence of the source, but not a phrase.
		{ query: `${a}${b}`, kind: "two-words-joined", source: pairSource },
		// No source: one word the item lacks splits AND engines from OR engines,
		// and neither answer is wrong.
		{ query: `${a} ${b} ${extra}`, kind: "two-words-extra", source: null },
		// Phrase typos take a different route entirely (presence gate + per-word
		// rescue): typo in the first word, the second, reversed order, and both
		// words mistyped, one edit each.
		{ query: `${substitute(a)} ${b}`, kind: "two-words-typo", source: pairSource },
		{ query: `${a} ${substitute(b)}`, kind: "two-words-typo-second", source: pairSource },
		{ query: `${b} ${substitute(a)}`, kind: "two-words-typo-reversed", source: pairSource },
		{ query: `${substitute(a)} ${substitute(b)}`, kind: "two-words-double-typo", source: pairSource },
		{ query: prefix, kind: "prefix", source: prefixSource },
		// An interior slice, never a prefix: separates contains-anywhere matching
		// from start-anchored ranking.
		{ query: infix, kind: "infix", source: infixSource },
		{ query: plural, kind: "plural-to-singular", source: pluralSource },
		{ query: shortTypo, kind: "short-word-typo", source: shortTypoSource },
		{ query: scatterWord.slice(0, mid) + scatterWord.slice(mid + 1), kind: "scatter-light", source: scatterSource },
		{ query: [...scatterWord].filter((_, k) => k % 3 !== 2).join(""), kind: "scatter-medium", source: scatterSource },
		{ query: everyOther(scatterWord), kind: "scatter-heavy", source: scatterSource },
		// The three edits that break the subsequence property outright — only
		// edit-distance matching recovers these.
		{ query: transpose(scatterWord), kind: "transposition", source: scatterSource },
		{ query: doubleChar(scatterWord), kind: "insertion", source: scatterSource },
		{ query: substitute(scatterWord), kind: "substitution", source: scatterSource },
		// Subsequence engines can only hit initials as scattered chains.
		{ query: acronym, kind: "acronym", source: acronymSource },
		{ query: accentStripped, kind: "accent-stripped", source: accentSource },
		{ query: "qxzwkv", kind: "miss", source: null },
	];
	// A batch opens on a literal hit like the short-word probe but none of the
	// probes, so no probe it times is answered twice in one process.
	const probes = new Set(specs.map((s) => s.query));
	const [warmup] = firstFrom(500, (item) => {
		const word = firstWord(4, 6)(item);
		return word !== null && !probes.has(word) ? word : null;
	});
	return { specs, warmup };
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

export const SAMPLE_SIZE = 10_000;

export type Corpus = {
	name: "en" | "native";
	build: (n: number) => string[];
	specs: QuerySpec[];
	warmup: string;
	queries: string[];
	samples: CatalogueSample[];
};

// Derived on first use: every bench/run.ts child loads this module only to
// build a list, and would otherwise pay for queries it never runs.
const makeCorpus = (name: Corpus["name"]): Corpus => {
	const build = slicer(loadJson<string[]>(`./corpus-${name}.json`));
	let derived: ReturnType<typeof deriveQueries> | undefined;
	let samples: CatalogueSample[] | undefined;
	return {
		name,
		build,
		get specs() {
			return (derived ??= deriveQueries(build)).specs;
		},
		get warmup() {
			return (derived ??= deriveQueries(build)).warmup;
		},
		get queries() {
			return this.specs.map((s) => s.query);
		},
		get samples() {
			return (samples ??= catalogueSamples(build(SAMPLE_SIZE), MISSPELLINGS));
		},
	};
};

// Items no published family was drawn from, sampled under other seeds: a
// tuning change the published families like should hold here too, or it is fit
// to the published queries rather than to typing.
const HELD_OUT_FROM = 50_000;

export type HeldOut = { items: string[]; samples: CatalogueSample[] };

export const heldOut = (corpus: Corpus): HeldOut => {
	const items = corpus.build(HELD_OUT_FROM + SAMPLE_SIZE).slice(HELD_OUT_FROM);
	return { items, samples: catalogueSamples(items, MISSPELLINGS, HELD_OUT_SEED) };
};

export const CORPORA: Corpus[] = [makeCorpus("en"), makeCorpus("native")];

/**
 * A whole list too short for the 10k and 100k cells: timed at its own length,
 * and kept out of every speed ranking.
 */
export type Picker = {
	name: "emoji";
	items: string[];
	samples: CatalogueSample[];
	specs: QuerySpec[];
	warmup: string;
};

const makePicker = (name: Picker["name"]): Picker => {
	const items = loadJson<string[]>(`./corpus-${name}.json`);
	let samples: CatalogueSample[] | undefined;
	let derived: ReturnType<typeof deriveQueries> | undefined;
	return {
		name,
		items,
		get samples() {
			return (samples ??= catalogueSamples(items, MISSPELLINGS));
		},
		get specs() {
			return (derived ??= deriveQueries((n) => items.slice(0, n))).specs;
		},
		get warmup() {
			return (derived ??= deriveQueries((n) => items.slice(0, n))).warmup;
		},
	};
};

export const PICKERS: Picker[] = [makePicker("emoji")];
