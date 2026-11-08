---
title: Upgrade from ekrina 1.x
description: "Upgrade from ekrina 1.x to 2: every renamed export, the object of named fields that replaces the array of specs, and what a result holds now."
sidebar:
  order: 19
---

These docs describe ekrina 2.
1.x has no docs beyond [its README](https://github.com/MMMikeM/ekrina/blob/v1.1.2/README.md), so this page lists everything 2 changed, and [the CHANGELOG](https://github.com/MMMikeM/ekrina/blob/main/CHANGELOG.md) says why.

```diff
- import { createFuzzySearch, SCORES, type FuzzyResult, type Range } from "ekrina";
+ import { createSearcher, SCORES, type SearchResult, type HighlightRange } from "ekrina";

  // one field
- const search = createFuzzySearch(users, (user) => user.name);
+ const search = createSearcher(users, (user) => user.name);

  // several fields: an object of named fields replaces the array of specs
- const search = createFuzzySearch(posts, [
-   { text: (post) => post.title },
-   { text: (post) => post.body, atBest: SCORES.CONTAINS },
- ]);
+ const search = createSearcher(posts, {
+   title: (post) => post.title,
+   body: { selectField: (post) => post.body, demoteBy: SCORES.CONTAINS },
+ });

  // reading a result
- for (const { item, fields } of search(query))
-   highlight(item.title, fields[0]?.ranges ?? []);
+ for (const { text, ranges } of search(query))
+   highlight(text, ranges);
```

## Renamed

| 1.x | 2 |
| --- | --- |
| `createFuzzySearch` | `createSearcher` |
| `FuzzySearcher`, `FuzzyResult` | `Searcher`, `SearchResult` |
| `Range` | `HighlightRange` (`HighlightRanges` keeps its name) |
| a field spec's `text` | `selectField` |
| a field spec's `atBest` | `demoteBy`, the same number with the same effect |
| the `boundary-exact` tier, `SCORES.BOUNDARY_EXACT` | `boundary-cased`, `SCORES.BOUNDARY_CASED`, still 0.9 |

`fuzzyMatch`, `normaliseText`, `splitWords`, `limit`, `buildIndex`, every score value and `TYPO_PENALTY` are unchanged.

## What a result holds

A 1.x result was `{ item, score, fields }`, with one entry per field in the order you passed them and `null` for a field that didn't match, so finding how it matched meant finding the field that set the score.
A result is now the best field's match, `{ item, score, tier, ranges, text, corrected? }`, and `text` is the string `ranges` index into.
With named fields it also has `field`, the name of that field, and `fields`, every field that matched, keyed by name; [Search several fields](/guides/several-fields/) has the details.

## What fails loudly

A spec still written the 1.x way throws when the searcher is created, rather than being ignored: a `text` or `atBest` key, a misspelt option and an array of specs each throw a `TypeError`, and a negative or non-number `demoteBy` throws a `RangeError`.
So a missed rename shows up the first time the code runs.

## What behaves differently

Corrections reach further: two mistakes in a long word, a space typed inside a word or left out, a word typed sparsely and a key held down are all read now, so the same query can return more `corrected` rows than 1.x did.
Every correction still scores above `SCORES.CONTAINS`, so filtering with [`isLiteral`](/guides/literal-matches/) keeps exactly the matches of the query as typed.
[Correction rules](/how-it-works/corrections/) lists them in full.
