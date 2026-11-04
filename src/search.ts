import { isBoundaryChar } from "./boundaries";
import {
	buildRawGate,
	buildRescueBigramGate,
	buildWordStartRawGate,
	charMask,
	type Gate,
} from "./gates";
import { matchField, prepareBoundedQuery } from "./match";
import { normaliseText, rawFieldScan } from "./normalise";
import { isRescuableQuery, isShortQuery } from "./rescue";
import { SCORES } from "./scores";
import { type PreparedStrategy, type Strategy, strategyOf } from "./strategy";
import type {
	FieldSpec,
	FuzzyResult,
	FuzzySearcher,
	MatchOptions,
	MatchResult,
	SearchOptions,
} from "./types";

const { MAX_SAFE_INTEGER } = Number;

// Ten because that is the slice a picker shows, and the cutoff the published
// MRR uses; a correction that cannot reach the top ten is work no caller can
// observe through the ranking (@see docs/benchmarks.md).
const RESCUE_CUTOFF = 10;

const sortByScore = <T>(a: FuzzyResult<T>, b: FuzzyResult<T>): number => a.score - b.score;

const endsOnWordBoundary = (normalisedField: string, ranges: [number, number][]): boolean => {
	const after = ranges[ranges.length - 1][1] + 1;
	return after >= normalisedField.length || isBoundaryChar(normalisedField[after]);
};

// matchField returns fresh Range tuples per call, so mutating in place is safe.
const shiftRanges = (ranges: [number, number][], lead: number): void => {
	for (const range of ranges) {
		range[0] += lead;
		range[1] += lead;
	}
};

/**
 * Score one string against a query. Returns { score, tier, ranges } or null.
 *
 * Judges the string on its own: a searcher over a list can return fewer
 * corrections than this does per item (see createFuzzySearch).
 * A query is matched on its first 256 characters, and one holding a word over
 * 64 characters is never corrected.
 */
export const fuzzyMatch = (
	text: string,
	query: string,
	options: MatchOptions = {},
): MatchResult | null => {
	const { acronym = false, fuzzier } = options;
	const q = prepareBoundedQuery(query);
	if (q === null) return null;
	const field = text.trim();
	const normalisedField = normaliseText(field);
	const fieldMask = charMask(normalisedField);

	let result = matchField(field, normalisedField, fieldMask, q, acronym);
	if (fuzzier && (result === null || result.score > SCORES.CONTAINS)) {
		const strategy = strategyOf(fuzzier).prepare(q, result !== null);
		const fallback =
			strategy?.admitsMask(fieldMask) && strategy.admitsText(field)
				? strategy.match(field, normalisedField)
				: null;
		if (fallback && (result === null || fallback.score < result.score)) result = fallback;
	}
	const lead = text.length - text.trimStart().length;
	if (result && lead) shiftRanges(result.ranges, lead);
	return result;
};

type ResolvedSpec<T> = {
	text: (item: T) => string | null;
	acronym: boolean;
	atBest: number;
	fuzzier: Strategy | null;
};

// The whole-corpus rescue index: per-item union masks and bigram sets.
type UnionIndex = { masks: Int32Array; bigramsLo: Int32Array; bigramsHi: Int32Array };

// An item's union mask and bigram set span all its fields, so it is skipped
// only when no field's reading admits both. Null when some reading reads no
// pairs, leaving every item to the per-field gates.
const itemGateOf = (
	fallbacks: (PreparedStrategy | null)[],
	{ masks, bigramsLo, bigramsHi }: UnionIndex,
): ((i: number) => boolean) | null => {
	const readings = fallbacks.filter((fallback) => fallback !== null);
	if (readings.some((reading) => reading.admitsPairs === null)) return null;
	return (i) =>
		readings.some(
			(reading) =>
				reading.admitsMask(masks[i]) && reading.admitsPairs!(bigramsLo[i], bigramsHi[i]),
		);
};

// Resolved once: the per-item loops run count × specs times and shouldn't
// re-default options or capture per-item closures.
const resolveFieldSpecs = <T>(
	extract?: ((item: T) => string | null) | FieldSpec<T>[],
): ResolvedSpec<T>[] => {
	const specs: FieldSpec<T>[] = !extract
		? [{ text: (item) => item as unknown as string }]
		: typeof extract === "function"
			? [{ text: extract }]
			: extract;
	return specs.map((spec) => ({
		text: spec.text,
		acronym: spec.acronym ?? false,
		fuzzier: spec.fuzzier ? strategyOf(spec.fuzzier) : null,
		atBest: spec.atBest ?? 0,
	}));
};

/**
 * Creates a fuzzy search function for a collection.
 *
 * Results are sorted best first; within a score, a match that ends on a word
 * boundary comes first, then list order.
 * A one-character query matches only where it starts a word: anywhere, it
 * matches most of any real collection and ranks none of it.
 * A query under five characters is corrected only when no item matches it as
 * typed, and no correction is tried once ten items match literally.
 * A field that opts in to `fuzzier` can also return a sparse match beside them.
 * A query is matched on its first 256 characters, and one holding a word over
 * 64 characters is never corrected.
 * An empty spec array is honoured as written: the searcher has no searchable
 * fields and every query returns no results.
 *
 * @example
 * // Array of strings
 * const search = createFuzzySearch(['apple', 'banana']);
 * search('ban'); // [{ item: 'banana', score: 0.5, fields: [{ score: 0.5, tier: 'prefix', ranges: [[0, 2]] }] }]
 *
 * @example
 * // Objects, one field
 * const search = createFuzzySearch(users, (u) => u.name);
 *
 * @example
 * // Opt in to fuzzier matching for a field
 * import { createFuzzySearch, fuzzier } from "ekrina";
 * const search = createFuzzySearch(names, [{ text: (n) => n, fuzzier }]);
 *
 * @example
 * // Multiple fields, per-field config (body never outranks title)
 * const search = createFuzzySearch(posts, [
 *   { text: (p) => p.title },
 *   { text: (p) => p.body, atBest: SCORES.CONTAINS },
 * ]);
 */
export function createFuzzySearch(list: string[]): FuzzySearcher<string>;
export function createFuzzySearch<T>(
	list: T[],
	getText: (item: T) => string | null,
): FuzzySearcher<T>;
export function createFuzzySearch<T>(list: T[], specs: FieldSpec<T>[]): FuzzySearcher<T>;
export function createFuzzySearch<T>(
	list: T[],
	extract?: ((item: T) => string | null) | FieldSpec<T>[],
): FuzzySearcher<T> {
	const resolvedSpecs = resolveFieldSpecs(extract);
	const hasFuzzier = resolvedSpecs.some((spec) => spec.fuzzier !== null);
	const specCount = resolvedSpecs.length;
	const count = list.length;
	// Which result each item holds in the current matches, so a fuzzier match
	// can replace a weaker one; a stamp from an earlier generation means none.
	// Float64 so the generation count never wraps.
	// oxlint-disable-next-line unicorn/no-new-array
	const heldResults: (FuzzyResult<T> | undefined)[] | null = hasFuzzier ? new Array(count) : null;
	const heldStamps = hasFuzzier ? new Float64Array(count) : null;
	const heldEndsWord = hasFuzzier ? new Uint8Array(count) : null;
	let generation = 0;
	// Where an item's best match ends follows its best field, as scoreItem sets it.
	const regroupHeld = (i: number, score: number, bestScore: number, endsWord: boolean): void => {
		const endsWords = heldEndsWord as Uint8Array;
		if (score < bestScore) endsWords[i] = endsWord ? 1 : 0;
		else if (score === bestScore && endsWord) endsWords[i] = 1;
	};

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
	let unionIndex: UnionIndex | null = null;
	const buildUnionIndex = (): UnionIndex => {
		// With one field per item (every plain string list) the per-field masks ARE
		// the union masks, so the arrays are shared rather than duplicated.
		const masks = specCount === 1 ? fieldMasks : new Int32Array(count);
		const bigramsLo = new Int32Array(count);
		const bigramsHi = new Int32Array(count);
		const bigrams = { lo: 0, hi: 0 };
		for (let i = 0; i < count; i++) {
			const item = list[i];
			let union = 0;
			bigrams.lo = 0;
			bigrams.hi = 0;
			for (let f = 0; f < specCount; f++) {
				const raw = resolvedSpecs[f].text(item) || "";
				const mask = rawFieldScan(raw, bigrams);
				fieldMasks[i * specCount + f] = mask;
				union |= mask;
			}
			masks[i] = union;
			bigramsLo[i] = bigrams.lo;
			bigramsHi[i] = bigrams.hi;
		}
		return { masks, bigramsLo, bigramsHi };
	};

	const materialise = (i: number): void => {
		const base = i * specCount;
		if (normalisedFields[base] !== undefined) return;
		const item = list[i];
		for (let f = 0; f < specCount; f++) {
			const raw = resolvedSpecs[f].text(item) || "";
			const lead = raw.length - raw.trimStart().length;
			if (lead) (leads ??= new Int32Array(count * specCount))[base + f] = lead;
			const field = raw.trim();
			trimmedFields[base + f] = field;
			const normalisedField = normaliseText(field);
			normalisedFields[base + f] = normalisedField;
			// Already filled, with strictly more bits, if the union scan ran.
			if (unionIndex === null) fieldMasks[base + f] = charMask(normalisedField);
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

	const search = (query: string, options: SearchOptions = {}): FuzzyResult<T>[] => {
		const { limit } = options;
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
		// Within a score, a match that ends on a word boundary ranks first: "will"
		// means "Will Smith" before "Willa". Kept as two lists joined ahead of the
		// stable sort, so ordering adds no work per comparison.
		let boundaryEndMatches: FuzzyResult<T>[] = [];
		let midWordMatches: FuzzyResult<T>[] = [];
		// A correction scores at least TYPO_PENALTY (2.1), so once RESCUE_CUTOFF
		// literal hits sit at or below SCORES.CONTAINS (2) no correction can reach
		// the page — the rescue becomes provably invisible work. Fuzzy hits score
		// above 2.1 too, so they cannot crowd a correction out of the count.
		let literalHits = 0;
		let fuzzierRescored = false;
		// The held items in list order, when the fuzzier pass saw every one.
		let heldInListOrder: number[] | null = null;

		// Returns whether the match ends on a word boundary. Results are fresh
		// objects per call, so the atBest shift can mutate.
		const placeFieldResult = (result: MatchResult, at: number, f: number): boolean => {
			const endsWord = endsOnWordBoundary(normalisedFields[at] as string, result.ranges);
			result.score += resolvedSpecs[f].atBest;
			if (leads !== null) {
				const lead = leads[at];
				if (lead) shiftRanges(result.ranges, lead);
			}
			return endsWord;
		};

		const record = (i: number, entry: FuzzyResult<T>, endsWord: boolean): void => {
			(endsWord ? boundaryEndMatches : midWordMatches).push(entry);
			if (heldResults !== null) {
				heldResults[i] = entry;
				(heldStamps as Float64Array)[i] = generation;
				(heldEndsWord as Uint8Array)[i] = endsWord ? 1 : 0;
			}
		};

		const forgetMatches = (): void => {
			boundaryEndMatches = [];
			midWordMatches = [];
			generation++;
		};

		const scoreItem = (
			i: number,
			mayRescue: boolean,
			preGated: boolean,
			literalOnly: boolean,
		): void => {
			materialise(i);
			const base = i * specCount;
			let bestScore = MAX_SAFE_INTEGER;
			let bestEndsWord = false;
			let fields: (MatchResult | null)[] | null = null;

			for (let f = 0; f < specCount; f++) {
				const result = matchField(
					trimmedFields[base + f] as string,
					normalisedFields[base + f] as string,
					fieldMasks[base + f],
					prepared,
					resolvedSpecs[f].acronym,
					mayRescue,
					preGated,
					literalOnly,
				);
				if (result) {
					const endsWord = placeFieldResult(result, base + f, f);
					if (result.score < bestScore) bestEndsWord = endsWord;
					else if (result.score === bestScore) bestEndsWord ||= endsWord;
					bestScore = Math.min(bestScore, result.score);
					// The literal is faster than new Array().fill(), and runs once per result.
					if (specCount === 1) fields = [result];
					// oxlint-disable-next-line unicorn/no-new-array
					else (fields ??= new Array(specCount).fill(null))[f] = result;
				}
			}

			if (fields) {
				if (bestScore <= SCORES.CONTAINS) literalHits++;
				record(i, { item: list[i], score: bestScore, fields }, bestEndsWord);
			}
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
				: unionIndex === null && !multiWord
					? buildRawGate(normalisedQuery)
					: null;
			if (gate === null) {
				// A superset of what the gate admits, so caching these survivors
				// keeps the narrowing sound.
				const { masks } = (unionIndex ??= buildUnionIndex());
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
					admitted = gate.test(resolvedSpecs[f].text(item) || "");
				}
				if (!admitted) continue;
				survivors[survivorCount++] = i;
				scoreItem(i, false, false, literalOnly);
			}
		};

		// Restart from the whole corpus, tolerating one missing character class —
		// what a substitution typo looks like from a mask (see matchField).
		const relaxedPass = (): void => {
			const { masks, bigramsLo, bigramsHi } = (unionIndex ??= buildUnionIndex());
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
		// corrected one; a literal match is never touched. Returns whether it did.
		const offerFallbacks = (
			i: number,
			held: FuzzyResult<T> | undefined,
			fallbacks: (PreparedStrategy | null)[],
		): boolean => {
			const base = i * specCount;
			let entry = held;
			let offered = false;
			for (let f = 0; f < specCount; f++) {
				const fallback = fallbacks[f];
				if (fallback === null || !fallback.admitsMask(fieldMasks[base + f])) continue;
				if (!fallback.admitsText(resolvedSpecs[f].text(list[i]) || "")) continue;
				materialise(i);
				const result = fallback.match(
					trimmedFields[base + f] as string,
					normalisedFields[base + f] as string,
				);
				if (!result) continue;
				const endsWord = placeFieldResult(result, base + f, f);
				if (entry === undefined) {
					// oxlint-disable-next-line unicorn/no-new-array
					const fields: (MatchResult | null)[] = new Array(specCount).fill(null);
					fields[f] = result;
					entry = { item: list[i], score: result.score, fields };
					record(i, entry, endsWord);
					offered = true;
				} else if (result.score < (entry.fields[f]?.score ?? MAX_SAFE_INTEGER)) {
					entry.fields[f] = result;
					regroupHeld(i, result.score, entry.score, endsWord);
					entry.score = Math.min(entry.score, result.score);
					offered = true;
				}
			}
			return offered;
		};

		// The order the two lists and the stable sort give, rebuilt for the items
		// the fuzzier pass added or rescored.
		const heldInOrder = (): FuzzyResult<T>[] => {
			const results = heldResults as FuzzyResult<T>[];
			const stamps = heldStamps as Float64Array;
			const endsWords = heldEndsWord as Uint8Array;
			let held = heldInListOrder;
			if (held === null) {
				held = [];
				for (let i = 0; i < count; i++) if (stamps[i] === generation) held.push(i);
			}
			return held
				.sort((a, b) => results[a].score - results[b].score || endsWords[b] - endsWords[a])
				.map((i) => results[i]);
		};

		const fuzzierPass = (): void => {
			const competing = boundaryEndMatches.length + midWordMatches.length > 0;
			const fallbacks = resolvedSpecs.map(
				(spec) => spec.fuzzier?.prepare(prepared, competing) ?? null,
			);
			if (fallbacks.every((fallback) => fallback === null)) return;
			const survivorsOnly = competing && normalisedQuery === prepared.queryWords[0];
			if (!survivorsOnly) unionIndex ??= buildUnionIndex();
			const admitsItem = unionIndex === null ? null : itemGateOf(fallbacks, unionIndex);
			const scanned = survivorsOnly ? survivorCount : count;
			const seen: number[] = [];
			for (let k = 0; k < scanned; k++) {
				const i = survivorsOnly ? survivors[k] : k;
				const held = (heldStamps as Float64Array)[i] === generation ? heldResults?.[i] : undefined;
				if (held !== undefined) seen.push(i);
				if (held !== undefined && held.score <= SCORES.CONTAINS) continue;
				if (admitsItem !== null && !admitsItem(i)) continue;
				if (!offerFallbacks(i, held, fallbacks)) continue;
				fuzzierRescored = true;
				if (held === undefined) seen.push(i);
			}
			// The relaxed pass matches items outside the survivors.
			if (!survivorsOnly || !rescuing) heldInListOrder = seen;
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
				? boundaryEndMatches.length + midWordMatches.length === 0
				: literalHits < Math.min(RESCUE_CUTOFF, limit ?? RESCUE_CUTOFF));
		// The relaxed set is not a gate-passing set, so it cannot seed the cache;
		// the next query starts from a full pass. Nor can a single character's
		// word-start set: the next keystroke may match mid-word.
		// Taken before the relaxed pass, which rescores the literal hits.
		const offeringFuzzier =
			hasFuzzier && literalHits < Math.min(RESCUE_CUTOFF, limit ?? RESCUE_CUTOFF);
		if (rescuing) relaxedPass();
		if (offeringFuzzier) fuzzierPass();
		commitSurvivorCache(!rescuing && !singleChar);

		const results = fuzzierRescored
			? heldInOrder()
			: boundaryEndMatches.concat(midWordMatches).sort(sortByScore);
		if (limit !== undefined && results.length > limit) results.length = limit;
		return results;
	};

	const buildIndex = (): void => {
		unionIndex ??= buildUnionIndex();
	};

	return Object.assign(search, { buildIndex });
}
