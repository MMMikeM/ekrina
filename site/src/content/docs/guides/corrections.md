---
title: Handle corrections
description: Show a "Showing results for" notice when ekrina corrects a typo, label corrected rows, or leave corrections out of the results altogether.
sidebar:
  order: 3
---

A corrected match has `tier: "corrected"`, and `corrected` holds the query as it was read:

```ts
const search = createSearcher(["Open File…", "Open Recent", "Close Editor"]);

search("recnet")[0];
// { item: "Open Recent", score: 3.1, tier: "corrected", ranges: [[5, 10]],
//   text: "Open Recent", corrected: "recent" }
```

## Say what was searched for

Check the top result, since a correction only reaches the top when nothing typed matched better:

```ts
const results = search(query);
const best = results[0];

const notice =
	best?.tier === "corrected" ? `Showing results for ${best.corrected}` : null;
```

With named fields, `best.field` names the field the correction was read from.

## Label corrected rows

Further down the list, a corrected row sits below every row that matched the query as typed in a field without `demoteBy`.
Its `tier` is enough to mark it differently, for example in a muted colour, so it reads as a suggestion.

## Leave corrections out

Corrections and fuzzy matches both score above `SCORES.CONTAINS`, so one filter keeps only matches of the query as typed:

```ts
import { SCORES } from "ekrina";

search(query).filter((result) => result.score <= SCORES.CONTAINS);
```

To drop corrections but keep fuzzy matches, filter on the tier instead: `result.tier !== "corrected"`.
[Keep only literal matches](/guides/literal-matches/) covers fields with `demoteBy`, where the score test no longer works.

## When it corrects

It tries a correction only while the query as typed comes up short, and for most mistakes in a short query only when nothing matches it at all.
[What it corrects](/how-it-works/corrections/) has every rule.
