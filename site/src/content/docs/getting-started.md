---
title: Quickstart
description: Install ekrina, search a list of strings or objects, read how each result matched, highlight it, and tell the user when a typo was corrected.
---

Install it, build a searcher over your list once, and call it with each query.

```bash
npm install ekrina
```

It ships ESM and CommonJS with types for each, and runs on anything with ES2022: browsers, Node, Deno, Bun and edge runtimes, with no polyfills.

## 1. Search a list

Pass the list and, for objects, a function that returns the text to search:

```ts
import { createSearcher } from "ekrina";

const commands = [
	{ id: "file.open", title: "Open File…" },
	{ id: "file.openRecent", title: "Open Recent" },
	{ id: "settings.open", title: "Preferences: Open User Settings" },
	{ id: "editor.close", title: "Close Editor" },
];

const search = createSearcher(commands, (command) => command.title);

search("open").map((result) => result.item.id);
// ["file.open", "file.openRecent", "settings.open"]
```

A list of strings needs no function: `createSearcher(["apple", "banana", "cherry"])`.

Create the searcher once and keep it, since it reuses its work between queries.
When the list changes, create a new one, which takes as little time as the first ([search as you type](/guides/search-as-you-type/)).
An empty query returns `[]`.

## 2. Read how it matched

Each result holds the `item`, its `score`, and one entry in `fields` per field searched:

```ts
search("settings");
// [{
//   item: { id: "settings.open", title: "Preferences: Open User Settings" },
//   score: 1,
//   fields: [{ score: 1, tier: "boundary", ranges: [[23, 30]] }],
// }]
```

- **`tier`** says what kind of match it was: `exact` for the whole text, `prefix` for its start, `boundary` here, for the start of a later word, `fuzzy` for letters in order, `corrected` for a typo fixed, and [a few more](/how-it-works/scores/).
- **`ranges`** are the characters that matched, as `[start, end]` pairs with both ends included, indexed into your own string.
- **`score`** sorts the results, and _lower is better_, with `0` for an exact match.

Results come back sorted best first, so `tier` and `ranges` are usually all there is to read.

## 3. Highlight the match

A range includes its `end`, so the slice that highlights it stops at `end + 1`.
Slice your original string at each range, and escape every slice before it goes into HTML:

```ts
import type { HighlightRanges } from "ekrina";

const escapeHtml = (text: string): string =>
	text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

const highlight = (text: string, ranges: HighlightRanges): string => {
	let html = "";
	let cursor = 0;
	for (const [start, end] of ranges) {
		const after = end + 1;
		html += `${escapeHtml(text.slice(cursor, start))}<mark>${escapeHtml(text.slice(start, after))}</mark>`;
		cursor = after;
	}
	return html + escapeHtml(text.slice(cursor));
};

const [top] = search("settings");
if (top) {
	highlight(top.item.title, top?.ranges ?? []);
	// "Preferences: Open User <mark>Settings</mark>"
}
```

[Highlight matches](/guides/highlight/) does the same for React, without building HTML at all.

## 4. Say when it corrected a typo

A corrected match carries the query it fixed:

```ts
declare const showNotice: (message: string) => void;

const match = search("recnet")[0]?;
// { score: 3.1, tier: "corrected", corrected: "recent", ranges: [[5, 10]] }

if (match?.tier === "corrected") {
	showNotice(`Showing results for ${match.corrected}`);
}
```

A correction always comes after every match of the query as typed, so it only reaches the top when nothing matches the query as typed.
And a query that can't mean anything in the list returns `[]`.

## Next

- [Build a command palette](/tutorial/) puts all of this together, one step at a time.
- [Search several fields](/guides/several-fields/) weights a title above a description.
- [Search as you type](/guides/search-as-you-type/) covers `limit` and building the index ahead of time.
- [Scores and tiers](/how-it-works/scores/) lists every tier and its score.
- There's a migration guide for [@nozbe/microfuzz](/guides/migrate-from-microfuzz/), [Fuse.js](/guides/migrate-from-fuse/), [match-sorter](/guides/migrate-from-match-sorter/) and [fast-fuzzy](/guides/migrate-from-fast-fuzzy/).
