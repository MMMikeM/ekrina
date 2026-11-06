# How it compares

Ekrina answers in a few milliseconds at any realistic size.
Every library runs in a fresh process, so no cache survives from an earlier run, and the per-query time is a searcher's average once it has answered its first query.
On that measure a 24-query session over 100,000 items averages ~3–3.6 ms per query, and ~1 ms over 10,000, and `fuzzyMatch` over a 16,000-character document takes 0.48 ms.
Between the libraries, the differences are _match quality_, _what they answer that they shouldn't_, and _what you get back_.

Each library at its best-scoring configuration, native corpus at 10k items, measured November 2026 (the exact versions are the devDependencies in [`bench/package.json`](../bench/package.json)).
That configuration is chosen by these same benchmarks, so every row is the library tuned to the tests it is ranked on; uFuzzy's defaults score 0.21 and Fuse.js's 0.72 ([how each was configured](./benchmarks.md#libraries)):

<!-- bench:compare -->
| Library           |  MRR |    ms | Gzip kB | Junk | Typos     | Tiers | Ranges  | Deps |
|-------------------|-----:|------:|--------:|-----:|-----------|:-----:|:-------:|-----:|
| **Ekrina**        | 0.91 |  1.06 |     8.2 |   0% | ≤ 2 edits |  yes  |   yes   |    0 |
| fast-fuzzy        | 0.81 |  6.20 |    11.1 |  24% | any       |  no   | partial |    1 |
| Fuse.js (tuned)   | 0.76 | 12.21 |     9.6 |  47% | any       |  no   | opt-in  |    0 |
| uFuzzy (all opts) | 0.66 |  0.64 |     4.3 |   0% | ≤ 1 edit  |  no   |   yes   |    0 |
| fuzzysort         | 0.46 |  0.41 |     3.7 |   7% | none      |  no   |   yes   |    0 |
| @nozbe/microfuzz  | 0.41 |  2.10 |     1.7 |   7% | none      |  no   |   yes   |    0 |
| match-sorter      | 0.39 |  2.70 |     3.6 |   7% | none      |  yes  |   no    |    2 |
| fuzzy             | 0.30 |  2.10 |     0.8 |   7% | none      |  no   | partial |    0 |
<!-- bench:end -->

The corpora are 100,000 real Wikidata names, under their English labels and under their native ones, plus an emoji picker's labels and tags ([the corpora](./benchmarks.md#the-corpora-and-the-query-families)).
The ranking is the same on all three, with Ekrina at 0.91–0.92.

- **MRR** is the mean reciprocal rank of the first right answer: in first place it scores 1/1, in second 1/2, and so on, down to 0 below tenth place.
  It is averaged over 33 query families of ten queries each (330 different queries in total), weighted by group before anything was measured ([how](./benchmarks.md#match-quality-by-query-family)).
- **ms** is the average time of 24 different queries in one fresh process, after a single warm-up query that takes each library's one-time setup.
  The warm-up matches literally, so Ekrina builds its index during the first of the 24 that needs it, and that build time is part of the average.
- **Gzip kB** is `esbuild --bundle --minify` tree-shaken to each library's primary API and gzipped by Node's zlib, rounded to a tenth; the size badge on the README measures the whole published package instead.
- **Junk** is the share of queries with no right answer in the list that the library answers anyway.
- **Typos** is how many mistakes a query can hold and still match; _any_ means any number, scored by the library, and _none_ means a typo breaks the match.
- **Tiers** and **Ranges** say whether a result carries a match category and the characters to highlight; _partial_ is one span for fast-fuzzy and a marked-up string for fuzzy, and _opt-in_ needs a setting.

Each query is one that at most three items could answer, and any item it could have meant counts as right.
With 330 queries per corpus, a gap of a few hundredths between two libraries is not a firm result, and the gaps at the top of the table are tenths.
The full matrix, every feature cell verified against the library's current source, is in [the benchmarks](./benchmarks.md#libraries).

The chart below plots accuracy against one whole cold search, the constructor plus the first answer, which is the least flattering way to measure Ekrina, since a library with no constructor does no work up front.
On query time alone, the frontier chart in [the benchmarks](./benchmarks.md) has fuzzysort and uFuzzy (all opts) on it beside Ekrina, at 0.46 and 0.66 MRR.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./pareto-total-dark.svg">
  <img alt="Native-corpus accuracy (MRR) vs. cold one-shot time (constructor plus first answer in a fresh process, log scale) as a Pareto frontier. The frontier is fuzzy, then match-sorter, then Ekrina (indexed): Ekrina (indexed) scores 0.91 at ~6.0 ms one-shot and lazy Ekrina 0.91 at ~6.3 ms, and everything else, including fast-fuzzy at 0.81 and ~50 ms and Fuse.js (tuned) at 0.76 and ~17 ms, is dominated." src="./pareto-total-light.svg">
</picture>

Lazy Ekrina comes out slower cold than indexed Ekrina because a typo, an acronym and a query nothing matches all need the whole-list index, so the lazy searcher scans the raw text and then builds the index anyway.
On a plain prefix it is faster, at 3.2 ms against 5.1.

Ekrina is the only one of the eight that returns both a categorical `tier` and the `ranges` to highlight.
microfuzz and fuzzysort also fold diacritics, match multi-word queries and take per-field config by default, and match-sorter returns tiers without ranges.
It is built for matching in-memory lists on the client, and the cold-process numbers hold up for server-side work too.

## What to pick

Pick Ekrina, unless one of the cases below is yours.
It tops the quality scorecard on all three benchmark corpora, answers nothing it shouldn't, and runs its session several times faster than the two libraries closest to it on quality.
At <!-- bench:ekrina-size-standing -->~8.2 kB gzip it is the third-largest of the eight, and only Fuse.js, at ~9.6 kB, and fast-fuzzy, at ~11.1 kB, are larger<!-- bench:end -->.
About 1.3 kB of that is the two-edit corrections, which are also where the quality lead comes from.
Pick something else when:

- **A tight bundle budget:** @nozbe/microfuzz is ~1.7 kB, at 0.41 MRR and with no typo tolerance.
- **Query time matters more than quality:** fuzzysort answers in 0.41 ms against Ekrina's 1.06 at 10k, at 0.46 MRR, and uFuzzy (all opts) in 0.64 ms at 0.66.
- **Typos run past two edits:** Fuse.js and fast-fuzzy score any edit distance, so they can still find an item three or more edits away, while answering 47% and 24% of the queries that have no right answer.
- **Results that match only some of the query's words:** Ekrina returns an item only when every word of the query matches it, so `red car` finds nothing in a list of "Red Bike" and "Blue Car", where fast-fuzzy returns Blue Car.
  fast-fuzzy is 1.4× the bundle with ~6 ms queries; with Ekrina, search each word on its own and merge the results.

[The recommendation](./benchmarks.md#the-recommendation) has the full argument, library by library.
