---
title: Migrate from @nozbe/microfuzz
description: "Migrate from @nozbe/microfuzz to ekrina: the constructor and result diff, how each option maps or why it has none, and what behaves differently."
sidebar:
  order: 20
---

```diff
- import createFuzzySearch from "@nozbe/microfuzz";
+ import { createFuzzySearch } from "ekrina";

  // one field
- const search = createFuzzySearch(items, { key: "title" });
+ const search = createFuzzySearch(items, (item) => item.title);

  // several fields
- const search = createFuzzySearch(items, { getText: (i) => [i.title, i.body] });
+ const search = createFuzzySearch(items, [
+   { selectField: (i) => i.title },
+   { selectField: (i) => i.body },
+ ]);

  // reading a result
- for (const { item, matches } of search(query))
-   highlight(item.title, matches[0]);
+ for (const { item, fields } of search(query))
+   highlight(item.title, fields[0]?.ranges);
```

Behavioural differences:

- **`matches` became `fields`, and carries more than ranges.**
  microfuzz returns `Array<HighlightRanges | null>`, one entry per `getText` string.
  Ekrina returns `Array<MatchResult | null>`, with the ranges at `fields[i].ranges` next to that field's own `score` and `tier`.
  The `[start, end]` inclusive convention is unchanged, so an existing highlight helper keeps working once it reads `.ranges`.
- **The scores are an API contract here.**
  microfuzz documents its values as "not an API contract, can change between releases"; the shared tiers happen to agree today.
  Ekrina exports them as `SCORES`, pins them in `test/tier-constants.test.ts`, and treats a changed score as a breaking change with a CHANGELOG entry.
- **There is no `strategy` option.**
  `'smart'` is the always-on behaviour.
  `'off'` becomes `results.filter((r) => r.score <= SCORES.CONTAINS)`, which is exactly "the query text appears here".
  `'aggressive'` has no equivalent on purpose, because the density floor that refuses scattered chains is what holds the long-text junk rate to 2–4%.
- **Typos match.**
  On the same queries microfuzz scores 0.40–0.47 MRR and Ekrina 0.91–0.92 ([the scorecard](/benchmarks/#scorecard)).
- **`normalizeText` is `normaliseText`.**
  EU spelling across the public surface, `splitWords` and `normaliseText` included.
- **No React hook.**
  microfuzz ships `useFuzzySearchList`; Ekrina doesn't, because the searcher is already the memo boundary.
  `useMemo(() => createFuzzySearch(list, selectField), [list])` gives you the same caching, and the list of results is a second `useMemo` on the query.

Ekrina is ~7.9 kB gzip against microfuzz's ~1.7 kB, and adds an ESM build to microfuzz's CJS-only one.
