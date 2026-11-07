import { createSearcher, type SearchResult, SCORES } from "../../../src/index.ts";

export type Emoji = { glyph: string; label: string; tags: string | null };
export type EmojiSearch = (query: string) => SearchResult<Emoji, "label" | "tags">[];

export const DEMO_LIMIT = 8;
const TAGS_SEPARATOR = " — ";

/** The demo's searcher, shared by the page's build and the browser so both answer alike. */
export const emojiSearch = (corpus: string[], glyphs: string[]): EmojiSearch => {
	const items = corpus.map((item, i): Emoji => {
		const at = item.indexOf(TAGS_SEPARATOR);
		return {
			glyph: glyphs[i]!,
			label: at < 0 ? item : item.slice(0, at),
			tags: at < 0 ? null : item.slice(at + TAGS_SEPARATOR.length),
		};
	});
	// A tag hit ranks level with a contains in a name, so a name that starts with the query comes first.
	const search = createSearcher(items, {
		label: (emoji) => emoji.label,
		tags: { selectField: (emoji) => emoji.tags, demoteBy: SCORES.CONTAINS },
	});
	search.buildIndex();
	return (query) => search(query, { limit: DEMO_LIMIT });
};
