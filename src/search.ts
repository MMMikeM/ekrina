import { isBoundaryChar } from "./boundaries";
import {
	buildRawGate,
	buildRescueBigramGate,
	buildWordStartRawGate,
	charMask,
	type Gate,
} from "./gates";
import { matchField, prepareBoundedQuery } from "./match";
import { normaliseText, rawFieldMask, rawFieldScan } from "./normalise";
import { isRescuableQuery, isShortQuery } from "./rescue";
import { CONTAINS_SCORE } from "./scores";
import { type Competition, type PreparedReading, readings } from "./readings";
import type {
	FieldSpec,
	SearchResult,
	Searcher,
	MatchOptions,
	MatchResult,
	SearchOptions,
} from "./types";


// Ten because that is the slice a picker shows, and the cutoff the published
// MRR uses; a correction that cannot reach the top ten is work no caller can
// observe through the ranking (@see docs/benchmarks.md).
const RESCUE_CUTOFF = 10;

const endsOnWordBoundary = (normalisedField: string, ranges: [number, number][]): boolean => {
	const after = ranges[ranges.length - 1][1] + 1;
	return after >= normalisedField.length || isBoundaryChar(normalisedField[after]);
};

// matchField returns fresh HighlightRange tuples per call, so mutating in place is safe.
const shiftRanges = (ranges: [number, number][], lead: number): void => {
	for (const range of ranges) {
		range[0] += lead;
		range[1] += lead;
	}
};

/**
 * Score one string against a query, or null when it doesn't match.
 *
 * Judges the string on its own. A searcher over a list can return fewer
 * corrections than this does per item (see createSearcher).
 * A query is matched on its first 256 characters, and one holding a word over
 * 64 characters is never corrected.
 *
 * @example
 * fuzzyMatch('banana', 'ban'); // { score: 0.5, tier: 'prefix', ranges: [[0, 2]] }
 *
 * @example
 * // A typo, corrected: the boundary tier's 1 plus TYPO_PENALTY
 * fuzzyMatch('Open Recent', 'recnet'); // { score: 3.1, tier: 'corrected', corrected: 'recent', ranges: [[5, 10]] }
 */
export const fuzzyMatch = (
	text: string,
	query: string,
	options: MatchOptions = {},
): MatchResult | null => {
	const { acronym = false } = options;
	const q = prepareBoundedQuery(query);
	if (q === null) return null;
	const field = text.trim();
	const normalisedField = normaliseText(field);
	const fieldMask = charMask(normalisedField);

	let result = matchField(field, normalisedField, fieldMask, q, acronym, true);
	if (result === null || result.score > CONTAINS_SCORE) {
		const reading = readings.prepare(q, result === null ? "none" : "fuzzy");
		const fallback = reading?.admitsMask(fieldMask) ? reading.match(field, normalisedField) : null;
		if (fallback && (result === null || fallback.score < result.score)) result = fallback;
	}
	const lead = text.length - text.trimStart().length;
	if (result && lead) shiftRanges(result.ranges, lead);
	return result;
};

type ResolvedSpec<T> = {
	selector: (item: T) => string | null;
	acronymTier: boolean;
	demotion: number;
	fieldName: string | undefined;
};

// JavaScript orders integer-like keys before all others, which would reorder the
// fields and so the tie rule.
const integerLike = /^(0|[1-9]\d*)$/;

// Resolved once: the per-item loops run count × specs times and shouldn't
// re-default options or capture per-item closures.
const resolveFieldSpecs = <T>(
	selection?:
		| ((item: T) => string | null)
		| Record<string, FieldSpec<T> | ((item: T) => string | null)>,
): ResolvedSpec<T>[] => {
	if (!selection) selection = (item) => item as unknown as string;
	if (typeof selection === "function") {
		return [{ selector: selection, acronymTier: false, demotion: 0, fieldName: undefined }];
	}
	if (typeof selection !== "object" || Array.isArray(selection)) {
		throw new TypeError(
			"createSearcher takes a function, or an object of named fields such as { title: (item) => item.title }",
		);
	}
	return Object.entries(selection).map(([name, value]) => {
		if (name === "getText") {
			throw new TypeError("pass the function itself: createSearcher(items, (item) => item.title)");
		}
		if (integerLike.test(name)) {
			throw new TypeError(`a field can't be named ${name}: integer-like names sort before the others`);
		}
		const spec = typeof value === "function" ? { selectField: value } : value;
		if (typeof spec?.selectField !== "function") {
			throw new TypeError(`field ${name} needs selectField, which replaced text in 2.0`);
		}
		if ("atBest" in spec) throw new TypeError("atBest is demoteBy since 2.0");
		return {
			selector: spec.selectField,
			acronymTier: spec.acronym ?? false,
			demotion: spec.demoteBy ?? 0,
			fieldName: name,
		};
	});
};

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
 * @throws TypeError when the fields are neither a function nor an object of
 * named fields, when a field is named like an integer, or when a field lacks
 * `selectField` or uses the 1.x `atBest`.
 *
 * @example
 * // Array of strings
 * const search = createSearcher(['apple', 'banana']);
 * search('ban'); // [{ item: 'banana', score: 0.5, tier: 'prefix', ranges: [[0, 2]], text: 'banana' }]
 *
 * @example
 * // Objects, one field
 * const search = createSearcher(users, (u) => u.name);
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
export function createSearcher<T>(
	list: T[],
	selectField: (item: T) => string | null,
): Searcher<T>;
export function createSearcher<T, F extends string>(
	list: T[],
	fields: Record<F, FieldSpec<T> | ((item: T) => string | null)>,
): Searcher<T, F>;
export function createSearcher<T, F extends string>(
	list: T[],
	selection?: ((item: T) => string | null) | Record<F, FieldSpec<T> | ((item: T) => string | null)>,
): Searcher<T, F> {
	const resolvedSpecs = resolveFieldSpecs(selection);
	const specCount = resolvedSpecs.length;
	const count = list.length;
	// Which result each item holds in the current matches, so a second-pass
	// match can replace a weaker one; a stamp from an earlier generation means
	// none. Float64 so the generation count never wraps.
	// oxlint-disable-next-line unicorn/no-new-array
	const heldResults: (SearchResult<T, F> | undefined)[] = new Array(count);
	const heldStamps = new Float64Array(count);
	const heldEndsWord = new Uint8Array(count);
	let generation = 0;

	// Item-major flat caches, filled per field on first mask survival: survivors
	// are a few percent of the corpus and recur across keystrokes, so this warms
	// to the working set instead of the whole list.
	// oxlint-disable-next-line unicorn/no-new-array
	const trimmedFields: (string | undefined)[] = new Array(count * specCount);
	// oxlint-disable-next-line unicorn/no-new-array
	const normalisedFields: (string | undefined)[] = new Array(count * specCount);
	const fieldMasks = new Int32Array(count * specCount);
	// Allocated only if any field has leading whitespace — real data virtually
	// never does.
	let leads: Int32Array | null = null;

	// The one structure that knows something about every item, so the one that
	// needs a whole-list pass. Single-word literal gating runs against the
	// caller's own strings instead, so unless the caller asks for it up front, it
	// is built by the first multi-word query or rescue, and never for a session
	// of single words that all match literally.
	let unionMasks: Int32Array | null = null;
	// Each item's bigram set across its fields, computed the first time a gate
	// reads it: only items that already passed the mask gate ever need one.
	let bigramsLo = new Int32Array(0);
	let bigramsHi = new Int32Array(0);
	let bigramsKnown = new Uint8Array(0);
	const bigrams = { lo: 0, hi: 0 };
	const knowBigrams = (i: number): void => {
		if (bigramsKnown.length === 0) {
			bigramsLo = new Int32Array(count);
			bigramsHi = new Int32Array(count);
			bigramsKnown = new Uint8Array(count);
		}
		if (bigramsKnown[i]) return;
		bigrams.lo = 0;
		bigrams.hi = 0;
		for (let f = 0; f < specCount; f++) rawFieldScan(resolvedSpecs[f].selector(list[i]) || "", bigrams);
		bigramsLo[i] = bigrams.lo;
		bigramsHi[i] = bigrams.hi;
		bigramsKnown[i] = 1;
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
			bigramsKnown = new Uint8Array(count).fill(1);
		}
		for (let i = 0; i < count; i++) {
			let union = 0;
			bigrams.lo = 0;
			bigrams.hi = 0;
			for (let f = 0; f < specCount; f++) {
				const raw = resolvedSpecs[f].selector(list[i]) || "";
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

	const materialise = (i: number): void => {
		const base = i * specCount;
		if (normalisedFields[base] !== undefined) return;
		const item = list[i];
		for (let f = 0; f < specCount; f++) {
			const raw = resolvedSpecs[f].selector(item) || "";
			const lead = raw.length - raw.trimStart().length;
			if (lead) (leads ??= new Int32Array(count * specCount))[base + f] = lead;
			const field = raw.trim();
			trimmedFields[base + f] = field;
			const normalisedField = normaliseText(field);
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
	// "brow" while failing "bor", which is too short to correct). The two lists
	// double-buffer so the query path stays allocation-free.
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
		generation++;
		const { normalisedQuery, queryMask } = prepared;
		const singleChar = normalisedQuery.length === 1;

		// Same predicate matchField's mask gate uses, so the two cannot drift.
		const rescuable = isRescuableQuery(normalisedQuery, prepared.queryWords);
		const multiWord = prepared.queryWords.length > 1;

		const survivors = (survivorCache.spare ??= new Int32Array(count));
		let survivorCount = 0;
		// The items holding a match this generation.
		let matched: number[] = [];
		// A correction scores at least TYPO_PENALTY (2.1), so once RESCUE_CUTOFF
		// literal hits sit at or below SCORES.CONTAINS (2) no correction can reach
		// the page — the rescue becomes provably invisible work. Fuzzy hits score
		// above 2.1 too, so they cannot crowd a correction out of the count.
		let literalHits = 0;

		// Returns whether the match ends on a word boundary. Results are fresh
		// objects per call, so their ranges can shift in place.
		const placeFieldResult = (result: MatchResult, at: number): boolean => {
			const endsWord = endsOnWordBoundary(normalisedFields[at] as string, result.ranges);
			if (leads !== null) {
				const lead = leads[at];
				if (lead) shiftRanges(result.ranges, lead);
			}
			return endsWord;
		};

		const record = (i: number, entry: SearchResult<T, F>, endsWord: boolean): void => {
			matched.push(i);
			heldResults[i] = entry;
			heldStamps[i] = generation;
			heldEndsWord[i] = endsWord ? 1 : 0;
		};

		const forgetMatches = (): void => {
			matched = [];
			generation++;
		};

		const resultOf = (i: number, f: number, match: MatchResult, score: number): SearchResult<T, F> => {
			const spec = resolvedSpecs[f];
			const result: SearchResult<T> & { field?: string } = {
				item: list[i],
				score,
				tier: match.tier,
				ranges: match.ranges,
				text: spec.selector(list[i]) as string,
			};
			if (spec.fieldName !== undefined) result.field = spec.fieldName;
			if (match.corrected !== undefined) result.corrected = match.corrected;
			return result as SearchResult<T, F>;
		};

		// An item reports its best field. On a tied score the field whose match
		// ends on a word boundary wins, as it does in the sort, then the earlier one.
		const offerField = (
			i: number,
			entry: SearchResult<T, F> | undefined,
			f: number,
			match: MatchResult,
		): SearchResult<T, F> => {
			const endsWord = placeFieldResult(match, i * specCount + f);
			const score = match.score + resolvedSpecs[f].demotion;
			if (entry === undefined) {
				entry = resultOf(i, f, match, score);
				record(i, entry, endsWord);
			} else if (score < entry.score || (score === entry.score && endsWord && !heldEndsWord[i])) {
				heldEndsWord[i] = endsWord ? 1 : 0;
				entry = heldResults[i] = resultOf(i, f, match, score);
			}
			return entry;
		};

		const scoreItem = (
			i: number,
			mayRescue: boolean,
			preGated: boolean,
			literalOnly: boolean,
		): void => {
			materialise(i);
			const base = i * specCount;
			let entry: SearchResult<T, F> | undefined;
			for (let f = 0; f < specCount; f++) {
				const result = matchField(
					trimmedFields[base + f] as string,
					normalisedFields[base + f] as string,
					fieldMasks[base + f],
					prepared,
					resolvedSpecs[f].acronymTier,
					mayRescue,
					preGated,
					literalOnly,
				);
				if (result) entry = offerField(i, entry, f, result);
			}
			if (entry !== undefined && entry.score <= CONTAINS_SCORE) literalHits++;
		};

		const narrowed =
			survivorCache.survivors !== null &&
			normalisedQuery.startsWith(survivorCache.query) &&
			multiWord === survivorCache.multiWord;

		// Every field the ladder can match outright, none of the near-misses only
		// a correction reaches.
		const literalPass = (literalOnly: boolean): void => {
			if (narrowed) {
				// The gate runs out here because its verdict is what shrinks the
				// cached set for the next keystroke; `preGated` stops matchField
				// repeating it on the same string.
				const gate: Gate | null = multiWord ? prepared.presenceGate : prepared.fuzzyGate;
				const cached = survivorCache.survivors as Int32Array;
				for (let k = 0; k < survivorCache.count; k++) {
					const i = cached[k];
					const base = i * specCount;
					let admitted = gate === null;
					for (let f = 0; f < specCount && !admitted; f++) {
						admitted = gate!.test(normalisedFields[base + f] as string);
					}
					if (!admitted) continue;
					survivors[survivorCount++] = i;
					scoreItem(i, false, specCount === 1, literalOnly);
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
				for (let i = 0; i < count; i++) {
					if ((queryMask & ~masks[i]) !== 0) continue;
					survivors[survivorCount++] = i;
					scoreItem(i, false, false, literalOnly);
				}
				return;
			}
			for (let i = 0; i < count; i++) {
				const item = list[i];
				let admitted = false;
				for (let f = 0; f < specCount && !admitted; f++) {
					admitted = gate.test(resolvedSpecs[f].selector(item) || "");
				}
				if (!admitted) continue;
				survivors[survivorCount++] = i;
				scoreItem(i, false, false, literalOnly);
			}
		};

		// Restart from the whole corpus, tolerating one missing character class —
		// what a substitution typo looks like from a mask (see matchField).
		const relaxedPass = (): void => {
			const masks = (unionMasks ??= buildUnionMasks());
			const bigramGate = buildRescueBigramGate(normalisedQuery);
			forgetMatches();
			for (let i = 0; i < count; i++) {
				const missingClasses = queryMask & ~masks[i];
				if (missingClasses & (missingClasses - 1)) continue;
				if (missingClasses !== 0) {
					// Exactly one class absent: only an edit at that class's position
					// can rescue, so the query's remaining bigrams must all be present
					// (see buildRescueBigramGate).
					const b = 31 - Math.clz32(missingClasses);
					knowBigrams(i);
					if (
						(bigramGate.requiredLo[b] & ~bigramsLo[i]) |
						(bigramGate.requiredHi[b] & ~bigramsHi[i])
					) {
						continue;
					}
				}
				scoreItem(i, true, false, false);
			}
		};

		// A fallback match joins the item's results, or replaces a weaker fuzzy or
		// corrected one; a literal match is never touched.
		const offerFallbacks = (
			i: number,
			held: SearchResult<T, F> | undefined,
			reading: PreparedReading,
		): void => {
			const base = i * specCount;
			let entry = held;
			for (let f = 0; f < specCount; f++) {
				if (!reading.admitsMask(fieldMasks[base + f])) continue;
				materialise(i);
				const result = reading.match(
					trimmedFields[base + f] as string,
					normalisedFields[base + f] as string,
				);
				if (result) entry = offerField(i, entry, f, result);
			}
		};

		const secondPass = (): void => {
			const competition: Competition =
				literalHits > 0 ? "literal" : matched.length > 0 ? "fuzzy" : "none";
			const reading = readings.prepare(prepared, competition);
			if (reading === null) return;
			// A phrase's literal gates read only its words' characters; a single
			// word's read its punctuation too, which no second-pass reading needs.
			const survivorsOnly =
				!reading.wholeList &&
				(multiWord || normalisedQuery === prepared.queryWords[0]);
			// Fills every item's field masks, which the readings' gate reads.
			if (!survivorsOnly) unionMasks ??= buildUnionMasks();
			const masks = unionMasks;
			// An item's union mask and bigram set span all its fields, so it is
			// skipped only when no field's reading admits both.
			const admitsPairs = reading.admitsPairs;
			const admitsItem =
				masks === null || admitsPairs === null
					? null
					: (i: number) => {
							if (!reading.admitsMask(masks[i])) return false;
							knowBigrams(i);
							return admitsPairs(bigramsLo[i], bigramsHi[i]);
						};
			const scanned = survivorsOnly ? survivorCount : count;
			for (let k = 0; k < scanned; k++) {
				const i = survivorsOnly ? survivors[k] : k;
				const held = heldStamps[i] === generation ? heldResults[i] : undefined;
				if (held !== undefined && held.score <= CONTAINS_SCORE) continue;
				if (admitsItem !== null && !admitsItem(i)) continue;
				offerFallbacks(i, held, reading);
			}
		};

		const commitSurvivorCache = (seedNextQuery: boolean): void => {
			survivorCache.query = normalisedQuery;
			survivorCache.multiWord = multiWord;
			if (seedNextQuery) {
				survivorCache.spare = survivorCache.survivors; // the retired list becomes the next scratch buffer
				survivorCache.survivors = survivors;
				survivorCache.count = survivorCount;
			} else {
				survivorCache.survivors = null;
			}
		};

		// Fuzzy and corrected matches score above SCORES.CONTAINS, so once `limit`
		// items match literally none of them can reach the page.
		literalPass(limit !== undefined);
		if (limit !== undefined && literalHits < limit) {
			forgetMatches();
			literalHits = 0;
			for (let k = 0; k < survivorCount; k++) scoreItem(survivors[k], false, false, false);
		}
		// A correction can only matter while fewer than a page of literal hits
		// exist; below that the near-misses have to be looked at. A short query's
		// correction only stands in for a missing match (see isShortQuery).
		const rescuing =
			rescuable &&
			(isShortQuery(normalisedQuery, prepared.queryWords)
				? matched.length === 0
				: literalHits < Math.min(RESCUE_CUTOFF, limit ?? RESCUE_CUTOFF));
		// The relaxed set is not a gate-passing set, so it cannot seed the cache;
		// the next query starts from a full pass. Nor can a single character's
		// word-start set: the next keystroke may match mid-word.
		// Taken before the relaxed pass, which rescores the literal hits.
		const offeringSecondPass =
			literalHits < Math.min(RESCUE_CUTOFF, limit ?? RESCUE_CUTOFF);
		if (rescuing) relaxedPass();
		if (offeringSecondPass) secondPass();
		commitSurvivorCache(!rescuing && !singleChar);

		// Within a score, a match that ends on a word boundary ranks first ("will"
		// means "Will Smith" before "Willa"), then list order.
		const results = matched
			.sort(
				(a, b) =>
					(heldResults[a] as SearchResult<T, F>).score - (heldResults[b] as SearchResult<T, F>).score ||
					heldEndsWord[b] - heldEndsWord[a] ||
					a - b,
			)
			.map((i) => heldResults[i] as SearchResult<T, F>);
		if (limit !== undefined && results.length > limit) results.length = limit;
		return results;
	};

	// Asked for up front, the index takes every item's bigram set too, so no
	// query pays for one later.
	const buildIndex = (): void => {
		unionMasks ??= buildUnionMasks(true);
	};

	return Object.assign(search, { buildIndex });
}
