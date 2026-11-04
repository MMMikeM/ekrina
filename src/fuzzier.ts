import { WORD_CHARS, wordChar } from "./boundaries";
import { literalTiers, type PreparedQuery, prepareQuery } from "./match";
import { bigramBit, bigramClass } from "./normalise";
import { charMask } from "./gates";
import { SCORES, TYPO_PENALTY } from "./scores";
import type { PreparedStrategy, Strategy } from "./strategy";
import type { Fuzzier, MatchResult, Range } from "./types";

const MAX_EDITS = 2;
// Below this a second edit reaches too many other words: unanswerable 7-letter
// queries got an answer 20% of the time, against 15% at 8.
const MIN_TWO_EDIT_WORD_LENGTH = 8;
// A stray space alone is the least ambiguous mistake to undo, so a word this
// short is rejoined only when the space was the one mistake.
const MIN_REJOINED_LENGTH = 6;
const MIN_PHRASE_CORRECTION_LENGTH = 5;
const MIN_SCATTER_LENGTH = 4;
const MAX_WORD_LENGTH = 64;
// Longer text holds a near-namesake two edits from absent words: 173 absent
// probes junked once at 1,024 characters and never up to 512.
const MAX_FIELD_LENGTH = 512;

const wordRun = new RegExp(`[${WORD_CHARS}]+`, "gu");

let rows = new Int32Array(0);

// Optimal string alignment distance: insertions, deletions, substitutions and
// adjacent swaps, each one edit. Capped at `limit + 1`. Only cells within
// `limit` of the diagonal can stay under the cap, so the rest are never filled
// and read as over it.
const editDistance = (a: string, b: string, limit: number): number => {
	const width = b.length + 1;
	const over = limit + 1;
	if (rows.length < 3 * width) rows = new Int32Array(3 * width);
	rows.fill(over, 0, 3 * width);
	let beforeLast = 0;
	let last = width;
	let current = 2 * width;
	for (let j = 0; j <= Math.min(limit, b.length); j++) rows[last + j] = j;
	for (let i = 1; i <= a.length; i++) {
		const from = Math.max(1, i - limit);
		const to = Math.min(b.length, i + limit);
		rows[current + from - 1] = from === 1 ? (i <= limit ? i : over) : over;
		if (to + 1 < width) rows[current + to + 1] = over;
		let rowMin = over;
		if (from === 1 && i <= limit) rowMin = i;
		for (let j = from; j <= to; j++) {
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

// Each edit changes the length by at most one.
const lengthsWithin = (a: number, b: number, limit: number): boolean => Math.abs(a - b) <= limit;

const withinEdits = (a: string, b: string, limit: number): number =>
	lengthsWithin(a.length, b.length, limit) ? editDistance(a, b, limit) : limit + 1;

// How many of the query's letters each character class holds, so a field
// lacking a class leaves that many letters unmatched.
const classCounts = (letters: string): Int32Array => {
	const counts = new Int32Array(32);
	for (const char of letters) counts[31 - Math.clz32(charMask(char))]++;
	return counts;
};

const lacksAtMost = (counts: Int32Array, missingClasses: number, limit: number): boolean => {
	let unmatched = 0;
	for (let missing = missingClasses; missing !== 0; missing &= missing - 1) {
		unmatched += counts[31 - Math.clz32(missing & -missing)];
		if (unmatched > limit) return false;
	}
	return true;
};

// `asciiSlots` maps an ASCII code unit to its slot in `counts`, or -1; a
// non-ASCII letter needs no slot, since only non-ASCII text can match it.
type LetterGate = { asciiSlots: Int16Array; counts: Int32Array; needed: number };

// Only a substitution or a deletion leaves a query letter unmatched, so a field
// holding a correction shares all but `MAX_EDITS` of the query's letters.
const letterGate = (letters: string, needed: number): LetterGate => {
	const units: number[] = [];
	const counts: number[] = [];
	for (let i = 0; i < letters.length; i++) {
		const unit = letters.charCodeAt(i);
		const at = units.indexOf(unit);
		if (at === -1) {
			units.push(unit);
			counts.push(1);
		} else counts[at]++;
	}
	const asciiSlots = new Int16Array(128).fill(-1);
	for (let slot = 0; slot < units.length; slot++) {
		if (units[slot] < 128) asciiSlots[units[slot]] = slot;
	}
	return { asciiSlots, counts: Int32Array.from(counts), needed };
};

let remaining = new Int32Array(0);

const ASCII_UPPER_A = 65;
const ASCII_UPPER_Z = 90;
const ASCII_CASE_BIT = 32;

// Reads the caller's own text, where a non-ASCII character may fold to any
// letter and so counts as a match, keeping the gate false-pass only.
const holdsLetters = (gate: LetterGate, text: string): boolean => {
	if (remaining.length < gate.counts.length) remaining = new Int32Array(gate.counts.length);
	remaining.set(gate.counts);
	const { asciiSlots, needed } = gate;
	let shared = 0;
	for (let i = 0; i < text.length; i++) {
		if (text.length - i < needed - shared) return false;
		const unit = text.charCodeAt(i);
		if (unit > 127) {
			if (++shared >= needed) return true;
			continue;
		}
		const at = asciiSlots[unit | (unit >= ASCII_UPPER_A && unit <= ASCII_UPPER_Z ? ASCII_CASE_BIT : 0)];
		if (at === -1 || remaining[at] === 0) continue;
		remaining[at]--;
		if (++shared >= needed) return true;
	}
	return false;
};

// The letter gate's subsequence form, for a reading that needs every letter in
// order: a non-ASCII character matches whichever letter comes next.
const holdsInOrder = (word: string, text: string): boolean => {
	let next = 0;
	for (let i = 0; i < text.length; i++) {
		if (text.length - i < word.length - next) return false;
		let unit = text.charCodeAt(i);
		if (unit > 127) {
			if (++next === word.length) return true;
			continue;
		}
		if (unit >= ASCII_UPPER_A && unit <= ASCII_UPPER_Z) unit |= ASCII_CASE_BIT;
		if (unit === word.charCodeAt(next) && ++next === word.length) return true;
	}
	return false;
};

type FieldWord = { word: string; at: number };

const asciiWordUnits = Uint8Array.from({ length: 128 }, (_, unit) =>
	wordChar.test(String.fromCharCode(unit)) ? 1 : 0,
);

// The regex's own word split, with a plain scan for the all-ASCII fields that
// make up nearly every list.
const fieldWords = (normalisedField: string): FieldWord[] => {
	const words: FieldWord[] = [];
	let start = -1;
	for (let at = 0; at < normalisedField.length; at++) {
		const unit = normalisedField.charCodeAt(at);
		if (unit > 127) {
			return Array.from(normalisedField.matchAll(wordRun), (match) => ({
				word: match[0],
				at: match.index,
			}));
		}
		if (asciiWordUnits[unit] === 1) {
			if (start === -1) start = at;
		} else if (start !== -1) {
			words.push({ word: normalisedField.slice(start, at), at: start });
			start = -1;
		}
	}
	if (start !== -1) words.push({ word: normalisedField.slice(start), at: start });
	return words;
};

// Normalised text lines up with NFC(field) unit for unit, whatever its length.
const composed = (text: string, normalised: string): string =>
	text.length === normalised.length ? text : text.normalize("NFC");

const spelling = (field: string, normalisedField: string, { word, at }: FieldWord): string =>
	composed(field, normalisedField).slice(at, at + word.length);

const better = (a: MatchResult | null, b: MatchResult | null): MatchResult | null =>
	a === null || (b !== null && b.score < a.score) ? b : a;

// Priced as the built-in rescue prices one: the tier the corrected query lands
// on, as if typed in lower case, plus a penalty per edit.
const scoreCorrection = (
	edits: number,
	field: string,
	normalisedField: string,
	normalisedCorrected: string,
	corrected: string,
): MatchResult | null => {
	const asTyped = prepareQuery(normalisedCorrected, normalisedCorrected);
	const landed = literalTiers(field, normalisedField, asTyped, false);
	/* v8 ignore next -- spelt from the field's own words, the corrected query always appears in it */
	if (landed === null) return null;
	return {
		score: landed.score + TYPO_PENALTY * edits,
		tier: "corrected",
		corrected,
		ranges: landed.ranges,
	};
};

const correction = (
	edits: number,
	field: string,
	normalisedField: string,
	first: FieldWord,
	last: FieldWord,
): MatchResult | null => {
	const span = { word: normalisedField.slice(first.at, last.at + last.word.length), at: first.at };
	const corrected = spelling(field, normalisedField, span);
	return scoreCorrection(edits, field, normalisedField, span.word, corrected);
};

// A space typed or forgotten counts as one edit: `spaces` is how many the
// reading already spent, `spare` how many more it may, and two adjacent field
// words read joined spend one of those.
const correctWord = (
	word: string,
	field: string,
	normalisedField: string,
	words: FieldWord[],
	spaces: number,
	spare: number,
): MatchResult | null => {
	let best: MatchResult | null = null;
	const consider = (first: FieldWord, last: FieldWord, joinedEdits: number): void => {
		const budget = spare - joinedEdits;
		const length = first === last ? first.word.length : first.word.length + last.word.length;
		if (!lengthsWithin(word.length, length, budget)) return;
		const target = first === last ? first.word : first.word + last.word;
		const edits = editDistance(word, target, budget);
		if (edits > budget) return;
		const candidate = correction(edits + spaces + joinedEdits, field, normalisedField, first, last);
		best = better(best, candidate);
	};
	for (let i = 0; i < words.length; i++) {
		consider(words[i], words[i], 0);
		if (spaces === 0 && i + 1 < words.length) consider(words[i], words[i + 1], 1);
	}
	return best;
};

// Just above CONTAINS and ranked by the share of the word left untyped, so a
// sparse match inside one word outranks a fuzzy chain across several. Tuned on
// the scatter families and confirmed on fresh queries (@see docs/performance.md).
const SCATTER_SCORE = SCORES.CONTAINS + 0.05;
const SCATTER_SKIP_WEIGHT = 0.5;
const LATER_WORD_PENALTY = 0.05;

// A word's start typed whole with one letter after it is that word with one
// letter too many, which the ladder corrects at its own price.
const isStrayLastLetter = (runs: Range[], word: string): boolean =>
	runs.length === 2 && runs[0][1] === word.length - 2;

// The query's letters in order inside one field word that starts with the
// same letter, at least half of that word typed.
const scatterRuns = (word: string, candidate: string): Range[] | null => {
	if (candidate[0] !== word[0] || candidate.length <= word.length) return null;
	if (2 * word.length < candidate.length) return null;
	const runs: Range[] = [];
	let next = 0;
	for (let at = 0; at < candidate.length && next < word.length; at++) {
		if (candidate[at] !== word[next]) continue;
		const last = runs[runs.length - 1];
		if (last !== undefined && last[1] === at - 1) last[1] = at;
		else runs.push([at, at]);
		next++;
	}
	return next === word.length && !isStrayLastLetter(runs, word) ? runs : null;
};

const scatterWord = (
	word: string,
	field: string,
	normalisedField: string,
	words: FieldWord[],
): MatchResult | null => {
	let best: MatchResult | null = null;
	for (const candidate of words) {
		const runs = scatterRuns(word, candidate.word);
		if (runs === null) continue;
		const score =
			SCATTER_SCORE +
			SCATTER_SKIP_WEIGHT * (1 - word.length / candidate.word.length) +
			(candidate.at === 0 ? 0 : LATER_WORD_PENALTY);
		if (best !== null && best.score <= score) continue;
		for (const run of runs) {
			run[0] += candidate.at;
			run[1] += candidate.at;
		}
		best = {
			score,
			tier: "corrected",
			corrected: spelling(field, normalisedField, candidate),
			ranges: runs,
		};
	}
	return best;
};

type Placement = { candidate: FieldWord; edits: number };

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
			return { candidate: words[i], edits: 0 };
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
	return { candidate: words[pick], edits: pickEdits };
};

const correctPhrase = (
	prepared: PreparedQuery,
	field: string,
	normalisedField: string,
	words: FieldWord[],
): MatchResult | null => {
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
	const typed = composed(query, normalisedQuery);
	let corrected = "";
	let normalisedCorrected = "";
	let from = 0;
	for (const word of queryWords) {
		const at = normalisedQuery.indexOf(word, from);
		const { candidate, edits: wordEdits } = (placements.get(word) as Placement[]).shift()!;
		corrected +=
			typed.slice(from, at) +
			(wordEdits ? spelling(field, normalisedField, candidate) : typed.slice(at, at + word.length));
		normalisedCorrected += normalisedQuery.slice(from, at) + (wordEdits ? candidate.word : word);
		from = at + word.length;
	}
	return scoreCorrection(
		edits,
		field,
		normalisedField,
		normalisedCorrected + normalisedQuery.slice(from),
		corrected + typed.slice(from),
	);
};

const mayBeOneWord = (queryWords: string[]): boolean =>
	queryWords.length === 2 && queryWords[0].length + queryWords[1].length >= MIN_REJOINED_LENGTH;

// The edits a two-word query read as one word may spend beside the space.
const spareBesideSpace = (queryWords: string[]): number =>
	queryWords.join("").length >= MIN_TWO_EDIT_WORD_LENGTH ? MAX_EDITS - 1 : 0;

// A two-word query is also read as one word with a stray space in it.
const correctSplitWord = (
	queryWords: string[],
	spare: number,
	field: string,
	normalisedField: string,
	words: FieldWord[],
): MatchResult | null =>
	mayBeOneWord(queryWords)
		? correctWord(queryWords.join(""), field, normalisedField, words, 1, spare)
		: null;

// An adjacent swap breaks the three letter pairs around it; every other edit
// breaks fewer.
const PAIRS_ONE_EDIT_BREAKS = 3;

type Pairs = { lo: number; hi: number };

// Only pairs of ASCII letters and digits, where a field's bigram set and the
// normalised query are sure to agree.
const pairsOf = (words: string[]): Pairs => {
	const pairs = { lo: 0, hi: 0 };
	for (const word of words) {
		for (let at = 1; at < word.length; at++) {
			const before = word.charCodeAt(at - 1);
			const unit = word.charCodeAt(at);
			if (before > 127 || unit > 127) continue;
			const beforeClass = bigramClass(before);
			const unitClass = bigramClass(unit);
			if (beforeClass === 0 || unitClass === 0) continue;
			const bit = bigramBit(beforeClass, unitClass);
			if (bit < 32) pairs.lo |= 1 << bit;
			else pairs.hi |= 1 << (bit - 32);
		}
	}
	return pairs;
};

const lacksPairsAtMost = (needed: Pairs, lo: number, hi: number, limit: number): boolean => {
	let missing = 0;
	for (let rest = needed.lo & ~lo; rest !== 0; rest &= rest - 1) if (++missing > limit) return false;
	for (let rest = needed.hi & ~hi; rest !== 0; rest &= rest - 1) if (++missing > limit) return false;
	return true;
};

// A phrase word under five letters is never corrected, so its pairs all occur;
// the rest lose at most what the edits break. Read as one word, the joined
// query loses only what its `spare` edits beside the space break.
const phrasePairs = (
	queryWords: string[],
	asPhrase: boolean,
	spare: number,
): NonNullable<PreparedStrategy["admitsPairs"]> => {
	const short = pairsOf(queryWords.filter((word) => word.length < MIN_PHRASE_CORRECTION_LENGTH));
	const all = pairsOf(queryWords);
	const joined = mayBeOneWord(queryWords) ? pairsOf([queryWords.join("")]) : null;
	return (lo, hi) =>
		(asPhrase &&
			lacksPairsAtMost(short, lo, hi, 0) &&
			lacksPairsAtMost(all, lo, hi, MAX_EDITS * PAIRS_ONE_EDIT_BREAKS)) ||
		(joined !== null && lacksPairsAtMost(joined, lo, hi, spare * PAIRS_ONE_EDIT_BREAKS));
};

type Gates = Pick<PreparedStrategy, "admitsMask" | "admitsText">;

const scatterGates = (letters: string): Gates => {
	const lettersMask = charMask(letters);
	return {
		admitsMask: (fieldMask) => (lettersMask & ~fieldMask) === 0,
		admitsText: (text) => holdsInOrder(letters, text),
	};
};

// `unmatched` is how many of the query's letters the edits can leave without a
// counterpart in the field.
const editGates = (letters: string, unmatched: number): Gates => {
	const lettersMask = charMask(letters);
	const counts = classCounts(letters);
	const gate = letterGate(letters, letters.length - unmatched);
	return {
		admitsMask: (fieldMask) => lacksAtMost(counts, lettersMask & ~fieldMask, unmatched),
		admitsText: (text) => holdsLetters(gate, text),
	};
};

// Edit distance over every field word is what makes a reading expensive, so
// beside other matches only the sparse reading competes; edits stand in only
// for a query that matched nothing.
const prepareReading = (prepared: PreparedQuery, competing: boolean): PreparedStrategy | null => {
	const { queryWords } = prepared;
	if (queryWords.length === 0 || queryWords.some((word) => word.length > MAX_WORD_LENGTH)) {
		return null;
	}
	const phrase = queryWords.length > 1;
	// Beside other matches a phrase is read only as one word split by a stray
	// space, the one mistake cheap enough to look for there.
	if (phrase && competing && !mayBeOneWord(queryWords)) return null;
	const asPhrase = phrase && !competing;
	const spare = competing ? 0 : spareBesideSpace(queryWords);
	const letters = queryWords.join("");
	const editable = !competing && (phrase || letters.length >= MIN_TWO_EDIT_WORD_LENGTH);
	const matchWord = (
		word: string,
		field: string,
		normalisedField: string,
		words: FieldWord[],
	): MatchResult | null =>
		better(
			editable ? correctWord(word, field, normalisedField, words, 0, MAX_EDITS) : null,
			scatterWord(word, field, normalisedField, words),
		);
	const correctable = queryWords.some((word) => word.length >= MIN_PHRASE_CORRECTION_LENGTH);
	const matchable = phrase
		? correctable || mayBeOneWord(queryWords)
		: letters.length >= MIN_SCATTER_LENGTH;
	// With no word long enough to correct, only an edit beside a stray space can
	// leave a letter unmatched.
	const unmatched = phrase && !correctable ? spare : MAX_EDITS;
	if (!matchable) return null;
	return {
		...(editable ? editGates(letters, unmatched) : scatterGates(letters)),
		// A sparse reading keeps no pairs of a word together.
		admitsPairs: phrase ? phrasePairs(queryWords, asPhrase, spare) : null,
		match: (field, normalisedField) => {
			if (normalisedField.length > MAX_FIELD_LENGTH) return null;
			const words = fieldWords(normalisedField);
			if (!phrase) return matchWord(queryWords[0], field, normalisedField, words);
			return (
				(asPhrase ? correctPhrase(prepared, field, normalisedField, words) : null) ??
				correctSplitWord(queryWords, spare, field, normalisedField, words)
			);
		},
	};
};

// Indexed by `competing`; undefined until that reading is first prepared.
type Readings = { query: string; byCompeting: (PreparedStrategy | null | undefined)[] };

// fuzzyMatch prepares its query per call, and a list matched one call per row
// would otherwise rebuild the same gates for every row, competing or not.
let lastReadings: Readings | null = null;

const prepare = (prepared: PreparedQuery, competing: boolean): PreparedStrategy | null => {
	if (lastReadings?.query !== prepared.query) {
		lastReadings = { query: prepared.query, byCompeting: [undefined, undefined] };
	}
	const slot = competing ? 1 : 0;
	return (lastReadings.byCompeting[slot] ??= prepareReading(prepared, competing));
};

const fuzzierStrategy: Strategy = { prepare };

/**
 * Matches what the default ladder refuses, on fields up to 512 characters. A
 * sparse word, or a word split by a stray space alone, competes while fewer
 * than ten items match the query as typed; other mistakes are corrected only
 * when nothing matches it otherwise.
 *
 * - up to two mistakes, where the default rescue corrects one: a wrong,
 *   missing, extra or swapped character, or a space typed inside a word or
 *   left out between two. A word takes two from eight letters, a phrase word
 *   one from five;
 * - a word typed sparsely: at least four of its letters, in order, starting
 *   with its first and covering at least half of it (`hget` for "Huguette"),
 *   but not its start alone with one stray letter after (`salmas`).
 *
 * Every such match is tier `"corrected"` and scores above `SCORES.CONTAINS`,
 * so it never outranks the query as typed. A mistake costs `TYPO_PENALTY`
 * each, on top of the tier the corrected query lands on; a sparse match scores
 * just above `CONTAINS`, lower the more of the word was typed. It replaces a
 * weaker fuzzy or corrected match on the same field.
 */
export const fuzzier: Fuzzier = fuzzierStrategy as unknown as Fuzzier;
