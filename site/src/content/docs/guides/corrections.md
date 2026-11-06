---
title: Handle corrections
description: Show a "Showing results for" notice when ekrina corrects a typo, label corrected rows, or leave corrections out of the results altogether.
sidebar:
  order: 3
---

A corrected match has `tier: "corrected"`, and `corrected` holds the query as it was read:

```ts
const search = createSearcher(["Open File…", "Open Recent", "Close Editor"]);

const [top] = search("recnet");
top?;
// { score: 3.1, tier: "corrected", corrected: "recent", ranges: [[5, 10]] }
```

## Say what was searched for

Check the top result, since a correction only reaches the top when nothing typed matched better:

```ts
const results = search(query);
const best = results[0]?;

const notice =
	best?.tier === "corrected" ? `Showing results for ${best.corrected}` : null;
```

With several fields, read the field that set the result's score: `results[0]?.fields.find((field) => field?.score === results[0].score)`.

## Label corrected rows

Further down the list, a corrected row sits below every row that matched the query as typed.
Its `tier` is enough to mark it differently, for example in a muted colour, so it reads as a suggestion.

## Leave corrections out

Corrections and fuzzy matches both score above `SCORES.CONTAINS`, so one filter keeps only matches of the query as typed:

```ts
import { SCORES } from "ekrina";

search(query).filter((result) => result.score <= SCORES.CONTAINS);
```

To drop corrections but keep fuzzy matches, filter on the tier instead: `result?.tier !== "corrected"`.
[Keep only literal matches](/guides/literal-matches/) covers fields with `demoteBy`, where the score test no longer works.

## When it corrects

It tries a correction only while the query as typed comes up short, and for a short query only when nothing matches it at all.
[What it corrects](/how-it-works/corrections/) has every rule.
