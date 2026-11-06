---
title: Migrate from Fuse.js
description: "Migrate from Fuse.js to ekrina: the constructor and result diff, how each option maps or why it has none, and what behaves differently."
sidebar:
  order: 21
---

Both build a searcher once over a list and return each `item` with a `score` where lower is better and `[start, end]` ranges, which Fuse adds when asked, so most code changes in the constructor and where it reads the ranges.

```diff
- import Fuse from "fuse.js";
+ import { createFuzzySearch, SCORES } from "ekrina";

  // one key
- const fuse = new Fuse(items, { keys: ["title"], includeMatches: true });
- const results = fuse.search(query);
+ const search = createFuzzySearch(items, (item) => item.title);
+ const results = search(query);

  // several keys, the body weighted below the title
- const fuse = new Fuse(items, {
-   keys: [{ name: "title", weight: 2 }, "body"],
- });
+ const search = createFuzzySearch(items, [
+   { selectField: (item) => item.title },
+   { selectField: (item) => item.body, demoteBy: SCORES.CONTAINS },
+ ]);

  // nested and array keys
- keys: ["author.name", "tags"]
+ [
+   { selectField: (item) => item.author.name },
+   { selectField: (item) => item.tags.join(" ") },
+ ]

  // reading a result
- for (const { item, matches } of fuse.search(query, { limit: 10 }))
-   highlight(item.title, matches?.[0]?.indices);
+ for (const { item, fields } of search(query, { limit: 10 }))
+   highlight(item.title, fields[0]?.ranges);
```

Behavioural differences:

- **`matches` becomes `fields`.**
  Fuse returns `matches` only with `includeMatches: true`, one entry per key that matched, with the ranges at `indices`.
  Ekrina always returns `fields`, one entry per field spec in the order you gave them, `null` where that field didn't match, with the ranges at `fields[i].ranges` beside that field's own `score` and `tier`.
  Both use `[start, end]` inclusive, so a highlight helper keeps working: `recent` in "Open Recent" is `[[5, 10]]` in both.
- **Lower is still better, on a different scale.**
  Fuse's `score` runs from 0, a perfect match, to 1, and appears only with `includeScore: true`.
  Ekrina's is always there and counts up a ladder of tiers, with every match of the text as typed at or below `SCORES.CONTAINS` (2) ([Scores and tiers](/how-it-works/scores/)).
  A cut-off on Fuse's score becomes a cut-off on `tier` or on `SCORES`.
- **There is no `threshold`, `location`, `distance` or `ignoreLocation`.**
  Ekrina has one ranking and no knobs.
  It orders by score, then a match that ends on a word boundary, then list order.
  Where a low `threshold` was there to drop loose matches, `results.filter((r) => r.score <= SCORES.CONTAINS)` keeps only matches of the text as typed.
- **Fewer loose matches.**
  Over "Café menu", "Open Recent" and "Toggle Terminal", Fuse's defaults answer `menu` with all three, and Ekrina with "Café menu" alone.
  The junk column on [the Fuse.js page](/libraries/fuse/#scorecard) measures this over the bench's corpora.
- **No extended search.**
  The `useExtendedSearch` operators (`=`, `'`, `^`, `$`, `!` and `|`) have no equivalent.
  A space between words always means every word must match, in any order.
- **A key's weight becomes a demotion.**
  Fuse's `weight` raises a key; Ekrina's `demoteBy` is added to every score a field produces, so it lowers one.
  With `demoteBy: SCORES.CONTAINS`, the body's best hit ranks level with a title that contains the query.
- **No `add`, `remove` or `setCollection`.**
  A searcher is built over one list, so when the list changes, create a new one.
  The constructor does no work up front, so a new searcher takes little time to create, and the work starts on its first query ([build time](/benchmarks/#build-time)).
- **No `isCaseSensitive`, `ignoreDiacritics` or `shouldSort`.**
  Ekrina always ignores case, folds accents, and sorts best first.

