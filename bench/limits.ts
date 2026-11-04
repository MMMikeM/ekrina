// A grid of typing mistakes, built from how people mistype rather than from
// ekrina's tiers, so each library's limits show up as the cells where it
// stops finding the item. Diagnostic only: limits.test.ts reports it, and no
// published number reads it.
import {
	answeredByFew,
	foldedWords,
	holdsWordWhere,
	holdsWords,
	SAMPLE_SIZE,
	shuffledIndices,
} from "./corpus";
import type { Sample } from "./mrr.ts";

const SAMPLES_PER_CELL = 10;
// Clear of every seed corpus.ts samples with, so no cell reuses a published draw.
const SEED_OFFSET = 2_000;

type Random = () => number;

const seeded = (seed: number): Random => {
	let state = seed;
	return () => (state = (state * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
};

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

// A key the finger could land on instead: same row either side, or the row
// above or below.
const neighbours = (char: string): string[] => {
	const row = KEY_ROWS.findIndex((keys) => keys.includes(char));
	if (row === -1) return ["x"];
	const at = KEY_ROWS[row].indexOf(char);
	const near: string[] = [];
	for (const [r, offsets] of [
		[row, [-1, 1]],
		[row - 1, [0, 1]],
		[row + 1, [-1, 0]],
	] as const) {
		for (const offset of offsets) {
			const key = KEY_ROWS[r]?.[at + offset];
			if (key) near.push(key);
		}
	}
	return near;
};

const neighbourOf = (char: string, random: Random): string => {
	const near = neighbours(char);
	return near[Math.floor(random() * near.length)];
};

const randomLetterFor = (word: string, random: Random): string => {
	const absent = [..."abcdefghijklmnopqrstuvwxyz"].filter((letter) => !word.includes(letter));
	return absent[Math.floor(random() * absent.length)] ?? "x";
};

type Edit = (word: string, at: number, random: Random) => string | null;

const EDITS = {
	drop: (w, at) => w.slice(0, at) + w.slice(at + 1),
	"insert-near": (w, at, random) => w.slice(0, at + 1) + neighbourOf(w[at], random) + w.slice(at + 1),
	"substitute-near": (w, at, random) => w.slice(0, at) + neighbourOf(w[at], random) + w.slice(at + 1),
	"substitute-random": (w, at, random) => w.slice(0, at) + randomLetterFor(w, random) + w.slice(at + 1),
	swap: (w, at) => {
		const from = Math.min(at, w.length - 2);
		return w[from] === w[from + 1] ? null : w.slice(0, from) + w[from + 1] + w[from] + w.slice(from + 2);
	},
} satisfies Record<string, Edit>;

type EditName = keyof typeof EDITS;

const POSITIONS = {
	first: () => 0,
	middle: (w: string) => w.length >> 1,
	last: (w: string) => w.length - 1,
};

// Edits spread evenly along the word and applied from the right, so an earlier
// one never shifts where a later one lands, and none touch each other.
const applyEdits = (word: string, edits: EditName[], random: Random): string | null => {
	const spots = edits.map((_, k) => Math.floor(((k + 0.5) * word.length) / edits.length));
	if (spots.some((spot, k) => k > 0 && spot - spots[k - 1] < 3)) return null;
	let typed: string | null = word;
	for (let k = edits.length - 1; k >= 0 && typed !== null; k--) typed = EDITS[edits[k]](typed, spots[k], random);
	return typed;
};

type Derived = { query: string; relevant: (item: string) => boolean } | null;
type Cell = { axis: string; kind: string; derive: (words: string[], random: Random) => Derived };

const cells = (isTypo: (query: string) => boolean): Cell[] => {
	const typo = (query: string | null): string | null => (query !== null && isTypo(query) ? query : null);
	const wordOf = (words: string[], minLength: number): string | undefined =>
		words.find((word) => word.length >= minLength && /^[a-z]+$/.test(word));
	const twoWords = (ws: string[], minLength = 3): [string, string] | null =>
		ws.length >= 2 && ws[0].length >= minLength && ws[1].length >= minLength && /^[a-z]+$/.test(ws[0] + ws[1])
			? [ws[0], ws[1]]
			: null;

	const oneEdit: Cell[] = [];
	for (const edit of Object.keys(EDITS) as EditName[]) {
		for (const [position, at] of Object.entries(POSITIONS)) {
			oneEdit.push({
				axis: "one edit",
				kind: `${edit} @${position}`,
				derive: (ws, random) => {
					const w = wordOf(ws, 6);
					const t = w ? typo(EDITS[edit](w, at(w), random)) : null;
					return w && t ? { query: t, relevant: holdsWords(w) } : null;
				},
			});
		}
	}

	const manyEdits: Cell[] = (
		[
			["2 × substitute-near", ["substitute-near", "substitute-near"], 8],
			["2 × drop", ["drop", "drop"], 8],
			["2 × swap", ["swap", "swap"], 8],
			["substitute + swap", ["substitute-near", "swap"], 8],
			["drop + insert", ["drop", "insert-near"], 8],
			["3 mixed", ["substitute-near", "swap", "drop"], 10],
		] as const
	).map(([kind, edits, minLength]) => ({
		axis: "edits in one word",
		kind,
		derive: (ws, random) => {
			const w = wordOf(ws, minLength);
			const t = w ? typo(applyEdits(w, [...edits], random)) : null;
			return w && t ? { query: t, relevant: holdsWords(w) } : null;
		},
	}));

	const spaces: Cell[] = [
		{
			axis: "spaces",
			kind: "space inside a word, halves",
			derive: (ws) => {
				const w = wordOf(ws, 8);
				return w ? { query: `${w.slice(0, w.length >> 1)} ${w.slice(w.length >> 1)}`, relevant: holdsWords(w) } : null;
			},
		},
		{
			axis: "spaces",
			kind: "space inside a word, after 3",
			derive: (ws) => {
				const w = wordOf(ws, 7);
				return w ? { query: `${w.slice(0, 3)} ${w.slice(3)}`, relevant: holdsWords(w) } : null;
			},
		},
		{
			axis: "spaces",
			kind: "space inside a word + typo",
			derive: (ws, random) => {
				const w = wordOf(ws, 8);
				if (!w) return null;
				const h = w.length >> 1;
				const tail = EDITS["substitute-near"](w.slice(h), (w.length - h) >> 1, random);
				return tail ? { query: `${w.slice(0, h)} ${tail}`, relevant: holdsWords(w) } : null;
			},
		},
		{
			axis: "spaces",
			kind: "space dropped + typo",
			derive: (ws, random) => {
				const pair = twoWords(ws, 4);
				if (!pair) return null;
				const t = typo(pair[0] + EDITS["substitute-near"](pair[1], pair[1].length >> 1, random));
				return t ? { query: t, relevant: holdsWords(...pair) } : null;
			},
		},
	];

	const shapes: Cell[] = [
		{
			axis: "query shape",
			kind: "three words",
			derive: (ws) =>
				ws.length >= 3 && ws.slice(0, 3).every((w) => w.length >= 3)
					? { query: ws.slice(0, 3).join(" "), relevant: holdsWords(...ws.slice(0, 3)) }
					: null,
		},
		{
			axis: "query shape",
			kind: "three words, shuffled",
			derive: (ws) =>
				ws.length >= 3 && ws.slice(0, 3).every((w) => w.length >= 3)
					? { query: [ws[2], ws[0], ws[1]].join(" "), relevant: holdsWords(...ws.slice(0, 3)) }
					: null,
		},
		{
			axis: "query shape",
			kind: "two words, both mistyped",
			derive: (ws, random) => {
				const pair = twoWords(ws, 5);
				if (!pair) return null;
				const [a, b] = pair.map((w) => typo(EDITS["substitute-near"](w, w.length >> 1, random)));
				return a && b ? { query: `${a} ${b}`, relevant: holdsWords(...pair) } : null;
			},
		},
		{
			axis: "query shape",
			kind: "two words, one with 2 edits",
			derive: (ws, random) => {
				const pair = twoWords(ws, 3);
				if (!pair || pair[0].length < 8) return null;
				const t = typo(applyEdits(pair[0], ["substitute-near", "swap"], random));
				return t ? { query: `${t} ${pair[1]}`, relevant: holdsWords(...pair) } : null;
			},
		},
		{
			axis: "query shape",
			kind: "typo, then a word half typed",
			derive: (ws, random) => {
				const pair = twoWords(ws, 5);
				if (!pair) return null;
				const t = typo(EDITS["substitute-near"](pair[0], pair[0].length >> 1, random));
				const typed = pair[1].slice(0, 3);
				return t
					? { query: `${t} ${typed}`, relevant: holdsWordWhere((w) => w.startsWith(typed), pair[0]) }
					: null;
			},
		},
		{
			axis: "query shape",
			kind: "first letter wrong, in a phrase",
			derive: (ws, random) => {
				const pair = twoWords(ws, 5);
				const t = pair ? typo(EDITS["substitute-near"](pair[0], 0, random)) : null;
				return pair && t ? { query: `${t} ${pair[1]}`, relevant: holdsWords(...pair) } : null;
			},
		},
	];

	return [...oneEdit, ...manyEdits, ...spaces, ...shapes];
};

export type LimitSample = Sample & { axis: string };

/** The grid's queries over `items`, each answered by at most three of them. */
export const limitSamples = (items: string[]): LimitSample[] => {
	const vocabulary = new Set(items.flatMap(foldedWords));
	const isTypo = (query: string): boolean => !query.split(" ").every((word) => vocabulary.has(word));
	const sampled: LimitSample[] = [];
	for (const [seed, { axis, kind, derive }] of cells(isTypo).entries()) {
		const random = seeded(SEED_OFFSET + seed + 1);
		const seen = new Set<string>();
		for (const at of shuffledIndices(items.length, SEED_OFFSET + seed + 1)) {
			if (seen.size === SAMPLES_PER_CELL) break;
			const derived = derive(foldedWords(items[at]), random);
			if (!derived || seen.has(derived.query) || !answeredByFew(items, derived.relevant)) continue;
			seen.add(derived.query);
			sampled.push({ axis, kind, ...derived });
		}
	}
	return sampled;
};

// Optimal string alignment distance, stopping once a row passes `limit`.
const editDistanceWithin = (a: string, b: string, limit: number): number => {
	if (Math.abs(a.length - b.length) > limit) return limit + 1;
	let before = Array.from({ length: b.length + 1 }, () => 0);
	let last = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const row = [i];
		let rowMin = i;
		for (let j = 1; j <= b.length; j++) {
			let cost = Math.min(last[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), last[j] + 1, row[j - 1] + 1);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cost = Math.min(cost, before[j - 2] + 1);
			row.push(cost);
			rowMin = Math.min(rowMin, cost);
		}
		if (rowMin > limit) return limit + 1;
		[before, last] = [last, row];
	}
	return last[b.length];
};

const UNANSWERABLE_DISTANCE = 3;

export type Unanswerable = { kind: string; queries: string[] };

/**
 * Queries no item answers: corpus words with three edits that land at least
 * three edits from every word in the list, alone and in pairs. Anything a
 * library returns for them is a guess no reader asked for.
 */
export const unanswerable = (items: string[]): Unanswerable[] => {
	const vocabulary = [...new Set(items.flatMap(foldedWords))];
	const random = seeded(SEED_OFFSET + 999);
	const words: string[] = [];
	for (const at of shuffledIndices(items.length, SEED_OFFSET + 999)) {
		if (words.length === 2 * SAMPLES_PER_CELL * 3) break;
		const source = foldedWords(items[at]).find((word) => word.length >= 7 && /^[a-z]+$/.test(word));
		const typed = source ? applyEdits(source, ["substitute-random", "substitute-random", "swap"], random) : null;
		if (!typed || words.includes(typed)) continue;
		if (vocabulary.some((word) => editDistanceWithin(typed, word, UNANSWERABLE_DISTANCE - 1) < UNANSWERABLE_DISTANCE)) continue;
		words.push(typed);
	}
	const single = words.slice(0, SAMPLES_PER_CELL * 3);
	const rest = words.slice(SAMPLES_PER_CELL * 3);
	const pairs = Array.from({ length: rest.length >> 1 }, (_, k) => `${rest[2 * k]} ${rest[2 * k + 1]}`);
	return [
		{ kind: "absent word", queries: single },
		{ kind: "two absent words", queries: pairs },
	];
};

export { SAMPLE_SIZE };
