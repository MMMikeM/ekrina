---
title: Rules for AI coding agents
description: The rules a coding agent needs to write correct ekrina code, shipped inside the package as dist/AGENTS.md to paste into your own AGENTS.md.
sidebar:
  label: For AI coding agents
---

From 2.0.0, every release ships the rules below inside the package, at `node_modules/ekrina/dist/AGENTS.md`, after a list of what the package exports.
The file wraps them in `<!-- ekrina START -->` and `<!-- ekrina END -->` markers, so you can paste it into your project's own `AGENTS.md` and replace everything between them when you upgrade.

## Rules

- **Import the named export, and pass a function, not an options object.**

  ```ts
  // ✗
  import createSearcher from "ekrina";
  createSearcher(items, { getText: (item) => [item.title] });

  // ✓
  import { createSearcher } from "ekrina";
  createSearcher(items, (item) => item.title);
  ```

  There is no default export, in ESM or CJS, and an options object throws a `TypeError`.
- **Several fields take an array of field specs.**
  `[{ selectField: (item) => item.title }, { selectField: (item) => item.body, demoteBy: SCORES.CONTAINS }]` searches both, ranking body matches below title ones.
  There is no `key`, `keys` or `strategy` option.
- **The 1.x names throw.**
  A field spec's function is `selectField` and its demotion is `demoteBy`; the 1.x names `text` and `atBest` throw a `TypeError` that names the replacement.
- **Create the searcher once and reuse it, not once per keystroke.**
  It caches each item's preparation the first time a query matches it, and a query that extends the previous one rescans only the previous one's survivors.
  Rebuild it when the list changes: an item it has already prepared keeps its old text, and an item pushed onto the array afterwards is never searched.
  In React, `useMemo(() => createSearcher(list, selectField), [list])` is the whole integration, as long as `list` keeps its identity between renders.
  A list rebuilt on every render, such as the result of a `.filter()`, rebuilds the searcher on every keystroke too, so memoise the list as well.
  See [search as you type](/guides/search-as-you-type/).
- **Lower score is better, and results come sorted best first.**
  There is nothing to re-sort, and any score comparison belongs on the `SCORES` constants rather than on literal numbers.
- **Filter literal matches by `tier`.**
  A field matched the query as typed when its `tier` is anything but `"fuzzy"` or `"corrected"`: the query itself, each of its words in any order, or, with `acronym`, its word initials, ignoring case and diacritics (`fuzzyMatch("CAFÉ", "cafe")` is `normalised-exact` at 0.1).

  ```ts
  import type { MatchResult } from "ekrina";

  const isLiteral = (field: MatchResult | null) =>
  	field !== null && field.tier !== "fuzzy" && field.tier !== "corrected";

  search(query).filter((result) => result.fields.some(isLiteral));
  ```

  With no `demoteBy`, that keeps exactly the results with `score <= SCORES.CONTAINS`.
  `demoteBy` adds to every score its field produces and never changes `tier`, so a demoted prefix hit reports `score: 2.5, tier: "prefix"`, which the score filter drops and the `tier` filter keeps.
  See [scores and tiers](/how-it-works/scores/), [literal matches only](/guides/literal-matches/) and [searching several fields](/guides/several-fields/).
- **`fields[i]` lines up with the field specs, and is `null` where that field didn't match.**
  A list of strings or a single `selectField` function has one field, read as `fields[0]`.
  An item's `score` is its best field's, so read `fields[i]?.tier` and `fields[i]?.ranges` per field rather than assuming the first one matched.
- **`ranges` are inclusive `[start, end]` pairs into your own string.**
  They index the string `selectField` returned, not a normalised copy, so `text.slice(start, end + 1)` is the matched text, accents, casing and leading whitespace included.
  Escape each slice, and the text between them, before building HTML, since the text is whatever your list holds.
  See [highlighting matches](/guides/highlight/).
- **Every query word must match.**
  `"apple zebra"` matches nothing in `["apple pie", "zebra crossing"]`, though the words can match in any order (`"user open"` finds "Preferences: Open User Settings").
  For an OR search, split the query into words, search each, and merge the results.
- **A `corrected` match carries the fixed query in `corrected`.**
  `tier: "corrected"` means the query needed fixing, not the field, and `corrected` is the query as it was read: `"recnet"` against "Open Recent" gives `corrected: "recent"`.
  Use it for a "Showing results for …" notice from the top result.
  Every correction scores above `SCORES.CONTAINS`, a fixed mistake adding `TYPO_PENALTY` (2.1) to the tier the fixed query reached, so within a field a literal match always ranks above a corrected one, and across fields only `demoteBy` can reverse that.
  See [showing corrections](/guides/corrections/) and [every correction rule](/how-it-works/corrections/).
- **Pass `{ limit }` rather than slicing the results.**
  `search(query, { limit: 10 })` returns the same results as `search(query).slice(0, 10)`, but once ten items match the query as typed it never computes the fuzzy and corrected matches that could not outrank them.
  `limit` must be a positive integer, or the search throws a `RangeError`.
- **`fuzzyMatch` judges one string alone, so a list can return fewer corrections than `fuzzyMatch` does item by item.**
  A searcher corrects a query under five characters only when no item matches it as typed, and tries no corrections once ten items match literally.
  `createSearcher(["form", "from", "farm", "firm"])("form")` returns only "form", where `fuzzyMatch` corrects each of the other three.
  Use a searcher for a list, and `fuzzyMatch` for one string, such as finding a phrase in a document.
  See [matching inside long text](/guides/long-text/).
- **The only options are `acronym`, `limit` and a field's `demoteBy`.**
  No threshold, distance, weight or strategy option exists.
  `acronym: true`, on `fuzzyMatch` or on a field spec, adds the word-initials tier (`tfts` finds "Two for the Seesaw"), `limit` caps one search, and a field spec's `demoteBy` ranks one field below the others.
  To drop fuzzy and corrected matches, filter the results by `tier`.
  See [the API reference](/reference/).
- **It needs ES2022 and nothing else.**
  There are no `node:` imports, no DOM and nothing to polyfill, so it runs in browsers, Node 18+, Deno, Bun and edge runtimes, as ESM or CJS, with types for each.

## The rest of the docs

Every page is also Markdown.
[llms.txt](https://ekrina.thelazyweb.dev/llms.txt) lists them, and a page's URL with `.md` in place of its trailing slash is its Markdown copy, such as [getting started](/getting-started/) or the [API reference](/reference/).
