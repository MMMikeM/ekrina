import { closesWord } from "./boundaries";
import {
	budgetAdmits,
	buildRawGate,
	buildWordStartRawGate,
	charMask,
	type FieldBigrams,
	rawFieldMask,
	rawFieldScan,
} from "./gates";
import { shiftRanges } from "./ladder";
import { matchField } from "./match";
import { normaliseText } from "./normalise";
import { frontGate, prepareBoundedQuery } from "./query";
import { resolveFieldSpecs } from "./fields";
import { CONTAINS_SCORE } from "./scores";
import { type Competition, type PreparedStage, stages } from "./stages";
import type {
	Field,
	FieldMatch,
	SearchResult,
	Searcher,
	MatchResult,
	SearchOptions,
} from "./types";

// Ten because that is the slice a picker shows, and the cutoff the published
// MRR uses; a correction that cannot reach the top ten is work no caller can
// observe through the ranking (@see docs/benchmarks.md).
const RESCUE_CUTOFF = 10;

const endsOnWordBoundary = (normalisedField: string, ranges: [number, number][]): boolean =>
	closesWord(normalisedField, ranges[ranges.length - 1][1]);

/**
 * Creates a fuzzy search function for a list.
 *
 * Results are sorted best first; within a score, a match that ends on a word
 * boundary comes first, then list order.
 * A one-character query matches only where it starts a word, since anywhere it
 * would hit most of any real list, in no useful order.
 * A query under five characters is corrected only when no item matches it as
 * typed, and no correction is tried once ten items match literally.
 * A sparse word, or a four-letter word with two letters swapped, can still
 * match beside them.
 * A query is matched on its first 256 characters, and one holding a word over
 * 64 characters is never corrected.
 * With named fields, a result says which one matched best in `field`; a tie goes
 * to the field whose match ends on a word boundary, then to the one named first.
 * An empty object of fields leaves nothing to search, so every query returns no
 * results.
 *
 * @throws TypeError when the selection is neither a field nor an object of
 * named fields, when a field is named `selectField` or like an integer, when a
 * field lacks `selectField`, or when a field spec carries any key but
 * `selectField`, `acronym` and `demoteBy`.
 * @throws RangeError when a field's `demoteBy` is negative, infinite or not a
 * number.
 *
 * @example
 * // Array of strings
 * const search = createSearcher(['apple', 'banana']);
 * search('ban'); // [{ item: 'banana', score: 0.5, tier: 'prefix', ranges: [[0, 2]], text: 'banana' }]
 *
 * @example
 * // Objects, one field, and one with options
 * const search = createSearcher(users, (u) => u.name);
 * const countries = createSearcher(places, { selectField: (p) => p.name, acronym: true });
 *
 * @example
 * // Named fields, each a function or a spec (a body hit ranks like a title contains)
 * const search = createSearcher(posts, {
 *   title: (p) => p.title,
 *   body: { selectField: (p) => p.body, demoteBy: SCORES.CONTAINS },
 * });
 * search('loop')[0]?.field; // 'title' | 'body'
 */
export function createSearcher(list: string[]): Searcher<string>;
export function createSearcher<T>(list: T[], field: Field<T>): Searcher<T>;
export function createSearcher<T, F extends string>(
	list: T[],
	fields: Record<F, Field<T>> & { selectField?: never },
): Searcher<T, F>;
export function createSearcher<T, F extends string>(
	list: T[],
	selection?: Field<T> | Record<F, Field<T>>,
): Searcher<T, F> {
	const resolvedSpecs = resolveFieldSpecs(selection);
	const specCount = resolvedSpecs.length;
	const count = list.length;
	const named = specCount > 0 && resolvedSpecs[0].fieldName !== undefined;
	// Each field's best match so far, item-major. A field keeps its first match on
	// a tie, as fuzzyMatch does, and an item's best field is derived from these, so
	// a result and its `fields` entry are always the same match.
	// Allocated by the first search, so a searcher that is never queried holds none.
	let fieldMatches: (MatchResult | undefined)[] = [];
	let fieldEndsWord = new Uint8Array(0);
	// Each matched item's best field, taken once before the sort.
	let bestFields: Uint8Array | Uint32Array | null = null;
	let matched: number[] = [];
	const forgetMatches = (): void => {
		for (const i of matched) fieldMatches.fill(undefined, i * specCount, (i + 1) * specCount);
		matched = [];
	};
	const fieldScore = (i: number, f: number): number =>
		(fieldMatches[i * specCount + f] as MatchResult).score + resolvedSpecs[f].demotion;
	const bestFieldOf = (i: number): number => {
		const base = i * specCount;
		let best = -1;
		for (let f = 0; f < specCount; f++) {
			if (fieldMatches[base + f] === undefined) continue;
			if (best !== -1) {
				const lead = fieldScore(i, f) - fieldScore(i, best);
				if (lead > 0 || (lead === 0 && fieldEndsWord[base + f] <= fieldEndsWord[base + best]))
					continue;
			}
			best = f;
		}
		return best;
	};
	const sortedField = (i: number): number => (bestFields === null ? 0 : bestFields[i]);
	const hasMatch = (i: number): boolean => {
		for (let f = 0; f < specCount; f++)
			if (fieldMatches[i * specCount + f] !== undefined) return true;
		return false;
	};
	// The best field's score is at most CONTAINS exactly when any field's is.
	const holdsLiteral = (i: number): boolean => {
		for (let f = 0; f < specCount; f++) {
			if (fieldMatches[i * specCount + f] !== undefined && fieldScore(i, f) <= CONTAINS_SCORE)
				return true;
		}
		return false;
	};

	// Item-major flat caches, filled per field on first mask survival: survivors
	// are a few percent of the corpus and recur across keystrokes, so this warms
	// to the working set instead of the whole list.
	// oxlint-disable-next-line unicorn/no-new-array
	const normalisedFields: (string | undefined)[] = new Array(count * specCount);
	const fieldMasks = new Int32Array(count * specCount);
	// Allocated only if any field has leading whitespace — real data virtually
	// never does.
	let leads: Int32Array | null = null;

	// Built by the first whole-list pass or buildIndex: single-word literal gating
	// reads the caller's own strings, so a session of them never needs it.
	let unionMasks: Int32Array | null = null;

	const rawFieldOf = (i: number, f: number): string => resolvedSpecs[f].selector(list[i]) || "";
	// An empty set reads as not yet computed, so an item without a single letter
	// pair is rescanned each time it is asked about, instead of every item
	// paying a byte for a known flag.
	let bigramsLo = new Int32Array(0);
	let bigramsHi = new Int32Array(0);
	const bigrams = { lo: 0, hi: 0 };
	const pairsOf = (i: number): FieldBigrams => {
		if (bigramsLo.length === 0) {
			bigramsLo = new Int32Array(count);
			bigramsHi = new Int32Array(count);
		}
		bigrams.lo = bigramsLo[i];
		bigrams.hi = bigramsHi[i];
		if (bigrams.lo | bigrams.hi) return bigrams;
		for (let f = 0; f < specCount; f++) rawFieldScan(rawFieldOf(i, f), bigrams);
		bigramsLo[i] = bigrams.lo;
		bigramsHi[i] = bigrams.hi;
		return bigrams;
	};

	// `withBigrams` takes every item's bigram set in the same pass as its masks,
	// when the caller asked for the whole index up front.
	const buildUnionMasks = (withBigrams = false): Int32Array => {
		// With one field per item (every plain string list) the per-field masks ARE
		// the union masks, so the array is shared rather than duplicated.
		const masks = specCount === 1 ? fieldMasks : new Int32Array(count);
		if (withBigrams) {
			bigramsLo = new Int32Array(count);
			bigramsHi = new Int32Array(count);
		}
		for (let i = 0; i < count; i++) {
			let union = 0;
			bigrams.lo = 0;
			bigrams.hi = 0;
			for (let f = 0; f < specCount; f++) {
				const raw = rawFieldOf(i, f);
				const mask = withBigrams ? rawFieldScan(raw, bigrams) : rawFieldMask(raw);
				fieldMasks[i * specCount + f] = mask;
				union |= mask;
			}
			masks[i] = union;
			if (withBigrams) {
				bigramsLo[i] = bigrams.lo;
				bigramsHi[i] = bigrams.hi;
			}
		}
		return masks;
	};

	const trimmedField = (i: number, f: number): string => rawFieldOf(i, f).trim();

	const materialise = (i: number): void => {
		const base = i * specCount;
		if (normalisedFields[base] !== undefined) return;
		for (let f = 0; f < specCount; f++) {
			const raw = rawFieldOf(i, f);
			const lead = raw.length - raw.trimStart().length;
			if (lead) (leads ??= new Int32Array(count * specCount))[base + f] = lead;
			const normalisedField = normaliseText(raw.trim());
			normalisedFields[base + f] = normalisedField;
			// Already filled, with strictly more bits, if the union scan ran.
			if (unionMasks === null) fieldMasks[base + f] = charMask(normalisedField);
		}
	};

	// Prefix-narrowing cache: when the query extends the previous one, only the
	// previous survivors need rescanning. Sound because every filter is monotone
	// under query extension — an item the shorter query rejected stays rejected —
	// and the cached set is always a GATE-passing set of the same gate kind; the
	// match set itself is not monotone (a field can match "borw" as a corrected
	// "brow" while failing "bor", which is too short to correct).
	const survivorCache = {
		query: "",
		multiWord: false,
		survivors: null as Int32Array | null,
		spare: null as Int32Array | null,
		count: 0,
	};

	const search = (query: string, { limit }: SearchOptions = {}): SearchResult<T, F>[] => {
		if (limit !== undefined && !(Number.isInteger(limit) && limit > 0)) {
			throw new RangeError(`limit must be a positive integer, got ${limit}`);
		}
		const prepared = prepareBoundedQuery(query);
		if (prepared === null) return [];
		forgetMatches();
		if (fieldEndsWord.length < count * specCount) {
			// oxlint-disable-next-line unicorn/no-new-array
			fieldMatches = new Array(count * specCount);
			fieldEndsWord = new Uint8Array(count * specCount);
			if (specCount > 1) bestFields = new (specCount < 256 ? Uint8Array : Uint32Array)(count);
		}
		const { normalisedQuery, queryMask } = prepared;
		const singleChar = normalisedQuery.length === 1;

		const multiWord = prepared.queryWords.length > 1;

		const survivors = (survivorCache.spare ??= new Int32Array(count));
		let survivorCount = 0;
		// Corrections and fuzzy chains both score above SCORES.CONTAINS, so only
		// literal hits can fill the page ahead of a correction.
		let literalHits = 0;
		const pageSize = limit ?? Infinity;

		const setField = (i: number, f: number, match: MatchResult): void => {
			const at = i * specCount + f;
			if (fieldMatches[at] === undefined && !hasMatch(i)) matched.push(i);
			fieldMatches[at] = match;
			fieldEndsWord[at] = endsOnWordBoundary(normalisedFields[at] as string, match.ranges) ? 1 : 0;
		};

		const scoreItem = (i: number, frontGated: boolean): void => {
			// Only a lone field skips chains once a page matches literally: with
			// several, `fields` reports every match.
			const literalOnly = specCount === 1 && literalHits >= pageSize;
			materialise(i);
			const base = i * specCount;
			for (let f = 0; f < specCount; f++) {
				const result = matchField(
					trimmedField(i, f),
					normalisedFields[base + f] as string,
					fieldMasks[base + f],
					prepared,
					resolvedSpecs[f].acronymTier,
					frontGated,
					literalOnly,
				);
				if (result) setField(i, f, result);
			}
			if (holdsLiteral(i)) literalHits++;
		};

		const narrowed =
			survivorCache.survivors !== null &&
			normalisedQuery.startsWith(survivorCache.query) &&
			multiWord === survivorCache.multiWord;

		const admit = (i: number, frontGated: boolean): void => {
			survivors[survivorCount++] = i;
			scoreItem(i, frontGated);
		};

		// Every field the ladder can match outright, none of the near-misses only
		// a correction reaches.
		const literalPass = (): void => {
			if (narrowed) {
				// The gate runs out here because its verdict is what shrinks the
				// cached set for the next keystroke.
				const gate = frontGate(prepared);
				const cached = survivorCache.survivors as Int32Array;
				for (let k = 0; k < survivorCache.count; k++) {
					const i = cached[k];
					const base = i * specCount;
					let admitted = gate === null;
					for (let f = 0; f < specCount && !admitted; f++) {
						admitted = gate!.test(normalisedFields[base + f] as string);
					}
					if (admitted) admit(i, specCount === 1);
				}
				return;
			}
			// The presence gate has no raw-text form yet, so multi-word queries
			// take the mask path.
			const gate = singleChar
				? buildWordStartRawGate(normalisedQuery)
				: unionMasks === null && !multiWord
					? buildRawGate(normalisedQuery)
					: null;
			if (gate === null) {
				// A superset of what the gate admits, so caching these survivors
				// keeps the narrowing sound.
				const masks = (unionMasks ??= buildUnionMasks());
				for (let i = 0; i < count; i++) if ((queryMask & ~masks[i]) === 0) admit(i, false);
				return;
			}
			for (let i = 0; i < count; i++) {
				let admitted = false;
				for (let f = 0; f < specCount && !admitted; f++) admitted = gate.test(rawFieldOf(i, f));
				if (admitted) admit(i, false);
			}
		};

		const correctItem = (i: number, stage: PreparedStage): void => {
			const base = i * specCount;
			for (let f = 0; f < specCount; f++) {
				const at = base + f;
				if (!budgetAdmits(stage.needed & ~fieldMasks[at], stage.counts, stage.spare)) continue;
				materialise(i);
				const held = fieldMatches[at] ?? null;
				const result = stage.match(
					trimmedField(i, f),
					normalisedFields[at] as string,
					held,
					fieldMasks[at],
					resolvedSpecs[f].acronymTier,
				);
				if (result !== held) setField(i, f, result as MatchResult);
			}
		};

		// Into the previous keystroke's survivor buffer, which the literal pass has
		// finished reading. A bare mask test: with the stages' other gates inside
		// this loop, a query matching nothing ran up to 50% slower.
		const budgetCandidates = ({ needed, counts, spare }: PreparedStage): number => {
			const masks = unionMasks as Int32Array;
			const candidates = (survivorCache.survivors ??= new Int32Array(count));
			let found = 0;
			for (let i = 0; i < count; i++) {
				const missing = needed & ~masks[i];
				if (missing === 0 || budgetAdmits(missing, counts, spare)) candidates[found++] = i;
			}
			return found;
		};

		const runStage = (stage: PreparedStage): void => {
			// A phrase's literal gates read only its words' characters; a single
			// word's read its punctuation too, which no stage needs.
			const survivorsOnly =
				!stage.wholeList && (multiWord || normalisedQuery === prepared.queryWords[0]);
			// Fills every item's field masks, which the stages' gates read.
			if (!survivorsOnly) unionMasks ??= buildUnionMasks();
			const masks = unionMasks;
			// Survivors hold every letter of the query, so only the whole list is
			// read against the letter budget.
			const scanned = survivorsOnly ? survivorCount : budgetCandidates(stage);
			const items = survivorsOnly ? survivors : (survivorCache.survivors as Int32Array);
			// An item's union mask and bigram set span all its fields, so it is
			// skipped only when no field could pass.
			const { needed, admitsPairs, besideLiteral } = stage;
			for (let k = 0; k < scanned; k++) {
				const i = items[k];
				if (masks !== null && admitsPairs !== null && !admitsPairs(needed & ~masks[i], i, pairsOf))
					continue;
				if (!besideLiteral && holdsLiteral(i)) continue;
				correctItem(i, stage);
			}
		};

		literalPass();
		if (literalHits < Math.min(RESCUE_CUTOFF, limit ?? RESCUE_CUTOFF)) {
			for (const stage of stages) {
				const competition: Competition =
					literalHits > 0 ? "literal" : matched.length > 0 ? "fuzzy" : "none";
				const corrector = stage.prepare(prepared, competition);
				if (corrector !== null) runStage(corrector);
			}
		}

		survivorCache.query = normalisedQuery;
		survivorCache.multiWord = multiWord;
		// A single character's word-start set cannot seed the cache: the next
		// keystroke may match mid-word. The rescues leave the literal survivors as
		// they were.
		if (singleChar) {
			survivorCache.survivors = null;
		} else {
			survivorCache.spare = survivorCache.survivors;
			survivorCache.survivors = survivors;
			survivorCache.count = survivorCount;
		}

		// Within a score, a match that ends on a word boundary ranks first ("will"
		// means "Will Smith" before "Willa"), then list order.
		if (bestFields !== null) for (const i of matched) bestFields[i] = bestFieldOf(i);
		const ranks = (a: number, b: number): number => {
			const fa = sortedField(a);
			const fb = sortedField(b);
			return (
				fieldScore(a, fa) - fieldScore(b, fb) ||
				fieldEndsWord[b * specCount + fb] - fieldEndsWord[a * specCount + fa] ||
				a - b
			);
		};
		// Only the page is put in order: matches buffer to twice the page, which is
		// sorted and cut back, and one that cannot outrank the page's last is skipped.
		let page = matched;
		if (pageSize < matched.length) {
			page = [];
			let last = -1;
			for (const i of matched) {
				if (last !== -1 && ranks(i, last) >= 0) continue;
				if (page.push(i) === 2 * pageSize) {
					page.sort(ranks).length = pageSize;
					last = page[pageSize - 1];
				}
			}
		}
		const results = page.sort(ranks).slice(0, pageSize).map(resultOf);
		forgetMatches();
		return results;
	};

	const fieldMatchOf = (i: number, f: number, match: MatchResult): FieldMatch => {
		const entry: FieldMatch = { tier: match.tier, ranges: match.ranges, text: rawFieldOf(i, f) };
		if (match.corrected !== undefined) entry.corrected = match.corrected;
		return entry;
	};

	// Callers can see key order, so it stays item, score, tier, ranges, text, field,
	// corrected, fields.
	const resultOf = (i: number): SearchResult<T, F> => {
		// A stage reads the match a field holds, so matches stay in trimmed-field
		// offsets until they are reported.
		for (let at = i * specCount; leads !== null && at < (i + 1) * specCount; at++) {
			const match = fieldMatches[at];
			if (match !== undefined) shiftRanges(match.ranges, leads[at]);
		}
		const f = sortedField(i);
		const { tier, ranges, corrected } = fieldMatches[i * specCount + f] as MatchResult;
		const result: SearchResult<T> & { field?: string; fields?: Record<string, FieldMatch> } = {
			item: list[i],
			score: fieldScore(i, f),
			tier,
			ranges,
			text: rawFieldOf(i, f),
		};
		if (named) result.field = resolvedSpecs[f].fieldName;
		if (corrected !== undefined) result.corrected = corrected;
		if (named) result.fields = fieldsOf(i);
		return result as SearchResult<T, F>;
	};

	const fieldsOf = (i: number): Record<string, FieldMatch> => {
		const fields: Record<string, FieldMatch> = {};
		for (let f = 0; f < specCount; f++) {
			const match = fieldMatches[i * specCount + f];
			if (match !== undefined)
				fields[resolvedSpecs[f].fieldName as string] = fieldMatchOf(i, f, match);
		}
		return fields;
	};

	// Asked for up front, the index takes every item's bigram set too, so no
	// query pays for one later.
	const buildIndex = (): void => {
		unionMasks ??= buildUnionMasks(true);
	};

	return Object.assign(search, { buildIndex });
}
