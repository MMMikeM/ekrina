---
title: Scores and tiers
description: What each ekrina tier means and scores, why lower is better, how corrections are priced, and how to keep only matches of the query as typed.
sidebar:
  order: 1
---

Lower is better.
Each match reports a numeric `score` (for sorting) and a categorical `tier`:

| score | tier               | meaning                                    |
| ----- | ------------------ | ------------------------------------------ |
| 0     | `exact`            | exact match                                |
| 0.1   | `normalised-exact` | case / diacritics-insensitive exact        |
| 0.5   | `prefix`           | starts with query                          |
| 0.9   | `boundary-cased`   | at a word boundary, exact case             |
| 1     | `boundary`         | at a word boundary                         |
| 1.5   | `multi-word`       | every query word starts a word, any order  |
| 1.8   | `acronym`          | word initials (opt-in via `acronym: true`) |
| 2     | `contains`         | contains query anywhere                    |
| > 2   | `fuzzy`            | fuzzy chain (fewer chunks = better)        |
| +2.1  | `corrected`        | per mistake fixed (`genric`; two add 4.2)  |

A `corrected` match scores as the corrected query's tier + 2.1 per mistake, which puts even a corrected exact hit above `contains` (2).
A word typed sparsely is a `corrected` match too, starting just above `contains` and scoring higher, so ranking lower, the more of the word it skipped: `hget` for "Huguette" scores 3.25.
A correction is a guess at what you meant, so the literal hit always ranks first.
`score <= SCORES.CONTAINS` is therefore exactly "the query text appears here", and filtering to it opts out of typo matching entirely.

Import `SCORES` for thresholds and `demoteBy` values; or read `tier` directly:

```typescript
results.filter((r) => r.score <= SCORES.CONTAINS); // drop fuzzy chains and corrections
results.filter((r) => r.fields[0]?.tier !== "fuzzy"); // drop fuzzy chains only, categorically
```

A `corrected` match carries the fixed query, so you can say what you searched for:

```typescript
const top = results[0]?.fields[0];
if (top?.tier === "corrected") notice(`Showing results for ${top.corrected}`);
```

`demoteBy` shifts `score` but never `tier`, so tier filters stay reliable on demoted fields (a body-field prefix hit can report `score: 2.5, tier: "prefix"`).
Corrected matches also score above `CONTAINS` (a corrected contains is 4.1) without being fuzzy chains, so filter by `tier` when you mean the kind of match.

## Acronyms

apostrophes are word-internal, so `People's` contributes one initial, `p`, and `lpdr` matches `Lao People's Democratic Republic`.
Stopwords count too: `Democratic Republic of the Congo` is `drotc`, and `drc` matches nothing (the density floor rejects so sparse a chain).

The acronym tier is off by default; turn it on per field with `acronym: true`, or per call with `fuzzyMatch(text, query, { acronym: true })`.
