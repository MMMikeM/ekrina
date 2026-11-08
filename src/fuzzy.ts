import { closesWord, isBoundaryAt, opensWord } from "./boundaries";
import { better } from "./scores";
import type { MatchResult, HighlightRange } from "./types";

type Chunk = HighlightRange;

// Equal to SCORES.CONTAINS so a chain never beats a contains, but its own
// binding: the two mean different things.
const CHUNK_BASE = 2;
const CHUNK_WHOLE_WORD = 0.2;
const CHUNK_WORD_START = 0.4;
const CHUNK_LONG = 0.8;
const CHUNK_SCATTERED = 1.6;

// Matched chars ÷ spanned chars, between the densest junk chain and the
// sparsest genuine match over long text (@see docs/benchmarks.md "Matching
// inside long text").
const DENSITY_FLOOR = 0.18;

const scoreChunks = (chunks: Chunk[], normalisedField: string): MatchResult | null => {
	let matched = 0;
	for (const [start, end] of chunks) matched += end - start + 1;
	const span = chunks[chunks.length - 1][1] - chunks[0][0] + 1;
	if (matched / span < DENSITY_FLOOR) return null;

	let score = CHUNK_BASE;
	for (const [start, end] of chunks) {
		const opens = opensWord(normalisedField, start);
		if (opens && closesWord(normalisedField, end)) score += CHUNK_WHOLE_WORD;
		else if (opens) score += CHUNK_WORD_START;
		else if (end - start + 1 >= 3) score += CHUNK_LONG;
		else score += CHUNK_SCATTERED;
	}
	return { score, tier: "fuzzy", ranges: chunks };
};

// Mid-word, a chunk must run 3+ characters; short query tails are exempt, since
// fewer than 3 remaining characters could never satisfy it.
const runsOn = (
	normalisedField: string,
	at: number,
	normalisedQuery: string,
	queryFrom: number,
): boolean => {
	const queryCharsLeft = normalisedQuery.length - queryFrom;
	const fieldCharsLeft = normalisedField.length - at;
	const minChunkLength = Math.min(3, queryCharsLeft, fieldCharsLeft);
	return normalisedField.startsWith(
		normalisedQuery.slice(queryFrom, queryFrom + minChunkLength),
		at,
	);
};

const admitsChunk = (
	normalisedField: string,
	at: number,
	normalisedQuery: string,
	queryFrom: number,
): boolean =>
	opensWord(normalisedField, at) || runsOn(normalisedField, at, normalisedQuery, queryFrom);

const nextBoundary = (normalisedField: string, from: number): number => {
	let at = from;
	while (at < normalisedField.length && !isBoundaryAt(normalisedField, at)) at++;
	return at;
};

// A later chunk is admitted like the first within the word the chain is in; in
// a later word it must open that word, or "prow" assembles across "phone with
// arrow". Every later chunk takes its leftmost admissible placement.
const chainFrom = (
	normalisedField: string,
	normalisedQuery: string,
	start: number,
): Chunk[] | null => {
	const chunks: Chunk[] = [];
	let queryAt = 0;
	let queryChar = normalisedQuery[queryAt];
	let chunkStart = start;

	while (true) {
		let chunkEnd = chunkStart;
		while (chunkEnd < normalisedField.length && normalisedField[chunkEnd] === queryChar) {
			queryAt++;
			queryChar = normalisedQuery[queryAt];
			chunkEnd++;
		}
		chunks.push([chunkStart, chunkEnd - 1]);

		if (queryAt === normalisedQuery.length) return chunks;

		// indexOf past each rejected occurrence: stepping one unit at a time makes
		// a far-away reject O(gap²).
		const wordEnd = nextBoundary(normalisedField, chunkEnd);
		let at = normalisedField.indexOf(queryChar, chunkEnd);
		while (
			at > -1 &&
			!(
				opensWord(normalisedField, at) ||
				(at <= wordEnd && runsOn(normalisedField, at, normalisedQuery, queryAt))
			)
		) {
			at = normalisedField.indexOf(queryChar, at + 1);
		}
		if (at === -1) return null;
		chunkStart = at;
	}
};

// Each extra first-chunk attempt is another chance for junk to assemble a
// dense coincidence, so this is a correctness bound, not a speed knob
// (@see docs/performance.md "Bounded chunk-start retries").
const MAX_CHUNK_STARTS = 4;

// Leftmost-only would strand the chain whenever the query's first character
// also opens an earlier word ("towls" over "Tasty Silk Towels"), so the first
// chunk retries; later chunks stay leftmost, since reconsidering those too
// leaks junk.
export const fuzzyChainMatch = (
	normalisedField: string,
	normalisedQuery: string,
): MatchResult | null => {
	const firstChar = normalisedQuery[0];
	let best: MatchResult | null = null;
	let attempts = 0;

	for (
		let start = normalisedField.indexOf(firstChar);
		start > -1;
		start = normalisedField.indexOf(firstChar, start + 1)
	) {
		if (!admitsChunk(normalisedField, start, normalisedQuery, 0)) continue;
		if (++attempts > MAX_CHUNK_STARTS) break;
		const chunks = chainFrom(normalisedField, normalisedQuery, start);
		if (chunks !== null) best = better(best, scoreChunks(chunks, normalisedField));
	}
	return best;
};
