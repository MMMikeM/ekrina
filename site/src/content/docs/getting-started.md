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
import { createFuzzySearch } from "ekrina";

const commands = [
	{ id: "file.open", title: "Open File…" },
	{ id: "file.openRecent", title: "Open Recent" },
	{ id: "settings.open", title: "Preferences: Open User Settings" },
	{ id: "editor.close", title: "Close Editor" },
];

const search = createFuzzySearch(commands, (command) => command.title);

search("open").map((result) => result.item.id);
// ["file.open", "file.openRecent", "settings.open"]
```

A list of strings needs no function: `createFuzzySearch(["apple", "banana", "cherry"])`.

Create the searcher once and keep it.
It prepares each item the first time a query matches it and reuses that work for every query after, and a keystroke that extends the last query only rescans the items the last one matched.

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

- **`tier`** says what kind of match it was: `boundary` here, for the start of a later word, `prefix` for the start of the text, `fuzzy` for letters in order, `corrected` for a typo fixed, and [a few more](/how-it-works/scores/).
- **`ranges`** are the characters that matched, as `[start, end]` pairs with both ends included, indexed into your own string.
- **`score`** sorts the results, and **lower is better**: `0` is an exact match.

Results come back sorted best first, so most code only reads `tier` and `ranges`.

## 3. Highlight the match

Slice your original string at each range, and escape every slice before it goes into HTML:

```ts
import type { HighlightRanges } from "ekrina";

const escapeHtml = (text: string): string =>
	text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

const highlight = (text: string, ranges: HighlightRanges): string => {
	let html = "";
	let cursor = 0;
	for (const [start, end] of ranges) {
		const before = escapeHtml(text.slice(cursor, start));
		html += `${before}<mark>${escapeHtml(text.slice(start, end + 1))}</mark>`;
		cursor = end + 1;
	}
	return html + escapeHtml(text.slice(cursor));
};

const [top] = search("settings");
highlight(top.item.title, top.fields[0]?.ranges ?? []);
// "Preferences: Open User <mark>Settings</mark>"
```

[Highlight matches](/guides/highlight/) does the same for React, without building HTML at all.

## 4. Say when it corrected a typo

A corrected match carries the query it fixed:

```ts
const [top] = search("recnet");
top.fields[0];
// { score: 3.1, tier: "corrected", corrected: "recent", ranges: [[5, 10]] }

if (top?.fields[0]?.tier === "corrected") {
	showNotice(`Showing results for ${top.fields[0].corrected}`);
}
```

A correction always ranks below every match of the query as typed, so it only reaches the top when nothing typed matched better.
And a query nothing in the list could mean returns `[]`.

## Next

- [Search several fields](/guides/several-fields/) weights a title above a description.
- [Search as you type](/guides/search-as-you-type/) covers `limit` and building the index ahead of time.
- [Scores and tiers](/how-it-works/scores/) lists every tier and its score.
- Coming from another library? There's a migration guide for [@nozbe/microfuzz](/guides/migrate-from-microfuzz/), [Fuse.js](/guides/migrate-from-fuse/), [match-sorter](/guides/migrate-from-match-sorter/) and [fast-fuzzy](/guides/migrate-from-fast-fuzzy/).
