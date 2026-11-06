---
title: Migrate from fast-fuzzy
description: "Migrate from fast-fuzzy to ekrina: the constructor and result diff, how each option maps or why it has none, and what behaves differently."
sidebar:
  order: 23
---

Both build a searcher once over a list and take a function that picks each item's text, so the constructor carries over as it is.
fast-fuzzy returns the items, and Ekrina returns `{ item, score, fields }`.

```diff
- import { Searcher } from "fast-fuzzy";
+ import { createFuzzySearch } from "ekrina";

- const searcher = new Searcher(items, { keySelector: (item) => item.title });
- const results = searcher.search(query);
+ const search = createFuzzySearch(items, (item) => item.title);
+ const results = search(query).map((r) => r.item);

  // several keys
- new Searcher(items, { keySelector: (item) => [item.title, item.body] });
+ createFuzzySearch(items, [
+   { selectField: (item) => item.title },
+   { selectField: (item) => item.body },
+ ]);

  // match data
- const searcher = new Searcher(items, {
-   keySelector: (item) => item.title,
-   returnMatchData: true,
- });
- for (const { item, match } of searcher.search(query))
-   highlight(item.title, [[match.index, match.index + match.length - 1]]);
+ for (const { item, fields } of search(query))
+   highlight(item.title, fields[0]?.ranges);
```

Behavioural differences:

- **Lower scores are better.**
  fast-fuzzy scores 1 for a perfect match; Ekrina scores 0, and every match of the text as typed is at or below `SCORES.CONTAINS` (2) ([Scores and tiers](/how-it-works/scores/)).
  There is no `threshold`, so filter on `score` or `tier` instead.
- **One span becomes a list of ranges.**
  fast-fuzzy's `match` is the single stretch of the text closest to the query, which can hold letters the query doesn't: `oen` on "Open Recent" is `{ index: 1, length: 3 }`, the "pen".
  Ekrina returns the letters that matched, one range per piece: `[[0, 0], [2, 3]]`.
- **Fewer loose matches.**
  Over "Café menu", "Open Recent" and "Toggle Terminal", fast-fuzzy answers `oen` with "Open Recent" and "Café menu", and Ekrina with "Open Recent" alone.
  The junk column on [the fast-fuzzy page](/libraries/fast-fuzzy/#scorecard) measures this over the bench's corpora.
- **Words match in any order.**
  `code visual` finds nothing in fast-fuzzy; Ekrina finds "Visual Studio Code".
- **Corrections say what they fixed.**
  Both find "Toggle Terminal" for `termimal`; Ekrina reports it as `tier: "corrected"`, with `corrected: "terminal"`, so a caller can show what was searched for or leave corrections out.
- **No matching options.**
  `ignoreCase`, `ignoreSymbols`, `normalizeWhitespace`, `useDamerau` and `useSellers` have no equivalents.
  Ekrina always ignores case, folds accents, and treats punctuation as a break between words.
  There is no `sortBy` either; results always come best first.
- **No `add`.**
  When the list changes, create a new searcher.
  The constructor does no work up front, so a new searcher takes little time to create, and the work starts on its first query ([build time](/benchmarks/#build-time)).
- **No one-shot `search(query, items)`.**
  `createFuzzySearch(items, selectField)(query)` does the same, and `fuzzyMatch(text, query)` scores a single string.
