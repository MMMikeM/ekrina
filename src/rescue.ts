import { isBoundaryAt, opensWord } from "./boundaries";
import { charMask } from "./gates";
import { literalTiers, type PreparedQuery, prepareQuery } from "./match";
import { CONTAINS_SCORE, correctedMatch, TYPO_PENALTY } from "./scores";
import type { HighlightRanges, MatchResult } from "./types";

// The field currently being rescued against the prepared query, allocated by
// matchField only when a field actually reaches a rescue site.
export type RescueContext = {
	rawField: string;
	normalisedField: string;
	prepared: PreparedQuery;
	acronymTier: boolean;
	missingClasses: number;
};

type RescueVariant = {
	normalised: string;
	raw: string;
	isDrop: boolean;
	// A subset of the query mask, so `requiredMask & missingClasses` is exactly
	// "the field lacks a class this correction still requires".
	requiredMask: number;
	prepared: PreparedQuery | null;
};

// Below this a correction describes the field rather than the query: almost
// every field offers a window one character away from a 3-character string.
const MIN_RESCUE_QUERY_LENGTH = 4;
// Enumerating a word's corrections costs time and memory quadratic in its
// length, and no real typo needs one this long, so a query holding a longer
// word is never corrected.
export const MAX_RESCUE_WORD_LENGTH = 64;

// Chance corrections are a multiple-comparisons problem scaling with the
// field's window count, while a high floor hurts the short queries that
// dominate label search (@see docs/performance.md).
const minTypoQueryLength = (fieldLength: number): number =>
	fieldLength <= 64 ? 5 : fieldLength <= 1024 ? 6 : 7;

// A substitution keeps the subject's length where a drop shortens it to three
// characters, so on a label it is trusted one character sooner.
const minSubstitutionLength = (fieldLength: number): number =>
	fieldLength <= 64 ? MIN_RESCUE_QUERY_LENGTH : minTypoQueryLength(fieldLength);

// Below this a subject is short: it is corrected only at a word start, and only
// when nothing matches the query as typed. Drops wait for it too.
export const MIN_TYPO_QUERY_LENGTH: number = minTypoQueryLength(0);

const reachesFloor = (normalisedQuery: string, queryWords: string[], floor: number): boolean =>
	queryWords.length === 1
		? normalisedQuery.length >= floor
		: queryWords.some((word) => word.length >= floor);

// Whether any rescue may run, and so whether the mask gate may relax to one
// missing class. matchField and the searcher's survivor scan must ask this same
// question, or one corrects what the other cannot.
export const isRescuableQuery = (normalisedQuery: string, queryWords: string[]): boolean =>
	reachesFloor(normalisedQuery, queryWords, MIN_RESCUE_QUERY_LENGTH) &&
	queryWords.every((word) => word.length <= MAX_RESCUE_WORD_LENGTH);

// A short query's correction stands in for a missing match and never competes
// with one: finding it means testing every item that holds the query's
// letters, which the searcher does only when nothing matched as typed
// (@see docs/performance.md).
export const isShortQuery = (normalisedQuery: string, queryWords: string[]): boolean =>
	!reachesFloor(normalisedQuery, queryWords, MIN_TYPO_QUERY_LENGTH);

const SCORE_EPSILON = 1e-9;

// Ties keep the incumbent, so a caller passes a fuzzy chain as the challenger:
// the one-edit reading names the character the user got wrong, where a chain
// only says the letters appear in order.
export const preferBetter = (
	incumbent: MatchResult | null,
	challenger: MatchResult | null,
): MatchResult | null => {
	if (incumbent === null) return challenger;
	if (challenger === null) return incumbent;
	return challenger.score < incumbent.score - SCORE_EPSILON ? challenger : incumbent;
};

type Edit = (text: string, at: number) => string;

export const swapAdjacentAt: Edit = (text, at) =>
	text.slice(0, at) + text[at + 1] + text[at] + text.slice(at + 2);

const dropCharAt: Edit = (text, at) => text.slice(0, at) + text.slice(at + 1);

// Needs normaliseText's 1:1 mapping to index the raw query by normalised
// offsets; when NFC shortened decomposed input, the normalised query stands in
// for it — sound, just case-blind.
const rawQuery = ({ query, normalisedQuery }: PreparedQuery): string =>
	query.length === normalisedQuery.length ? query : normalisedQuery;

// The correction must be the user's own text with one character changed —
// spelling it out of the field would credit an ALL-CAPS query with an
// exact-case match it never made.
const substituteRaw = (raw: string, normalised: string, corrected: string): string => {
	for (let i = 0; i < corrected.length; i++) {
		if (corrected[i] !== normalised[i]) return raw.slice(0, i) + corrected[i] + raw.slice(i + 1);
	}
	// A substitution differs in exactly one place, so the loop always returns.
	/* v8 ignore next */
	return corrected;
};

const prepareCorrection = (
	prepared: PreparedQuery,
	rawCorrected: string,
	normalisedCorrected: string,
): PreparedQuery => {
	const cached = prepared.lastCorrection;
	if (
		cached !== undefined &&
		cached.query === rawCorrected &&
		cached.normalisedQuery === normalisedCorrected
	) {
		return cached;
	}
	return (prepared.lastCorrection = prepareQuery(rawCorrected, normalisedCorrected));
};

// Only a literal tier counts: rescuing a fuzzy chain is an invented edit on top
// of a speculative assembly (@see docs/benchmarks.md).
const scoreCorrectedQuery = (
	rescue: RescueContext,
	correctedQuery: PreparedQuery,
	short = false,
): MatchResult | null => {
	const result = literalTiers(
		rescue.rawField,
		rescue.normalisedField,
		correctedQuery,
		rescue.acronymTier,
	);
	return result && (!short || startsWord(result))
		? correctedMatch(result, 1, correctedQuery.query)
		: null;
};

// Mid-word, most fields hold a window one edit from four characters ("colt" in
// "Nicolas"), so a short correction must start a word.
const startsWord = (result: MatchResult): boolean =>
	result.score < CONTAINS_SCORE && result.tier !== "acronym";

const isUnbeatableCorrection = (best: MatchResult | null): best is MatchResult =>
	best !== null && best.score <= TYPO_PENALTY;

// Swaps and drops never collide — they differ in length. A *missing* character
// is not enumerable and is recovered from the fuzzy chain instead (see
// missingCharRescue).
const buildRescueVariants = (raw: string, normalisedQuery: string): RescueVariant[] => {
	const seen = new Set<string>();
	const variants: RescueVariant[] = [];
	const addVariant = (at: number, edit: Edit): void => {
		const normalised = edit(normalisedQuery, at);
		if (seen.has(normalised)) return;
		seen.add(normalised);
		variants.push({
			normalised,
			raw: edit(raw, at),
			isDrop: normalised.length < normalisedQuery.length,
			requiredMask: charMask(normalised),
			prepared: null,
		});
	};
	for (let at = 0; at < normalisedQuery.length - 1; at++) {
		if (normalisedQuery[at] !== normalisedQuery[at + 1]) addVariant(at, swapAdjacentAt);
	}
	if (normalisedQuery.length >= MIN_TYPO_QUERY_LENGTH) {
		for (let at = 0; at < normalisedQuery.length; at++) addVariant(at, dropCharAt);
	}
	return variants;
};

// A drop, a substitution or a swap leaves one half of the subject intact, unless
// the swap straddles the split, so a field holding none of the three holds no
// correction. The halves come first: substitutedWindows reads them.
const correctionAnchors = (subjectText: string): string[] => {
	const splitAt = subjectText.length >> 1;
	return [
		subjectText.slice(0, splitAt),
		subjectText.slice(splitAt),
		swapAdjacentAt(subjectText, splitAt - 1),
	];
};

// By the pigeonhole principle a single substitution leaves at least one half of
// the subject intact, so those halves' occurrences are the only windows worth
// testing. Position must not rank the corrections — the rerun rescans the field.
const substitutedWindows = (
	normalisedField: string,
	{ queryText: subjectText, anchors: [head, tail] }: CorrectionSubject,
	atWordStart: boolean,
): string[] => {
	const subjectLength = subjectText.length;
	const halves: [offset: number, half: string][] = [
		[0, head],
		[head.length, tail],
	];
	const windows: string[] = [];
	for (const [offset, half] of halves) {
		for (
			let halfAt = normalisedField.indexOf(half);
			halfAt > -1;
			halfAt = normalisedField.indexOf(half, halfAt + 1)
		) {
			const windowStart = halfAt - offset;
			if (windowStart < 0 || windowStart + subjectLength > normalisedField.length) continue;
			if (atWordStart && !opensWord(normalisedField, windowStart)) continue;
			let mismatches = 0;
			let mismatchAt = -1;
			for (let i = 0; i < subjectLength; i++) {
				if (normalisedField[windowStart + i] === subjectText[i]) continue;
				mismatchAt = i;
				if (++mismatches > 1) break;
			}
			// Exactly one: zero would mean the contains tier already owns it. A
			// separator in its place splits the word rather than correcting it.
			if (mismatches !== 1 || isBoundaryAt(normalisedField, windowStart + mismatchAt)) continue;
			const corrected = normalisedField.slice(windowStart, windowStart + subjectLength);
			if (!windows.includes(corrected)) windows.push(corrected);
		}
	}
	return windows;
};

export const wordStartsOf = (prepared: PreparedQuery): number[] => {
	let starts = prepared.wordStarts;
	if (starts === undefined) {
		starts = [];
		let from = 0;
		for (const word of prepared.queryWords) {
			const wordAt = prepared.normalisedQuery.indexOf(word, from);
			starts.push(wordAt);
			from = wordAt + word.length;
		}
		prepared.wordStarts = starts;
	}
	return starts;
};

export const rawWordOf = (prepared: PreparedQuery, wordIndex: number): string => {
	const wordStart = wordStartsOf(prepared)[wordIndex];
	return rawQuery(prepared).slice(wordStart, wordStart + prepared.queryWords[wordIndex].length);
};

const wordRescueStateOf = (prepared: PreparedQuery, wordIndex: number): CorrectionSubject => {
	const cache = (prepared.wordRescueStates ??= prepared.queryWords.map(() => undefined));
	return (cache[wordIndex] ??= absentWordSubject(prepared, wordIndex));
};

const spliceCorrectedWord = (
	prepared: PreparedQuery,
	wordIndex: number,
	rawWord: string,
	normalisedWord: string,
): PreparedQuery => {
	const wordStart = wordStartsOf(prepared)[wordIndex];
	const wordEnd = wordStart + prepared.queryWords[wordIndex].length;
	const normalisedCorrected =
		prepared.normalisedQuery.slice(0, wordStart) +
		normalisedWord +
		prepared.normalisedQuery.slice(wordEnd);
	const raw = rawQuery(prepared);
	const rawCorrected = raw.slice(0, wordStart) + rawWord + raw.slice(wordEnd);
	return prepareCorrection(prepared, rawCorrected, normalisedCorrected);
};

// What a rescue corrects — the whole query, or a phrase's one absent word —
// with the two ways a correction of it becomes a scoreable query.
export type CorrectionSubject = {
	queryText: string;
	anchors: string[];
	variants: RescueVariant[];
	fromVariant: (variant: RescueVariant) => PreparedQuery;
	fromWindow: (corrected: string) => PreparedQuery;
};

const wholeQuerySubject = (prepared: PreparedQuery): CorrectionSubject => ({
	queryText: prepared.normalisedQuery,
	anchors: correctionAnchors(prepared.normalisedQuery),
	variants: buildRescueVariants(rawQuery(prepared), prepared.normalisedQuery),
	fromVariant: (variant) => (variant.prepared ??= prepareQuery(variant.raw, variant.normalised)),
	fromWindow: (corrected) =>
		prepareCorrection(
			prepared,
			substituteRaw(rawQuery(prepared), prepared.normalisedQuery, corrected),
			corrected,
		),
});

const absentWordSubject = (prepared: PreparedQuery, wordIndex: number): CorrectionSubject => ({
	queryText: prepared.queryWords[wordIndex],
	anchors: correctionAnchors(prepared.queryWords[wordIndex]),
	variants: buildRescueVariants(rawWordOf(prepared, wordIndex), prepared.queryWords[wordIndex]),
	fromVariant: (variant) =>
		spliceCorrectedWord(prepared, wordIndex, variant.raw, variant.normalised),
	fromWindow: (corrected) =>
		spliceCorrectedWord(
			prepared,
			wordIndex,
			substituteRaw(rawWordOf(prepared, wordIndex), prepared.queryWords[wordIndex], corrected),
			corrected,
		),
});

const scoreEnumeratedVariants = (
	rescue: RescueContext,
	subject: CorrectionSubject,
	fieldFloor: number,
	short: boolean,
): MatchResult | null => {
	let best: MatchResult | null = null;
	for (const variant of subject.variants) {
		if (variant.isDrop && subject.queryText.length < fieldFloor) continue;
		if ((variant.requiredMask & rescue.missingClasses) !== 0) continue;
		if (!rescue.normalisedField.includes(variant.normalised)) continue;
		best = preferBetter(best, scoreCorrectedQuery(rescue, subject.fromVariant(variant), short));
		if (isUnbeatableCorrection(best)) return best;
	}
	return best;
};

const scoreSubstitutedWindows = (
	rescue: RescueContext,
	subject: CorrectionSubject,
	incumbent: MatchResult | null,
	short: boolean,
): MatchResult | null => {
	let best = incumbent;
	for (const corrected of substitutedWindows(rescue.normalisedField, subject, short)) {
		best = preferBetter(best, scoreCorrectedQuery(rescue, subject.fromWindow(corrected), short));
		if (isUnbeatableCorrection(best)) return best;
	}
	return best;
};

// Price the whole enumerated family before taking one — enumeration order says
// nothing about how well a variant reads — then the substituted windows: a
// subject mistyped at its first or last character has two valid readings
// ("ergonomiq" is a substitution, but dropping the "q" leaves a prefix), and
// stopping after the enumerated family would let the worse one win by default.
// A corrected exact hit is unbeatable and exits early.
const correctSubject = (rescue: RescueContext, subject: CorrectionSubject): MatchResult | null => {
	if (!subject.anchors.some((anchor) => rescue.normalisedField.includes(anchor))) return null;
	const fieldLength = rescue.normalisedField.length;
	const short = subject.queryText.length < MIN_TYPO_QUERY_LENGTH;
	const best = scoreEnumeratedVariants(rescue, subject, minTypoQueryLength(fieldLength), short);
	if (
		isUnbeatableCorrection(best) ||
		subject.queryText.length < minSubstitutionLength(fieldLength)
	) {
		return best;
	}
	return scoreSubstitutedWindows(rescue, subject, best, short);
};

// The index of the one query word missing from the field, or null when every
// word is present or more than one is absent — either way, no one-edit rescue.
const soleAbsentWord = (normalisedField: string, words: string[]): number | null => {
	let absentIndex: number | null = null;
	for (let i = 0; i < words.length; i++) {
		if (normalisedField.includes(words[i])) continue;
		if (absentIndex !== null) return null;
		absentIndex = i;
	}
	return absentIndex;
};

// The literal words have already pinned the field, so only the single absent
// word is corrected and the whole phrase rerun.
const multiWordRescue = (rescue: RescueContext): MatchResult | null => {
	const { prepared, normalisedField } = rescue;
	const absentIndex = soleAbsentWord(normalisedField, prepared.queryWords);
	if (absentIndex === null) return null;
	if (prepared.queryWords[absentIndex].length < MIN_RESCUE_QUERY_LENGTH) return null;
	return correctSubject(rescue, wordRescueStateOf(prepared, absentIndex));
};

const typoRescue = (rescue: RescueContext): MatchResult | null => {
	const { prepared } = rescue;
	return correctSubject(rescue, (prepared.rescueState ??= wholeQuerySubject(prepared)));
};

// A fuzzy assembly of exactly two chunks around a one-character gap is a
// dropped keystroke, unless the gap is a separator. It skips the field-scaled
// floor: the shape pins the correction to one window, so there are no multiple
// comparisons to guard against (@see bench/longtext.test.ts).
export const missingCharRescue = (
	rescue: RescueContext,
	ranges: HighlightRanges,
): MatchResult | null => {
	const { prepared, normalisedField } = rescue;
	if (ranges.length !== 2) return null;
	const [[firstStart, firstEnd], [secondStart, secondEnd]] = ranges;
	if (secondStart !== firstEnd + 2 || isBoundaryAt(normalisedField, firstEnd + 1)) return null;
	const gapChar = normalisedField[firstEnd + 1];

	const insertAt = firstEnd - firstStart + 1;
	const raw = rawQuery(prepared);
	return scoreCorrectedQuery(
		rescue,
		prepareCorrection(
			prepared,
			raw.slice(0, insertAt) + gapChar + raw.slice(insertAt),
			normalisedField.slice(firstStart, secondEnd + 1),
		),
	);
};

export const rescueField = (rescue: RescueContext): MatchResult | null =>
	rescue.prepared.queryWords.length > 1 ? multiWordRescue(rescue) : typoRescue(rescue);
