// Word-level helpers every query generator shares. Kept apart from corpus.ts,
// which builds its sampled families from catalogue.ts at load, so neither
// module imports the other.

export const wordsOf = (s: string): string[] => s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
export const stripAccents = (s: string): string => s.normalize("NFD").replace(/\p{M}+/gu, "");

// A query dozens of items could answer is scored by whether a library matches
// at all, not by how it ranks, so only near-unique intents are sampled.
const MAX_RELEVANT_ITEMS = 3;

// Relevance is judged on the bench's own folding, never the library under test's.
const fold = (s: string): string => stripAccents(s).toLowerCase();
const foldedWordsCache = new Map<string, string[]>();
/** Drops the folded words cached for items no longer scored, such as a padded copy of the list. */
export const forgetFoldedWords = (): void => foldedWordsCache.clear();

export const foldedWords = (item: string): string[] => {
	let words = foldedWordsCache.get(item);
	if (words === undefined) foldedWordsCache.set(item, (words = wordsOf(fold(item))));
	return words;
};
export const holdsWords =
	(...wanted: string[]) =>
	(item: string): boolean => {
		const words = foldedWords(item);
		return wanted.every((w) => words.includes(fold(w)));
	};
export const holdsWordWhere =
	(test: (word: string) => boolean, ...alsoHolds: string[]) =>
	(item: string): boolean =>
		foldedWords(item).some(test) && holdsWords(...alsoHolds)(item);

// A fixed shuffle of the list, so sources come from every position rather
// than the head, where a list-order tie-break would favour them.
export const shuffledIndices = (n: number, seed: number): number[] => {
	const order = Array.from({ length: n }, (_, i) => i);
	let state = seed;
	for (let i = n - 1; i > 0; i--) {
		state = (state * 1103515245 + 12345) & 0x7fffffff;
		const j = state % (i + 1);
		[order[i], order[j]] = [order[j], order[i]];
	}
	return order;
};

export const answeredByFew = (items: string[], relevant: (item: string) => boolean): boolean => {
	let found = 0;
	for (const item of items) if (relevant(item) && ++found > MAX_RELEVANT_ITEMS) return false;
	return true;
};
