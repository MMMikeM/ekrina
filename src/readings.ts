import { asciiWordUnits, WORD_CHARS } from "./boundaries";
import { literalTiers, type PreparedQuery, prepareQuery, shiftRanges } from "./match";
import { charMask, holdsInOrderFrom } from "./gates";
import { bigramBit, bigramClass, type FieldBigrams } from "./normalise";
import {
	MAX_RESCUE_WORD_LENGTH,
	MIN_TYPO_QUERY_LENGTH,
	rawWordOf,
	swapAdjacentAt,
	wordStartsOf,
} from "./rescue";
import { better, CONTAINS_SCORE, correctedMatch } from "./scores";
import type { MatchResult, HighlightRange } from "./types";

// What one query admits under a reading, prepared once and tried against
// fields that matched nothing else.
export type PreparedReading = {
	// A gate, so it may only false-pass: a field whose missing `needed` bits hold
	// more than `spare` of the query's letters has no match (see readingAdmits).
	// A surrogate pair sets two bits, so missing bits do not count letters.
	needed: number;
	counts: Int32Array;
	spare: number;
	// Absent when it could reject nothing; reads an item's bigram set (see
	// rawFieldPairs).
	admitsPairs: ((bigramsLo: number, bigramsHi: number) => boolean) | null;
	match: (field: string, normalisedField: string) => MatchResult | null;
	// The reading may match fields the literal pass rejected, so every item is
	// tried rather than its survivors. One that is not `wholeList` must match
	// only fields the literal pass lets through (`buildFuzzyGate` for one word,
	// every word character present for a phrase): the searcher tries just those.
	wholeList: boolean;
};

// What the query already matched: nothing, only fuzzy chains, or literally.
// Beside other matches only readings cheap enough to run beside them are
// prepared.
export type Competition = "none" | "fuzzy" | "literal";

const MAX_EDITS = 2;
// Below this a second edit reaches too many other words: unanswerable 7-letter
// queries got an answer 20% of the time, against 15% at 8.
const MIN_TWO_EDIT_WORD_LENGTH = 8;
// A stray space alone is the least ambiguous mistake to undo, so a word this
// short is rejoined only when the space was the one mistake.
const MIN_REJOINED_LENGTH = 6;
const MIN_PHRASE_CORRECTION_LENGTH = 5;
// Under the default rescue's floor only a swap is safe to undo: it keeps every
// letter, where a drop or a substitution leaves three that most fields hold.
const SWAP_ONLY_LENGTH = 4;
const MIN_SCATTER_LENGTH = 4;
// Longer text holds a near-namesake two edits from absent words: 173 absent
// probes junked once at 1,024 characters and never up to 512.
const MAX_FIELD_LENGTH = 512;

const wordRun = new RegExp(`[${WORD_CHARS}]+`, "gu");

// Optimal string alignment distance: insertions, deletions, substitutions and
// adjacent swaps, each one edit. Capped at `limit + 1`. A shared first
// character is always matched: no cheaper alignment edits it.
const editDistance = (a: string, b: string, limit: number, i = 0, j = 0): number => {
	while (i < a.length && j < b.length && a[i] === b[j]) {
		i++;
		j++;
	}
	if (i === a.length || j === b.length) {
		return Math.min(Math.max(a.length - i, b.length - j), limit + 1);
	}
	if (limit === 0) return 1;
	let fewest = Math.min(
		editDistance(a, b, limit - 1, i + 1, j + 1),
		editDistance(a, b, limit - 1, i + 1, j),
		editDistance(a, b, limit - 1, i, j + 1),
	);
	if (a[i] === b[j + 1] && a[i + 1] === b[j]) {
		fewest = Math.min(fewest, editDistance(a, b, limit - 1, i + 2, j + 2));
	}
	return fewest + 1;
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

export const readingAdmits = (
	{ needed, counts, spare }: PreparedReading,
	fieldMask: number,
): boolean => {
	let unmatched = 0;
	for (let missing = needed & ~fieldMask; missing !== 0; missing &= missing - 1) {
		unmatched += counts[31 - Math.clz32(missing & -missing)];
		if (unmatched > spare) return false;
	}
	return true;
};

type FieldWord = { word: string; offset: number };

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
				offset: match.index,
			}));
		}
		if (asciiWordUnits[unit] === 1) {
			if (start === -1) start = at;
		} else if (start !== -1) {
			words.push({ word: normalisedField.slice(start, at), offset: start });
			start = -1;
		}
	}
	if (start !== -1) words.push({ word: normalisedField.slice(start), offset: start });
	return words;
};

// Normalised text lines up with NFC(field) unit for unit, whatever its length.
const composed = (text: string, normalised: string): string =>
	text.length === normalised.length ? text : text.normalize("NFC");

const spelling = (field: string, normalisedField: string, { word, offset }: FieldWord): string =>
	composed(field, normalisedField).slice(offset, offset + word.length);

// Priced as the built-in rescue prices one: the tier the corrected query lands
// on, as if typed in lower case, plus a penalty per edit.
const scoreCorrection = (
	edits: number,
	field: string,
	normalisedField: string,
	normalisedCorrected: string,
	corrected: string,
	typed: string = normalisedCorrected,
): MatchResult | null => {
	const asTyped = prepareQuery(typed, normalisedCorrected);
	const landed = literalTiers(field, normalisedField, asTyped, false);
	/* v8 ignore next -- spelt from the field's own words, the corrected query always appears in it */
	if (landed === null) return null;
	return correctedMatch(landed, edits, corrected);
};

const correction = (
	edits: number,
	field: string,
	normalisedField: string,
	first: FieldWord,
	last: FieldWord,
): MatchResult | null => {
	const span = {
		word: normalisedField.slice(first.offset, last.offset + last.word.length),
		offset: first.offset,
	};
	const corrected = spelling(field, normalisedField, span);
	return scoreCorrection(edits, field, normalisedField, span.word, corrected);
};

// A space typed or forgotten, or a key held down, counts as one edit: `spent` is
// how many the reading already spent, `spare` how many more it may, and two
// adjacent field words read joined spend one of those.
const correctWord = (
	word: string,
	field: string,
	normalisedField: string,
	words: FieldWord[],
	spent: number,
	spare: number,
): MatchResult | null => {
	let best: MatchResult | null = null;
	const consider = (first: FieldWord, last: FieldWord, joinedEdits: number): void => {
		const budget = spare - joinedEdits;
		const edits = withinEdits(word, first === last ? first.word : first.word + last.word, budget);
		if (edits > budget) return;
		const candidate = correction(edits + spent + joinedEdits, field, normalisedField, first, last);
		best = better(best, candidate);
	};
	for (let i = 0; i < words.length; i++) {
		consider(words[i], words[i], 0);
		if (spent === 0 && i + 1 < words.length) consider(words[i], words[i + 1], 1);
	}
	return best;
};

// Just above CONTAINS and ranked by the share of the word left untyped, and by
// each letter skipped past the first, so a word read with several letters
// skipped falls below a correction that finishes a word, where one dropped
// letter does not (@see docs/performance.md).
const SCATTER_SCORE = CONTAINS_SCORE + 0.05;
const SCATTER_SKIP_WEIGHT = 1.5;
const SCATTER_EXTRA_SKIP_PENALTY = 0.15;
const LATER_WORD_PENALTY = 0.05;

// A word's start typed whole with one letter after it is that word with one
// letter too many, which the ladder corrects at its own price.
const isStrayLastLetter = (runs: HighlightRange[], word: string): boolean =>
	runs.length === 2 && runs[0][1] === word.length - 2;

// The query's letters in order inside one field word that starts with the
// same letter, at least half of that word typed.
const scatterRuns = (word: string, candidate: string): HighlightRange[] | null => {
	if (candidate[0] !== word[0] || candidate.length <= word.length) return null;
	if (2 * word.length < candidate.length) return null;
	const runs: HighlightRange[] = [];
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
			SCATTER_EXTRA_SKIP_PENALTY * Math.max(0, candidate.word.length - word.length - 1) +
			(candidate.offset === 0 ? 0 : LATER_WORD_PENALTY);
		if (best !== null && best.score <= score) continue;
		shiftRanges(runs, candidate.offset);
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
	const starts = wordStartsOf(prepared);
	let corrected = "";
	let normalisedCorrected = "";
	let from = 0;
	for (let k = 0; k < queryWords.length; k++) {
		const word = queryWords[k];
		const at = starts[k];
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

// Only pairs of ASCII letters and digits, where a field's bigram set and the
// normalised query are sure to agree.
const pairsOf = (words: string[]): FieldBigrams => {
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

const lacksPairsAtMost = (needed: FieldBigrams, lo: number, hi: number, limit: number): boolean => {
	let missing = 0;
	for (let rest = needed.lo & ~lo; rest !== 0; rest &= rest - 1)
		if (++missing > limit) return false;
	for (let rest = needed.hi & ~hi; rest !== 0; rest &= rest - 1)
		if (++missing > limit) return false;
	return true;
};

// A phrase word under five letters is never corrected, so its pairs all occur;
// the rest lose at most what the edits break. Read as one word, the joined
// query loses only what its `spare` edits beside the space break.
const phrasePairs = (
	queryWords: string[],
	asPhrase: boolean,
	spare: number,
): NonNullable<PreparedReading["admitsPairs"]> => {
	const short = pairsOf(queryWords.filter((word) => word.length < MIN_PHRASE_CORRECTION_LENGTH));
	const all = pairsOf(queryWords);
	const joined = mayBeOneWord(queryWords) ? pairsOf([queryWords.join("")]) : null;
	return (lo, hi) =>
		(asPhrase &&
			lacksPairsAtMost(short, lo, hi, 0) &&
			lacksPairsAtMost(all, lo, hi, MAX_EDITS * PAIRS_ONE_EDIT_BREAKS)) ||
		(joined !== null && lacksPairsAtMost(joined, lo, hi, spare * PAIRS_ONE_EDIT_BREAKS));
};

// A run of three or more of one letter, cut to two: a held key, whose one
// mistake leaves the word itself or one edit from it (`twaaain`, `cleeean`,
// `coffffee`). A word with two runs is left to the other readings.
const STUCK_RUN = /(.)\1{2,}/gu;
const stuckKeyForm = (word: string): string | null => {
	const runs = word.match(STUCK_RUN);
	if (runs?.length !== 1) return null;
	const form = word.replace(STUCK_RUN, "$1$1");
	// A held key spends one of the two edits, so a word shorter than the default
	// rescue's floor would take two edits where the default gives it none.
	return form.length >= MIN_TYPO_QUERY_LENGTH ? form : null;
};

type Swap = { normalised: string; typed: string };

// Every adjacent swap of a short word. Swaps at different places change
// different letters, so only a swap of two equal ones repeats a form: the word.
const swapForms = (word: string, typedWord: string): Swap[] => {
	const forms: Swap[] = [];
	for (let k = 0; k + 1 < word.length; k++) {
		if (word[k] !== word[k + 1]) {
			forms.push({ normalised: swapAdjacentAt(word, k), typed: swapAdjacentAt(typedWord, k) });
		}
	}
	return forms;
};

// A swap undone only where the form starts a field word, so it lands at a word
// start as the default's short corrections do. Like the default's, it keeps the
// caller's casing, so both price a swap the same.
const swapWord = (
	swaps: Swap[],
	field: string,
	normalisedField: string,
	words: FieldWord[],
): MatchResult | null => {
	let best: MatchResult | null = null;
	for (const { normalised, typed } of swaps) {
		if (!words.some((candidate) => candidate.word.startsWith(normalised))) continue;
		best = better(best, scoreCorrection(1, field, normalisedField, normalised, typed, typed));
	}
	return best;
};

// Edit distance over every field word is what makes a reading expensive, so
// beside other matches only the sparse reading competes; edits stand in only
// for a query that matched nothing.
const prepareReading = (prepared: PreparedQuery, competing: boolean): PreparedReading | null => {
	const { queryWords } = prepared;
	if (queryWords.length === 0 || queryWords.some((word) => word.length > MAX_RESCUE_WORD_LENGTH)) {
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
	// Gated on the form it corrects, since a long run would fail a gate built
	// from the letters as typed.
	const stuck = phrase || competing ? null : stuckKeyForm(letters);
	const swaps =
		competing || !readsSwaps(prepared) ? null : swapForms(letters, rawWordOf(prepared, 0));
	const matchWord = (
		word: string,
		field: string,
		normalisedField: string,
		words: FieldWord[],
	): MatchResult | null =>
		better(
			better(
				editable ? correctWord(word, field, normalisedField, words, 0, MAX_EDITS) : null,
				scatterWord(word, field, normalisedField, words),
			),
			stuck !== null
				? correctWord(stuck, field, normalisedField, words, 1, MAX_EDITS - 1)
				: swaps !== null
					? swapWord(swaps, field, normalisedField, words)
					: null,
		);
	const correctable = queryWords.some((word) => word.length >= MIN_PHRASE_CORRECTION_LENGTH);
	const matchable = phrase
		? correctable || mayBeOneWord(queryWords)
		: letters.length >= MIN_SCATTER_LENGTH;
	// With no word long enough to correct, only an edit beside a stray space can
	// leave a letter unmatched.
	const unmatched = phrase && !correctable ? spare : MAX_EDITS;
	if (!matchable) return null;
	// A held key's cut form holds the classes of the word as typed and no more
	// of any, so its counts admit every field either reading does.
	const counted = stuck ?? letters;
	return {
		needed: charMask(counted),
		counts: classCounts(counted),
		// A swap or a sparse reading leaves no letter unmatched.
		spare: editable ? unmatched : stuck !== null ? MAX_EDITS - 1 : 0,
		// A sparse reading keeps no pairs of a word together.
		admitsPairs: phrase ? phrasePairs(queryWords, asPhrase, spare) : null,
		wholeList: !competing,
		match: (field, normalisedField) => {
			if (normalisedField.length > MAX_FIELD_LENGTH) return null;
			// Without edits a word is read only sparsely, swapped or rejoined whole,
			// and each needs its letters in the field before any word is split out.
			if (
				!editable &&
				stuck === null &&
				!holdsInOrderFrom(normalisedField, letters, 0, 0) &&
				!swaps?.some((swap) => normalisedField.includes(swap.normalised))
			) {
				return null;
			}
			const words = fieldWords(normalisedField);
			if (!phrase) return matchWord(queryWords[0], field, normalisedField, words);
			return (
				(asPhrase ? correctPhrase(prepared, field, normalisedField, words) : null) ??
				correctSplitWord(queryWords, spare, field, normalisedField, words)
			);
		},
	};
};

// A short word with only fuzzy chains beside it is read in full, swaps and
// all, since a swap is the one edit worth trying that short and its target
// never passes the literal gates.
const readsSwaps = ({ queryWords }: PreparedQuery): boolean =>
	queryWords.length === 1 && queryWords[0].length === SWAP_ONLY_LENGTH;

const prepare = (prepared: PreparedQuery, competition: Competition): PreparedReading | null => {
	const competing = competition === "literal" || (competition === "fuzzy" && !readsSwaps(prepared));
	return ((prepared.readings ??= [])[+competing] ??= prepareReading(prepared, competing));
};

// The second pass, tried on fields up to 512 characters once the ladder and
// its one-edit rescue have run. A sparse word, or a word split by a stray space
// alone, competes while fewer than ten items match the query as typed, and a
// swap in a four-letter word while none matches it literally; other mistakes
// are corrected only when nothing matches it otherwise.
// An object rather than the bare function so bench/ladder.ts can swap the
// second pass out.
export const readings: {
	prepare: (prepared: PreparedQuery, competition: Competition) => PreparedReading | null;
} = { prepare };
