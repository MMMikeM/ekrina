// Query families drawn from how people mistype and misspell, each capped at a
// strength people actually reach, and weighted by group before any library is
// measured. Diagnostic until it replaces corpus.ts's families: catalogue.test.ts
// reports it, and no published number reads it.
import { answeredByFew, foldedWords, holdsWordWhere, holdsWords, shuffledIndices, wordsOf } from "./corpus";
import { ACCENTED } from "./frontier.ts";
import { applyEdits, EDITS, type EditName, neighbourOf, type Random, randomLetterFor, seeded } from "./limits.ts";
import type { Sample } from "./mrr.ts";

export type Group = "typos" | "phonetic" | "partial words" | "query shape" | "noise" | "reported only";

/** The headline's weight for each group, fixed before measuring. Reported-only families carry none. */
export const WEIGHTS: Record<Group, number> = {
	typos: 0.35,
	phonetic: 0.25,
	"partial words": 0.15,
	"query shape": 0.15,
	noise: 0.1,
	"reported only": 0,
};

type Derived = { query: string; relevant: (item: string) => boolean } | null;
type Family = {
	group: Group;
	kind: string;
	derive: (words: string[], raw: string[], random: Random, isTypo: (query: string) => boolean) => Derived;
};

const SAMPLES_PER_FAMILY = 10;
// Clear of every other seed range: published 0, held out 1000, limits 2000, frontier 3000.
const SEED_OFFSET = 4_000;

const plain = (word: string | undefined): word is string => word !== undefined && /^[a-z]+$/.test(word);
const wordOf = (words: string[], min: number): string | undefined => words.find((word) => plain(word) && word.length >= min);
const twoWords = (words: string[], min = 3): [string, string] | null =>
	plain(words[0]) && plain(words[1]) && words[0].length >= min && words[1].length >= min ? [words[0], words[1]] : null;
const stripAccents = (s: string): string => s.normalize("NFD").replace(/\p{M}+/gu, "");

const edited = (word: string, edit: EditName, at: number, random: Random): string | null => EDITS[edit](word, at, random);
const middle = (word: string): number => word.length >> 1;

const oneWordTypo = (kind: string, min: number, corrupt: (word: string, random: Random) => string | null): Family => ({
	group: "typos",
	kind,
	derive: (words, _raw, random, isTypo) => {
		const word = wordOf(words, min);
		const typed = word ? corrupt(word, random) : null;
		return word && typed && typed !== word && isTypo(typed) ? { query: typed, relevant: holdsWords(word) } : null;
	},
});

// A sound-alike spelling: each rule rewrites one occurrence of a pattern into
// another spelling of the same sound.
type Rule = [RegExp, string];

const CONSONANT_SOUNDS: Rule[] = [
	[/ph/, "f"],
	[/(?<=^|[aeiou])f(?=[aeiou])/, "ph"],
	[/c(?=[eiy])/, "s"],
	[/c(?=[aou])/, "k"],
	[/ck/, "k"],
	[/qu/, "kw"],
	[/(?<=.)x/, "ks"],
	[/(?<=.)s(?=[aeiou])/, "z"],
];
const DOUBLED_LETTERS: Rule[] = [
	[/([bcdfglmnprstz])\1/, "$1"],
	[/(?<=[aeiou])([bcdfglmnprtz])(?=[aeiou])/, "$1$1"],
];
const SILENT_LETTERS: Rule[] = [
	[/^kn/, "n"],
	[/^wr/, "r"],
	[/^gn/, "n"],
	[/^ps/, "s"],
	[/mb$/, "m"],
	[/^wh/, "w"],
	[/ight/, "ite"],
	[/ough/, "uf"],
	[/(?<=[aeiou])gh/, ""],
];
const VOWEL_SOUNDS: Rule[] = [
	[/ie/, "ei"],
	[/ei/, "ie"],
	[/ea/, "ee"],
	[/ee/, "ea"],
	[/(?<=[^aeiou])y(?=[^aeiou])/, "i"],
	[/(?<=[^aeiou])er$/, "re"],
	[/(?<=[^aeiou])re$/, "er"],
	[/[ts]ion$/, "shun"],
];

const soundAlike = (kind: string, rules: Rule[]): Family => ({
	group: "phonetic",
	kind,
	derive: (words, _raw, random, isTypo) => {
		const candidates = words.filter((word) => plain(word) && word.length >= 4);
		for (const word of candidates) {
			const applicable = rules.filter(([pattern]) => pattern.test(word));
			if (applicable.length === 0) continue;
			const [pattern, spelling] = applicable[Math.floor(random() * applicable.length)];
			const typed = word.replace(pattern, spelling);
			if (typed !== word && isTypo(typed)) return { query: typed, relevant: holdsWords(word) };
		}
		return null;
	},
});

const halfTyped = (words: string[]): Derived => {
	const pair = twoWords(words, 5);
	if (!pair) return null;
	const typed = pair.map((word) => word.slice(0, 3));
	return {
		query: typed.join(" "),
		relevant: (item) => typed.every((prefix) => foldedWords(item).some((word) => word.startsWith(prefix))),
	};
};

const vowelsDropped = (count: number): Family => ({
	group: "partial words",
	kind: `${count === 1 ? "a vowel" : `${count} vowels`} dropped`,
	derive: (words, _raw, _random, isTypo) => {
		const word = wordOf(words, 6);
		if (!word) return null;
		const vowelsAt = [...word].flatMap((char, k) => (k > 0 && "aeiou".includes(char) ? [k] : []));
		if (vowelsAt.length < count + 1) return null;
		const dropped = new Set(vowelsAt.slice(0, count));
		const typed = [...word].filter((_, k) => !dropped.has(k)).join("");
		return isTypo(typed) ? { query: typed, relevant: holdsWords(word) } : null;
	},
});

const FAMILIES: Family[] = [
	oneWordTypo("neighbouring key", 5, (w, r) => edited(w, "substitute-near", middle(w), r)),
	oneWordTypo("two neighbouring keys", 8, (w, r) => applyEdits(w, ["substitute-near", "substitute-near"], r)),
	oneWordTypo("random letter", 5, (w, r) => edited(w, "substitute-random", middle(w), r)),
	oneWordTypo("dropped letter", 5, (w, r) => edited(w, "drop", middle(w), r)),
	oneWordTypo("two dropped letters", 8, (w, r) => applyEdits(w, ["drop", "drop"], r)),
	oneWordTypo("inserted neighbouring key", 5, (w, r) => edited(w, "insert-near", middle(w), r)),
	oneWordTypo("swapped neighbours", 5, (w, r) => edited(w, "swap", middle(w), r)),
	oneWordTypo("stuck key", 5, (w) => w.slice(0, middle(w) + 1) + w[middle(w)].repeat(2) + w.slice(middle(w) + 1)),
	oneWordTypo("first letter wrong", 5, (w, r) => neighbourOf(w[0], r) + w.slice(1)),
	{
		group: "typos",
		kind: "typo in each of two words",
		derive: (words, _raw, random, isTypo) => {
			const pair = twoWords(words, 5);
			if (!pair) return null;
			const typed = pair.map((word) => edited(word, "substitute-near", middle(word), random));
			return typed.every((t) => t && isTypo(t)) ? { query: typed.join(" "), relevant: holdsWords(...pair) } : null;
		},
	},
	{
		group: "typos",
		kind: "typo then a half-typed word",
		derive: (words, _raw, random, isTypo) => {
			const pair = twoWords(words, 5);
			const head = pair ? edited(pair[0], "substitute-near", middle(pair[0]), random) : null;
			if (!pair || !head || !isTypo(head)) return null;
			const tail = pair[1].slice(0, 3);
			return { query: `${head} ${tail}`, relevant: holdsWordWhere((word) => word.startsWith(tail), pair[0]) };
		},
	},
	{
		group: "typos",
		kind: "two words joined, with a typo",
		derive: (words, _raw, random, isTypo) => {
			const pair = twoWords(words, 4);
			const joined = pair ? pair.join("") : "";
			const typed = pair ? edited(joined, "substitute-near", pair[0].length + middle(pair[1]), random) : null;
			return pair && typed && isTypo(typed) ? { query: typed, relevant: holdsWords(...pair) } : null;
		},
	},

	soundAlike("consonant spelt another way", CONSONANT_SOUNDS),
	soundAlike("letter doubled or singled", DOUBLED_LETTERS),
	soundAlike("silent letters dropped", SILENT_LETTERS),
	soundAlike("vowel sound spelt another way", VOWEL_SOUNDS),

	...[3, 5].map(
		(length): Family => ({
			group: "partial words",
			kind: `prefix of ${length}`,
			derive: (words) => {
				const word = wordOf(words, length + 2);
				if (!word) return null;
				const typed = word.slice(0, length);
				return { query: typed, relevant: holdsWordWhere((w) => w.startsWith(typed)) };
			},
		}),
	),
	{
		group: "partial words",
		kind: "infix of 5",
		derive: (words) => {
			const word = wordOf(words, 8);
			if (!word) return null;
			const typed = word.slice(2, 7);
			return { query: typed, relevant: holdsWordWhere((w) => w.includes(typed)) };
		},
	},
	{ group: "partial words", kind: "two words half typed", derive: halfTyped },
	vowelsDropped(1),
	vowelsDropped(2),

	{
		group: "query shape",
		kind: "two words",
		derive: (words) => {
			const pair = twoWords(words);
			return pair ? { query: pair.join(" "), relevant: holdsWords(...pair) } : null;
		},
	},
	{
		group: "query shape",
		kind: "two words reversed",
		derive: (words) => {
			const pair = twoWords(words);
			return pair ? { query: `${pair[1]} ${pair[0]}`, relevant: holdsWords(...pair) } : null;
		},
	},
	{
		group: "query shape",
		kind: "two words joined",
		derive: (words, _raw, _random, isTypo) => {
			const pair = twoWords(words);
			return pair && isTypo(pair.join("")) ? { query: pair.join(""), relevant: holdsWords(...pair) } : null;
		},
	},
	{
		group: "query shape",
		kind: "an absent word added",
		derive: (words, _raw, random, isTypo) => {
			const pair = twoWords(words);
			const extra = Array.from({ length: 6 }, () => randomLetterFor("", random)).join("");
			return pair && isTypo(extra) ? { query: `${pair.join(" ")} ${extra}`, relevant: holdsWords(...pair) } : null;
		},
	},

	{
		group: "noise",
		kind: "space inside a word",
		derive: (words) => {
			const word = wordOf(words, 7);
			return word ? { query: `${word.slice(0, middle(word))} ${word.slice(middle(word))}`, relevant: holdsWords(word) } : null;
		},
	},
	{
		group: "noise",
		kind: "punctuation inside a word",
		derive: (words) => {
			const word = wordOf(words, 7);
			return word ? { query: `${word.slice(0, middle(word))}-${word.slice(middle(word))}`, relevant: holdsWords(word) } : null;
		},
	},
	{
		group: "noise",
		kind: "accents stripped",
		derive: (_words, raw) => {
			const word = raw.find((w) => w.length >= 4 && stripAccents(w) !== w);
			return word ? { query: stripAccents(word), relevant: holdsWords(word) } : null;
		},
	},
	{
		group: "noise",
		kind: "accents added",
		derive: (words) => {
			const word = words.find((w) => plain(w) && w.length >= 5 && [...w].some((char) => ACCENTED[char]));
			if (!word) return null;
			const at = [...word].findIndex((char) => ACCENTED[char]);
			return { query: word.slice(0, at) + ACCENTED[word[at]] + word.slice(at + 1), relevant: holdsWords(word) };
		},
	},

	{
		group: "reported only",
		kind: "acronym",
		derive: (words) => {
			if (words.length < 3) return null;
			const initials = words.map((word) => word[0]).join("");
			return { query: initials, relevant: (item) => foldedWords(item).map((word) => word[0]).join("") === initials };
		},
	},
	{
		group: "reported only",
		kind: "plural for a singular",
		derive: (words, _raw, _random, isTypo) => {
			const word = words.find((w) => plain(w) && w.length >= 5 && !w.endsWith("s") && isTypo(`${w}s`));
			return word ? { query: `${word}s`, relevant: holdsWords(word) } : null;
		},
	},
];

export type CatalogueSample = Sample & { group: Group };

/** Up to ten queries per family over `items`, each answered by at most three of them. */
export const catalogueSamples = (items: string[]): CatalogueSample[] => {
	const vocabulary = new Set(items.flatMap(foldedWords));
	const isTypo = (query: string): boolean => !query.split(" ").every((word) => vocabulary.has(word));
	const sampled: CatalogueSample[] = [];
	for (const [seed, { group, kind, derive }] of FAMILIES.entries()) {
		const random = seeded(SEED_OFFSET + seed + 1);
		const seen = new Set<string>();
		for (const at of shuffledIndices(items.length, SEED_OFFSET + seed + 1)) {
			if (seen.size === SAMPLES_PER_FAMILY) break;
			const derived = derive(foldedWords(items[at]), wordsOf(items[at].toLowerCase()), random, isTypo);
			if (!derived || seen.has(derived.query) || !answeredByFew(items, derived.relevant)) continue;
			seen.add(derived.query);
			sampled.push({ group, kind, ...derived });
		}
	}
	return sampled;
};
