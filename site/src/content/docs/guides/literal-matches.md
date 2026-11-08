---
title: Keep only literal matches
description: Filter ekrina's results to matches of the query as typed, dropping fuzzy chains and corrected typos, by score or by tier, including on demoted fields.
sidebar:
  order: 4
---

Every match of the query as typed scores at or below `SCORES.CONTAINS`, and every fuzzy chain or corrected typo scores above it:

```ts
import { SCORES } from "ekrina";

const literal = search(query).filter(
	(result) => result.score <= SCORES.CONTAINS,
);
```

That keeps exact, prefix, word-start, multi-word, acronym and contains matches, and drops the rest.

## By tier

The tier says the same thing without a number, and lets you drop one kind and keep the other:

```ts
search(query).filter((result) => result.tier !== "fuzzy"); // keep corrections
search(query).filter((result) => result.tier !== "corrected"); // keep fuzzy chains
```

## On demoted fields

`demoteBy` shifts a field's scores, so a demoted field's literal match can score above `SCORES.CONTAINS`.
Filter those by tier, which `isLiteral` reads:

```ts
import { isLiteral } from "ekrina";

search(query).filter(isLiteral);
```

That tests the best field's match.
To keep an item when any of its named fields matched as typed, test `fields` instead: `search(query).filter((result) => Object.values(result.fields).some(isLiteral))`.

## Why there's no switch

There is no option to turn the fuzzy tier or corrections off, since a filter afterwards gives the same results.
Corrections are only tried while fewer than ten items match the query as typed, or fewer than `limit` when that is smaller, so they are skipped on a query that matches plenty.
