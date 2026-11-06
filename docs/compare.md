# How it compares

Ekrina answers in a few milliseconds at any realistic size: a 24-query session over 100,000 items averages ~3–3.6 ms per query after the first (~1 ms at 10k), every number measured in a fresh, cold process, and `fuzzyMatch` over a 16,000-character document takes 0.48 ms.
Between the libraries, the differences are _match quality_, _what they answer that they shouldn't_, and _what you get back_.

Each library at its best-scoring configuration, native corpus at 10k items, measured November 2026 (the exact versions are the devDependencies in [`bench/package.json`](../bench/package.json)).
That configuration is chosen by these same benchmarks, so every row is the library tuned to the tests it is ranked on; uFuzzy's defaults score 0.21 and Fuse.js's 0.72 ([how each was configured](./benchmarks.md#libraries)):

<!-- bench:compare -->
| Library           |    Gzip | Deps |  MRR | junk | ms/query | Tiers | Ranges | Typos     |
|-------------------|--------:|-----:|-----:|-----:|---------:|:-----:|:------:|-----------|
| **Ekrina**        | ~7.7 kB |    0 | 0.91 | 0.00 |     1.06 |  🟢   |   🟢   | two edits |
| fast-fuzzy        |  ~11 kB |    1 | 0.81 | 0.24 |     6.20 |  🔴   |   🟡   | full      |
| Fuse.js (tuned)   | ~9.6 kB |    0 | 0.76 | 0.47 |    12.21 |  🔴   |   🟡   | full      |
| uFuzzy (all opts) | ~4.2 kB |    0 | 0.66 | 0.00 |     0.64 |  🔴   |   🟢   | one edit  |
| fuzzysort         | ~3.7 kB |    0 | 0.46 | 0.07 |     0.41 |  🔴   |   🟢   | 🔴        |
| @nozbe/microfuzz  | ~1.7 kB |    0 | 0.41 | 0.07 |     2.10 |  🔴   |   🟢   | 🔴        |
| match-sorter      | ~3.5 kB |    2 | 0.39 | 0.07 |     2.70 |  🟢   |   🔴   | 🔴        |
| fuzzy             | ~0.8 kB |    0 | 0.30 | 0.07 |     2.10 |  🔴   |   🟡   | 🔴        |
<!-- bench:end -->

The corpora are 100,000 real Wikidata names, under their English labels and under their native ones, plus an emoji picker's labels and tags, and the ranking is the same on all three ([the corpora](./benchmarks.md#the-corpora-and-the-query-families)).
**MRR** is the mean reciprocal rank of the first right answer over 33 query families of ten sampled queries each (typos, phonetic and real misspellings, partial words, query shapes and noise, weighted by group before anything was measured), each query one that at most three items could answer, top-10 cutoff; any item the query could have meant counts ([how](./benchmarks.md#match-quality-by-query-family)).
**junk** is the share of queries with no right answer anywhere in the list that the library answers anyway.
**ms/query** is how long one query takes once the searcher has answered twenty-three real ones, the search-as-you-type number.
Gzip is `esbuild --bundle --minify` tree-shaken to each library's primary API.
The size badge on the README measures the whole published package rather than the primary API.
The full matrix, every feature cell verified against the library's current source, is in [the benchmarks](./benchmarks.md#libraries).

Accuracy against one whole cold search (index + one query) is the least flattering way to measure Ekrina, since a library with no constructor does no work up front (the frontend chart in [the benchmarks](./benchmarks.md), query time only, has fuzzysort and uFuzzy (all opts) beside Ekrina on its frontier, at 0.46 and 0.66 MRR):

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./pareto-total-dark.svg">
  <img alt="Native-corpus accuracy (MRR) vs. cold one-shot time (constructor plus first answer in a fresh process, log scale) as a Pareto frontier. The frontier is fuzzy, then match-sorter, then Ekrina (indexed): Ekrina (indexed) scores 0.91 at ~6.0 ms one-shot and lazy Ekrina 0.91 at ~6.3 ms, and everything else, including fast-fuzzy at 0.81 and ~50 ms and Fuse.js (tuned) at 0.76 and ~17 ms, is dominated." src="./pareto-total-light.svg">
</picture>

Ekrina is the only library that by default:

- returns a categorical `tier` _and_ numeric `ranges`
- folds diacritics
- matches multi-word
- takes per-field config

It is built for matching in-memory lists on the client, and the cold-process numbers hold up for serverside work too.

## What to pick

Pick Ekrina.
It tops the quality scorecard on all three benchmark corpora, answers nothing it shouldn't, and runs its session several times faster than the two libraries closest to it on quality.
At ~7.7 kB gzip it is the third-largest of the eight, and only Fuse.js, at ~9.6 kB, and fast-fuzzy, at ~11 kB, are larger.
That size goes on the correction machinery, which is also where the quality lead comes from (the unfold table is generated from the fold logic at first use, not shipped).
The exception:

- **A query word the item lacks must still match** (an OR-style search): Ekrina requires every word, so pick `fast-fuzzy` there, at 1.2× the bundle and ~6 ms queries, or split the query yourself.

The rest of the field is dominated on these benchmarks; the full argument, per-library, is in [the recommendation](./benchmarks.md#the-recommendation).
