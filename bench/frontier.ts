// Every axis a query can drift along, each with an intensity dial, so a
// search can turn each one up until no library still finds the item: where a
// library stops is its limit on that axis. Diagnostic only (frontier.test.ts).
import { answeredByFew, foldedWords, holdsWordWhere, holdsWords, shuffledIndices } from "./words.ts";
import { EDITS, type EditName, neighbourOf, type Random, randomLetterFor, seeded } from "./limits.ts";
import type { Sample } from "./mrr.ts";

type Derived = { query: string; relevant: (item: string) => boolean } | null;

export type Axis = {
	name: string;
	group: string;
	/** Intensities to try, mildest first. */
	steps: number[];
	derive: (words: string[], step: number, random: Random, isTypo: (query: string) => boolean) => Derived;
	/** Why the corpus stops supplying queries when it does, for an axis whose material runs out before the dial. */
	runsOut?: string;
};

const plain = (word: string | undefined): word is string => word !== undefined && /^[a-z]+$/.test(word);

// The item's longest plain word at least `min` letters long.
const longestWord = (words: string[], min: number): string | undefined =>
	words.filter((word) => plain(word) && word.length >= min).sort((a, b) => b.length - a.length)[0];

// `count` spots spread evenly along the word, `gap` apart at least.
const spreadSpots = (length: number, count: number, gap: number): number[] | null => {
	const spots = Array.from({ length: count }, (_, k) => Math.floor(((k + 0.5) * length) / count));
	return spots.every((spot, k) => k === 0 || spot - spots[k - 1] >= gap) ? spots : null;
};

const editSpread = (word: string, edits: EditName[], random: Random, gap: number): string | null => {
	const spots = spreadSpots(word.length, edits.length, gap);
	if (spots === null) return null;
	let typed: string | null = word;
	for (let k = edits.length - 1; k >= 0 && typed !== null; k--) typed = EDITS[edits[k]](typed, spots[k], random);
	return typed;
};

export const ACCENTED: Record<string, string> = { a: "á", e: "é", i: "í", o: "ó", u: "ú", c: "ç", n: "ñ", s: "š", z: "ž" };
const VOWELS = new Set("aeiou");
const steps = (to: number, from = 1): number[] => Array.from({ length: to - from + 1 }, (_, k) => from + k);

const oneWord = (
	name: string,
	group: string,
	stepsToTry: number[],
	corrupt: (word: string, step: number, random: Random) => string | null,
	minLength: (step: number) => number,
	typoOnly = true,
	runsOut?: string,
): Axis => ({
	name,
	group,
	steps: stepsToTry,
	runsOut,
	derive: (words, step, random, isTypo) => {
		const word = longestWord(words, minLength(step));
		const query = word ? corrupt(word, step, random) : null;
		if (!word || !query || query === word || (typoOnly && !isTypo(query))) return null;
		return { query, relevant: holdsWords(word) };
	},
});

const spreadEdits = (name: string, kinds: EditName[], gap: number): Axis =>
	oneWord(
		name,
		"edits in one word",
		steps(20),
		(word, step, random) => editSpread(word, Array.from({ length: step }, (_, k) => kinds[k % kinds.length]), random, gap),
		(step) => Math.max(5, gap * step),
		true,
		"no word is long enough",
	);

const phrase = (
	name: string,
	stepsToTry: number[],
	wordsNeeded: (step: number) => number,
	build: (words: string[], step: number, random: Random) => { query: string; relevant: (item: string) => boolean } | null,
	runsOut = "no item has that many words",
): Axis => ({
	name,
	group: "query shape",
	steps: stepsToTry,
	runsOut,
	derive: (words, step, random) => {
		const usable = words.filter((word) => plain(word) && word.length >= 3);
		return usable.length >= wordsNeeded(step) ? build(usable, step, random) : null;
	},
});

const typoed = (word: string, random: Random): string => EDITS["substitute-near"](word, word.length >> 1, random) ?? word;

// A share, in tenths, of the most edits that fit `gap` apart, so the dial
// reaches the end of any word however long the corpus's words run.
const countFor = (tenths: number, room: number, gap: number): number =>
	Math.max(1, Math.round((tenths / 10) * Math.floor(room / gap)));

const shareEdits = (name: string, kinds: EditName[], gap = 1): Axis =>
	oneWord(
		name,
		"share of a word",
		steps(10),
		(word, tenths, random) => {
			const count = countFor(tenths, word.length, gap);
			return editSpread(word, Array.from({ length: count }, (_, k) => kinds[k % kinds.length]), random, gap);
		},
		() => 6,
	);

// Past ten tenths every letter gets more than one neighbouring key after it.
const insertedShare = (word: string, tenths: number, random: Random): string => {
	const count = Math.max(1, Math.round((tenths / 10) * word.length));
	return [...word]
		.map((char, k) => {
			const inserts = Math.floor(((k + 1) * count) / word.length) - Math.floor((k * count) / word.length);
			return char + Array.from({ length: inserts }, () => neighbourOf(char, random)).join("");
		})
		.join("");
};

const spacedOut = (word: string, spots: number[], marks: (k: number) => string): string => {
	let typed = word;
	for (const [k, spot] of [...spots].reverse().entries()) typed = typed.slice(0, spot + 1) + marks(k) + typed.slice(spot + 1);
	return typed;
};

const shareOfSpots = (name: string, marks: (k: number) => string): Axis =>
	oneWord(
		name,
		"share of a word",
		steps(10),
		(word, tenths) => {
			const spots = spreadSpots(word.length - 1, countFor(tenths, word.length - 1, 2), 2);
			return spots && spacedOut(word, spots, marks);
		},
		() => 6,
		false,
	);

const vowelsOf = (word: string): number[] => [...word].flatMap((char, k) => (k > 0 && VOWELS.has(char) ? [k] : []));
const accentableOf = (word: string): number[] => [...word].flatMap((char, k) => (ACCENTED[char] ? [k] : []));

export const AXES: Axis[] = [
	shareEdits("neighbouring keys, tenths of the letters", ["substitute-near"]),
	{ ...shareEdits("letters dropped, tenths of the letters", ["drop"]), steps: steps(9) },
	oneWord("neighbouring keys inserted, tenths of the letters", "share of a word", steps(30), insertedShare, () => 6),
	spreadEdits("neighbouring-key substitutions", ["substitute-near"], 2),
	spreadEdits("random substitutions", ["substitute-random"], 2),
	spreadEdits("dropped letters", ["drop"], 2),
	spreadEdits("inserted neighbouring keys", ["insert-near"], 2),
	spreadEdits("swapped neighbours", ["swap"], 3),
	spreadEdits("mixed edits", ["substitute-near", "swap", "drop", "insert-near"], 3),
	oneWord(
		"first letters wrong",
		"edit position",
		steps(20),
		(word, step, random) => [...word].map((char, k) => (k < step ? neighbourOf(char, random) : char)).join(""),
		(step) => step + 4,
	),
	oneWord(
		"last letters wrong",
		"edit position",
		steps(20),
		(word, step, random) => [...word].map((char, k) => (k >= word.length - step ? neighbourOf(char, random) : char)).join(""),
		(step) => step + 4,
	),
	oneWord("stuck key", "edits in one word", steps(30), (word, step) => {
		const at = word.length >> 1;
		return word.slice(0, at + 1) + word[at].repeat(step) + word.slice(at + 1);
	}, () => 5),
	oneWord("letters cut from the end", "partial words", steps(20), (word, step) => (word.length - step >= 2 ? word.slice(0, -step) : null), (step) => step + 2, false),
	oneWord("letters cut from the front", "partial words", steps(20), (word, step) => (word.length - step >= 3 ? word.slice(step) : null), (step) => step + 3, false),
	oneWord("vowels dropped", "partial words", steps(12), (word, step) => {
		const vowelsAt = vowelsOf(word);
		if (vowelsAt.length < step) return null;
		const dropped = new Set(spreadSpots(vowelsAt.length, step, 1)?.map((k) => vowelsAt[k]) ?? []);
		return [...word].filter((_, k) => !dropped.has(k)).join("");
	}, () => 5, true, "no word has that many vowels"),
	oneWord("spaces inside a word", "noise", steps(10), (word, step) => {
		const spots = spreadSpots(word.length - 1, step, 2);
		return spots && spacedOut(word, spots, () => " ");
	}, (step) => 2 * step + 3, false, "no word is long enough"),
	oneWord("punctuation inside a word", "noise", steps(10), (word, step) => {
		const spots = spreadSpots(word.length - 1, step, 2);
		return spots && spacedOut(word, spots, (k) => (k % 2 ? "'" : "-"));
	}, (step) => 2 * step + 3, false, "no word is long enough"),
	oneWord("accents added", "noise", steps(12), (word, step) => {
		const at = accentableOf(word);
		if (at.length < step) return null;
		const chosen = new Set(at.slice(0, step));
		return [...word].map((char, k) => (chosen.has(k) ? ACCENTED[char] : char)).join("");
	}, () => 4, false, "no word has that many accentable letters"),
	oneWord("random letters in a word", "edits in one word", steps(30), (word, step, random) => {
		let typed = word;
		for (let k = 0; k < step; k++) {
			const at = 1 + Math.floor(random() * (typed.length - 1));
			typed = typed.slice(0, at) + randomLetterFor(typed, random) + typed.slice(at);
		}
		return typed;
	}, () => 6),
	phrase("words in order", steps(12), (step) => step, (ws, step) => ({ query: ws.slice(0, step).join(" "), relevant: holdsWords(...ws.slice(0, step)) })),
	phrase("words reversed", steps(12, 2), (step) => step, (ws, step) => ({ query: ws.slice(0, step).reverse().join(" "), relevant: holdsWords(...ws.slice(0, step)) })),
	phrase("words joined", steps(12, 2), (step) => step, (ws, step) => ({ query: ws.slice(0, step).join(""), relevant: holdsWords(...ws.slice(0, step)) })),
	phrase("words each with a typo", steps(12), (step) => Math.max(2, step), (ws, step, random) => {
		const picked = ws.slice(0, Math.max(2, step));
		if (picked.slice(0, step).some((word) => word.length < 5)) return null;
		return { query: picked.map((word, k) => (k < step ? typoed(word, random) : word)).join(" "), relevant: holdsWords(...picked) };
	}),
	phrase("words half typed", steps(12), (step) => Math.max(2, step), (ws, step) => {
		const picked = ws.slice(0, Math.max(2, step));
		if (picked.some((word) => word.length < 5)) return null;
		const typed = picked.map((word, k) => (k < step ? word.slice(0, 3) : word));
		return {
			query: typed.join(" "),
			relevant: (item) => {
				const itemWords = foldedWords(item);
				return typed.every((prefix) => itemWords.some((word) => word.startsWith(prefix)));
			},
		};
	}),
	phrase("absent words added", steps(40), () => 2, (ws, step, random) => {
		const extra = Array.from({ length: step }, () => Array.from({ length: 6 }, () => randomLetterFor("", random)).join(""));
		return { query: [ws[0], ws[1], ...extra].join(" "), relevant: holdsWords(ws[0], ws[1]) };
	}),
	phrase("phrase typed as one word, with a typo", steps(12), () => 2, (ws, step, random) => {
		const joined = ws.slice(0, 2).join("");
		const typed = editSpread(joined, Array.from({ length: step }, () => "substitute-near" as const), random, 3);
		return typed ? { query: typed, relevant: holdsWords(ws[0], ws[1]) } : null;
	}, "no two words are long enough"),
	phrase("typo then a half-typed word", steps(12), () => 2, (ws, step, random) => {
		if (ws[0].length < 5 || ws[1].length < 4) return null;
		const head = editSpread(ws[0], Array.from({ length: step }, () => "substitute-near" as const), random, 2);
		const typed = ws[1].slice(0, 3);
		return head ? { query: `${head} ${typed}`, relevant: holdsWordWhere((word) => word.startsWith(typed), ws[0]) } : null;
	}, "no word is long enough"),
	// The count axes above stop where the corpus's words do; these share-based
	// twins reach the end of every word instead.
	shareEdits("swapped neighbours, tenths of the most that fit", ["swap"], 3),
	shareEdits("mixed edits, tenths of the most that fit", ["substitute-near", "swap", "drop", "insert-near"], 3),
	shareOfSpots("spaces inside, tenths of the most that fit", () => " "),
	shareOfSpots("punctuation inside, tenths of the most that fit", (k) => (k % 2 ? "'" : "-")),
	oneWord("vowels dropped, tenths of the vowels", "share of a word", steps(10), (word, tenths) => {
		const vowelsAt = vowelsOf(word);
		if (vowelsAt.length < 2) return null;
		const dropped = new Set(spreadSpots(vowelsAt.length, countFor(tenths, vowelsAt.length, 1), 1)?.map((k) => vowelsAt[k]) ?? []);
		return [...word].filter((_, k) => !dropped.has(k)).join("");
	}, () => 5),
	oneWord("accents added, tenths of the accentable letters", "share of a word", steps(10), (word, tenths) => {
		const at = accentableOf(word);
		if (at.length < 2) return null;
		const chosen = new Set(spreadSpots(at.length, countFor(tenths, at.length, 1), 1)?.map((k) => at[k]) ?? []);
		return [...word].map((char, k) => (chosen.has(k) ? ACCENTED[char] : char)).join("");
	}, () => 4, false),
	phrase("phrase typed as one word, tenths of the most typos that fit", steps(10), () => 2, (ws, tenths, random) => {
		const joined = ws.slice(0, 2).join("");
		const typed = editSpread(joined, Array.from({ length: countFor(tenths, joined.length, 3) }, () => "substitute-near" as const), random, 3);
		return typed ? { query: typed, relevant: holdsWords(ws[0], ws[1]) } : null;
	}),
	phrase("typo then a half-typed word, tenths of the most typos that fit", steps(10), () => 2, (ws, tenths, random) => {
		if (ws[0].length < 5 || ws[1].length < 4) return null;
		const head = editSpread(ws[0], Array.from({ length: countFor(tenths, ws[0].length, 2) }, () => "substitute-near" as const), random, 2);
		const typed = ws[1].slice(0, 3);
		return head ? { query: `${head} ${typed}`, relevant: holdsWordWhere((word) => word.startsWith(typed), ws[0]) } : null;
	}),
];

const SAMPLES_PER_STEP = 20;
const SEED_OFFSET = 3_000;

/** Up to 20 queries for one axis at one intensity, each answered by at most three items. */
export const frontierSamples = (items: string[], axisAt: number, step: number): Sample[] => {
	const { derive, name } = AXES[axisAt];
	const vocabulary = new Set(items.flatMap(foldedWords));
	const isTypo = (query: string): boolean => !query.split(" ").every((word) => vocabulary.has(word));
	const seed = SEED_OFFSET + 100 * axisAt + step;
	const random = seeded(seed);
	const seen = new Set<string>();
	const samples: Sample[] = [];
	for (const at of shuffledIndices(items.length, seed)) {
		if (seen.size === SAMPLES_PER_STEP) break;
		const derived = derive(foldedWords(items[at]), step, random, isTypo);
		if (!derived || seen.has(derived.query) || !answeredByFew(items, derived.relevant)) continue;
		seen.add(derived.query);
		samples.push({ kind: `${name} ×${step}`, ...derived });
	}
	return samples;
};
