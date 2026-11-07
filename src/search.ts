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
import { type Competition, type PreparedReading, readingAdmits, readings } from "./readings";
import type {
	Field,
	FieldMatch,
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
		const fallback =
			reading && readingAdmits(reading, fieldMask) ? reading.match(field, normalisedField) : null;
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

const isField = (value: unknown): value is Field<never> =>
	typeof value === "function" ||
	typeof (value as FieldSpec<never> | null)?.selectField === "function";

const SPEC_KEYS = ["selectField", "acronym", "demoteBy"];

// Any other key is a typo or a 1.x name, which would otherwise be ignored.
const checkSpecKeys = (spec: object, where: string): void => {
	for (const key of Object.keys(spec)) {
		if (!SPEC_KEYS.includes(key)) {
			throw new TypeError(`${where} takes selectField, acronym and demoteBy, not ${key}`);
		}
	}
};

// Resolved once: the per-item loops run count × specs times and shouldn't
// re-default options or capture per-item closures.
const resolveField = <T>(field: Field<T>, fieldName: string | undefined): ResolvedSpec<T> => {
	if (typeof field === "function")
		return { selector: field, acronymTier: false, demotion: 0, fieldName };
	const where = fieldName === undefined ? "a field spec" : `field ${fieldName}`;
	checkSpecKeys(field, where);
	const demotion = field.demoteBy ?? 0;
	// A negative or NaN shift would carry a guess to or below SCORES.CONTAINS.
	if (!(typeof demotion === "number" && demotion >= 0 && demotion < Infinity)) {
		throw new RangeError(
			`${where}: demoteBy must be a finite number of at least 0, got ${demotion}`,
		);
	}
	return { selector: field.selectField, acronymTier: field.acronym ?? false, demotion, fieldName };
};

const resolveFieldSpecs = <T>(
	selection?: Field<T> | Record<string, Field<T>>,
): ResolvedSpec<T>[] => {
	if (!selection) selection = (item) => item as unknown as string;
	if (typeof selection === "function") return [resolveField(selection, undefined)];
	// A Map, an array or a class instance would read as an object of no fields.
	const proto = typeof selection === "object" ? Object.getPrototypeOf(selection) : undefined;
	if (proto !== Object.prototype && proto !== null) {
		throw new TypeError(
			"createSearcher takes a field, or an object of named fields such as { title: (item) => item.title }",
		);
	}
	// A selectField key makes the object one spec, so a field beside it is an
	// unknown key rather than a second field.
	if ("selectField" in selection) {
		if (!isField(selection)) throw new TypeError("a field can't be named selectField");
		return [resolveField(selection, undefined)];
	}
	return Object.entries(selection).map(([name, field]) => {
		if (integerLike.test(name)) {
			throw new TypeError(
				`a field can't be named ${name}: integer-like names sort before the others`,
			);
		}
		if (!isField(field)) {
			throw new TypeError(`field ${name} needs selectField`);
		}
		return resolveField(field, name);
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
	const bestFields = specCount > 1 ? new (specCount < 256 ? Uint8Array : Uint32Array)(count) : null;
	let matched: number[] = [];
	const forgetMatches = (): void => {
		for (const i of matched) fieldMatches.fill(undefined, i * specCount, (i + 1) * specCount);
		matched = [];
	};
	const fieldScore = (i: number, f: number): number =>
		(fieldMatches[i * specCount + f] as MatchResult).score + resolvedSpecs[f].demotion;
	// Lower score, then a match ending on a word boundary, then the field named
	// first; -1 when no field matched.
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

	// The one structure that knows something about every item, so the one that
	// needs a whole-list pass. Single-word literal gating runs against the
	// caller's own strings instead, so unless the caller asks for it up front, it
	// is built by the first multi-word query or rescue, and never for a session
	// of single words that all match literally.
	let unionMasks: Int32Array | null = null;

	const rawFieldOf = (i: number, f: number): string => resolvedSpecs[f].selector(list[i]) || "";
	// Each item's bigram set across its fields, computed the first time a gate
	// reads it: only items that already passed the mask gate ever need one. An
	// empty set reads as not yet computed, so an item without a single letter
	// pair is rescanned each time it is asked about, instead of every item
	// paying a byte for a known flag.
	let bigramsLo = new Int32Array(0);
	let bigramsHi = new Int32Array(0);
	const bigrams = { lo: 0, hi: 0 };
	const knowBigrams = (i: number): void => {
		if (bigramsLo.length === 0) {
			bigramsLo = new Int32Array(count);
			bigramsHi = new Int32Array(count);
		}
		if (bigramsLo[i] | bigramsHi[i]) return;
		bigrams.lo = 0;
		bigrams.hi = 0;
		for (let f = 0; f < specCount; f++) rawFieldScan(rawFieldOf(i, f), bigrams);
		bigramsLo[i] = bigrams.lo;
		bigramsHi[i] = bigrams.hi;
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
		forgetMatches();
		if (fieldEndsWord.length < count * specCount) {
			// oxlint-disable-next-line unicorn/no-new-array
			fieldMatches = new Array(count * specCount);
			fieldEndsWord = new Uint8Array(count * specCount);
		}
		const { normalisedQuery, queryMask } = prepared;
		const singleChar = normalisedQuery.length === 1;

		// Same predicate matchField's mask gate uses, so the two cannot drift.
		const rescuable = isRescuableQuery(normalisedQuery, prepared.queryWords);
		const multiWord = prepared.queryWords.length > 1;

		const survivors = (survivorCache.spare ??= new Int32Array(count));
		let survivorCount = 0;
		// A correction scores at least TYPO_PENALTY (2.1), so once RESCUE_CUTOFF
		// literal hits sit at or below SCORES.CONTAINS (2) no correction can reach
		// the page — the rescue becomes provably invisible work. Fuzzy hits score
		// above 2.1 too, so they cannot crowd a correction out of the count.
		let literalHits = 0;
		// Fuzzy and corrected matches score above SCORES.CONTAINS, so once a page
		// of items matches literally, no chain found after it can reach the page.
		// Only a lone field skips them: with several, `fields` reports every match.
		const pageSize = limit ?? Infinity;

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

		const offerField = (i: number, f: number, match: MatchResult): void => {
			const at = i * specCount + f;
			const endsWord = placeFieldResult(match, at);
			const best = fieldMatches[at];
			if (best !== undefined && !(match.score < best.score)) return;
			if (best === undefined && !hasMatch(i)) matched.push(i);
			fieldMatches[at] = match;
			fieldEndsWord[at] = endsWord ? 1 : 0;
		};

		const scoreItem = (i: number, mayRescue: boolean, preGated: boolean): void => {
			const literalOnly = !mayRescue && specCount === 1 && literalHits >= pageSize;
			materialise(i);
			const base = i * specCount;
			for (let f = 0; f < specCount; f++) {
				const result = matchField(
					trimmedField(i, f),
					normalisedFields[base + f] as string,
					fieldMasks[base + f],
					prepared,
					resolvedSpecs[f].acronymTier,
					mayRescue,
					preGated,
					literalOnly,
				);
				if (result) offerField(i, f, result);
			}
			if (holdsLiteral(i)) literalHits++;
		};

		const narrowed =
			survivorCache.survivors !== null &&
			normalisedQuery.startsWith(survivorCache.query) &&
			multiWord === survivorCache.multiWord;

		// Every field the ladder can match outright, none of the near-misses only
		// a correction reaches.
		const literalPass = (): void => {
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
					scoreItem(i, false, specCount === 1);
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
					scoreItem(i, false, false);
				}
				return;
			}
			for (let i = 0; i < count; i++) {
				let admitted = false;
				for (let f = 0; f < specCount && !admitted; f++) admitted = gate.test(rawFieldOf(i, f));
				if (!admitted) continue;
				survivors[survivorCount++] = i;
				scoreItem(i, false, false);
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
				scoreItem(i, true, false);
			}
		};

		// A fallback match joins the item's results, or replaces a weaker fuzzy or
		// corrected one; a literal match is never touched.
		const offerFallbacks = (i: number, reading: PreparedReading): void => {
			const base = i * specCount;
			for (let f = 0; f < specCount; f++) {
				if (!readingAdmits(reading, fieldMasks[base + f])) continue;
				materialise(i);
				const result = reading.match(trimmedField(i, f), normalisedFields[base + f] as string);
				if (result) offerField(i, f, result);
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
				!reading.wholeList && (multiWord || normalisedQuery === prepared.queryWords[0]);
			// Fills every item's field masks, which the readings' gate reads.
			if (!survivorsOnly) unionMasks ??= buildUnionMasks();
			const masks = unionMasks;
			// An item's union mask and bigram set span all its fields, so it is
			// skipped only when no field's reading admits both.
			const { needed, spare, admitsPairs } = reading;
			const scanned = survivorsOnly ? survivorCount : count;
			for (let k = 0; k < scanned; k++) {
				const i = survivorsOnly ? survivors[k] : k;
				if (masks !== null) {
					const missing = needed & ~masks[i];
					if (missing !== 0 && (spare === 0 || !readingAdmits(reading, masks[i]))) continue;
					if (admitsPairs !== null) {
						knowBigrams(i);
						if (!admitsPairs(bigramsLo[i], bigramsHi[i])) continue;
					}
				}
				if (holdsLiteral(i)) continue;
				offerFallbacks(i, reading);
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

		literalPass();
		// A correction can only matter while fewer than a page of literal hits
		// exist; below that the near-misses have to be looked at. A short query's
		// correction only stands in for a missing match (see isShortQuery).
		// Taken before the relaxed pass, which rescores the literal hits.
		const offeringSecondPass = literalHits < Math.min(RESCUE_CUTOFF, limit ?? RESCUE_CUTOFF);
		const shortQuery = isShortQuery(normalisedQuery, prepared.queryWords);
		const rescuingFirst = rescuable && !shortQuery && offeringSecondPass;
		// The relaxed set is not a gate-passing set, so it cannot seed the cache;
		// the next query starts from a full pass. Nor can a single character's
		// word-start set: the next keystroke may match mid-word.
		if (rescuingFirst) relaxedPass();
		if (offeringSecondPass) secondPass();
		// A short query's substitution is the last resort: a swap or a sparse word
		// the second pass read is likelier what was meant ("tahn" is "than", not "taha").
		const rescuingLast = rescuable && shortQuery && matched.length === 0;
		if (rescuingLast) relaxedPass();
		commitSurvivorCache(!rescuingFirst && !rescuingLast && !singleChar);

		// Within a score, a match that ends on a word boundary ranks first ("will"
		// means "Will Smith" before "Willa"), then list order.
		if (bestFields !== null) for (const i of matched) bestFields[i] = bestFieldOf(i);
		matched.sort((a, b) => {
			const fa = sortedField(a);
			const fb = sortedField(b);
			return (
				fieldScore(a, fa) - fieldScore(b, fb) ||
				fieldEndsWord[b * specCount + fb] - fieldEndsWord[a * specCount + fa] ||
				a - b
			);
		});
		return matched.slice(0, limit).map(resultOf);
	};

	const fieldMatchOf = (i: number, f: number, match: MatchResult): FieldMatch => {
		const entry: FieldMatch = { tier: match.tier, ranges: match.ranges, text: rawFieldOf(i, f) };
		if (match.corrected !== undefined) entry.corrected = match.corrected;
		return entry;
	};

	// Callers can see key order, so it stays item, score, tier, ranges, text, field,
	// corrected, fields.
	const resultOf = (i: number): SearchResult<T, F> => {
		const f = sortedField(i);
		const match = fieldMatches[i * specCount + f] as MatchResult;
		const { tier, ranges, text, corrected } = fieldMatchOf(i, f, match);
		const result: SearchResult<T> & { field?: string; fields?: Record<string, FieldMatch> } = {
			item: list[i],
			score: fieldScore(i, f),
			tier,
			ranges,
			text,
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
