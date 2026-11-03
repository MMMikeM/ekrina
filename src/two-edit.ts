import type { PreparedQuery } from "./match";
import { SCORES, TYPO_PENALTY } from "./scores";
import type { TypoCorrection, TypoCorrector } from "./typos";
import type { MatchResult, Range, TypoStrategy } from "./types";

const MAX_EDITS = 2;
// Below this a second edit reaches too many other words: unanswerable 7-letter
// queries got an answer 20% of the time, against 15% at 8.
const MIN_TWO_EDIT_WORD_LENGTH = 8;
const MIN_PHRASE_CORRECTION_LENGTH = 5;
const MAX_WORD_LENGTH = 64;
// Longer text holds a near-namesake two edits from absent words: 173 absent
// probes junked once at 1,024 characters and never up to 512.
const MAX_FIELD_LENGTH = 512;

const wordRun = /[\p{L}\p{N}_]+/gu;

let rows = new Int32Array(0);

// Optimal string alignment distance: insertions, deletions, substitutions and
// adjacent swaps, each one edit. Capped at `limit + 1`.
const editDistance = (a: string, b: string, limit: number): number => {
	const width = b.length + 1;
	if (rows.length < 3 * width) rows = new Int32Array(3 * width);
	let beforeLast = 0;
	let last = width;
	let current = 2 * width;
	for (let j = 0; j < width; j++) rows[last + j] = j;
	for (let i = 1; i <= a.length; i++) {
		rows[current] = i;
		let rowMin = i;
		for (let j = 1; j < width; j++) {
			let cost = rows[last + j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
			cost = Math.min(cost, rows[last + j] + 1, rows[current + j - 1] + 1);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
				cost = Math.min(cost, rows[beforeLast + j - 2] + 1);
			}
			rows[current + j] = cost;
			rowMin = Math.min(rowMin, cost);
		}
		if (rowMin > limit) return limit + 1;
		[beforeLast, last, current] = [last, current, beforeLast];
	}
	return Math.min(rows[last + width - 1], limit + 1);
};

const withinEdits = (a: string, b: string, limit: number): number =>
	Math.abs(a.length - b.length) > limit ? limit + 1 : editDistance(a, b, limit);

const missingClassCount = (queryMask: number, fieldMask: number): number => {
	let missing = queryMask & ~fieldMask;
	let count = 0;
	for (; missing !== 0; count++) missing &= missing - 1;
	return count;
};

// Only a substitution or a deletion leaves a query letter unmatched, so a field
// holding a correction shares all but `MAX_EDITS` of the query's letters.
const sharesLetters = (normalisedField: string, letters: string, needed: number): boolean => {
	const remaining = [...letters];
	let shared = 0;
	for (const char of normalisedField) {
		const at = remaining.indexOf(char);
		if (at === -1) continue;
		remaining[at] = "";
		if (++shared >= needed) return true;
	}
	return false;
};

type FieldWord = { word: string; at: number };

const fieldWords = (normalisedField: string): FieldWord[] =>
	Array.from(normalisedField.matchAll(wordRun), (match) => ({ word: match[0], at: match.index }));

const spelling = (field: string, normalisedField: string, { word, at }: FieldWord): string =>
	field.length === normalisedField.length ? field.slice(at, at + word.length) : word;

const correction = (
	edits: number,
	field: string,
	normalisedField: string,
	first: FieldWord,
	last: FieldWord,
): MatchResult => {
	const span = { word: normalisedField.slice(first.at, last.at + last.word.length), at: first.at };
	const ranges: Range[] = [[first.at, first.at + first.word.length - 1]];
	if (last !== first) ranges.push([last.at, last.at + last.word.length - 1]);
	return {
		score: TYPO_PENALTY * edits + (first.at === 0 ? SCORES.PREFIX : SCORES.BOUNDARY),
		tier: "corrected",
		corrected: spelling(field, normalisedField, span),
		ranges,
	};
};

// A space typed or forgotten counts as one edit: `spaces` is how many the
// reading already spent, and two adjacent field words read joined spend one.
const correctWord = (
	word: string,
	field: string,
	normalisedField: string,
	spaces: number,
): MatchResult | null => {
	let best: MatchResult | null = null;
	const consider = (first: FieldWord, last: FieldWord, joinedEdits: number): void => {
		const budget = MAX_EDITS - spaces - joinedEdits;
		const target = first === last ? first.word : first.word + last.word;
		const edits = withinEdits(word, target, budget);
		if (edits > budget) return;
		const candidate = correction(edits + spaces + joinedEdits, field, normalisedField, first, last);
		if (best === null || candidate.score < best.score) best = candidate;
	};
	const words = fieldWords(normalisedField);
	for (let i = 0; i < words.length; i++) {
		consider(words[i], words[i], 0);
		if (spaces === 0 && i + 1 < words.length) consider(words[i], words[i + 1], 1);
	}
	return best;
};

type Placement = { candidate: FieldWord; edits: number; length: number };

const editsAllowed = (word: string, budget: number): number =>
	Math.min(budget, word.length >= MIN_TWO_EDIT_WORD_LENGTH ? 2 : 1);

// A word as typed claims a field word it starts before any correction is
// considered, so a correction never takes the word a literal one needs.
const placeWord = (
	word: string,
	words: FieldWord[],
	taken: boolean[],
	budget: number,
): Placement | null => {
	for (let i = 0; i < words.length; i++) {
		if (!taken[i] && words[i].word.startsWith(word)) {
			taken[i] = true;
			return { candidate: words[i], edits: 0, length: word.length };
		}
	}
	if (word.length < MIN_PHRASE_CORRECTION_LENGTH) return null;
	const allowed = editsAllowed(word, budget);
	let pick = -1;
	let pickEdits = allowed + 1;
	for (let i = 0; i < words.length; i++) {
		if (taken[i]) continue;
		const edits = withinEdits(word, words[i].word, allowed);
		if (edits < pickEdits) {
			pick = i;
			pickEdits = edits;
		}
	}
	if (pick === -1) return null;
	taken[pick] = true;
	return { candidate: words[pick], edits: pickEdits, length: words[pick].word.length };
};

const correctPhrase = (
	prepared: PreparedQuery,
	field: string,
	normalisedField: string,
): MatchResult | null => {
	const words = fieldWords(normalisedField);
	const taken = words.map(() => false);
	const placements = new Map<string, Placement[]>();
	let edits = 0;
	for (const word of prepared.wordsLongestFirst) {
		const placement = placeWord(word, words, taken, MAX_EDITS - edits);
		if (placement === null) return null;
		edits += placement.edits;
		placements.set(word, [...(placements.get(word) ?? []), placement]);
	}
	const { query, normalisedQuery, queryWords } = prepared;
	const typed = query.length === normalisedQuery.length ? query : normalisedQuery;
	let corrected = "";
	let from = 0;
	const ranges: Range[] = [];
	for (const word of queryWords) {
		const at = normalisedQuery.indexOf(word, from);
		const { candidate, edits: wordEdits, length } = (placements.get(word) as Placement[]).shift()!;
		const spelt = wordEdits
			? spelling(field, normalisedField, candidate)
			: typed.slice(at, at + word.length);
		corrected += typed.slice(from, at) + spelt;
		from = at + word.length;
		ranges.push([candidate.at, candidate.at + length - 1]);
	}
	return {
		score: TYPO_PENALTY * edits + SCORES.MULTI_WORD,
		tier: "corrected",
		corrected: corrected + typed.slice(from),
		ranges: ranges.sort((a, b) => a[0] - b[0]),
	};
};

// A two-word query is also read as one word with a stray space in it.
const correctSplitWord = (
	queryWords: string[],
	field: string,
	normalisedField: string,
): MatchResult | null => {
	const joined = queryWords.join("");
	return queryWords.length === 2 && joined.length >= MIN_TWO_EDIT_WORD_LENGTH
		? correctWord(joined, field, normalisedField, 1)
		: null;
};

const prepare = (prepared: PreparedQuery): TypoCorrection | null => {
	const { queryWords, queryMask } = prepared;
	if (queryWords.length === 0 || queryWords.some((word) => word.length > MAX_WORD_LENGTH)) {
		return null;
	}
	const phrase = queryWords.length > 1;
	const correctable = phrase
		? queryWords.some((word) => word.length >= MIN_PHRASE_CORRECTION_LENGTH)
		: queryWords[0].length >= MIN_TWO_EDIT_WORD_LENGTH;
	if (!correctable) return null;
	const letters = queryWords.join("");
	const admits = (fieldMask: number): boolean =>
		missingClassCount(queryMask, fieldMask) <= MAX_EDITS;
	return {
		admits,
		correct: (field, normalisedField, fieldMask) => {
			if (normalisedField.length > MAX_FIELD_LENGTH || !admits(fieldMask)) return null;
			if (!sharesLetters(normalisedField, letters, letters.length - MAX_EDITS)) return null;
			return phrase
				? (correctPhrase(prepared, field, normalisedField) ??
						correctSplitWord(queryWords, field, normalisedField))
				: correctWord(queryWords[0], field, normalisedField, 0);
		},
	};
};

const twoEditCorrector: TypoCorrector = { prepare };

/**
 * Corrects up to two mistakes, where the default rescue corrects one. A
 * mistake is a wrong, missing, extra or swapped character, or a space typed
 * inside a word or left out between two. A word takes two only from eight
 * letters, and a phrase word takes one only from five. Tried only when nothing
 * matches the query otherwise, and only on fields up to 512 characters.
 *
 * A two-edit match is tier `"corrected"` and scores `TYPO_PENALTY` per edit
 * plus the tier it lands on, so it sorts below every one-edit correction.
 */
export const twoEditTypos: TypoStrategy = twoEditCorrector as unknown as TypoStrategy;
