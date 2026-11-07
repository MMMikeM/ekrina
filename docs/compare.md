# How it compares

Ekrina answers in a few milliseconds at any realistic size.
Every library runs in a fresh process, so no cache survives from an earlier run, and the per-query time is a searcher's average once it has answered its first query.
On that measure a 24-query session over 100,000 items averages ~1.8–2.2 ms per query, and ~0.3–0.4 ms over 10,000, and `fuzzyMatch` over a 16,000-character document takes 0.42 ms.
Between the libraries, the differences are _match quality_, _what they answer that they shouldn't_, and _what you get back_.

Each library at its best-scoring configuration, native corpus at 10k items, measured November 2026 (the exact versions are the devDependencies in [`bench/package.json`](../bench/package.json)).
That configuration is chosen by these same benchmarks, so every row is the library tuned to the tests it is ranked on; uFuzzy's defaults score 0.21 and Fuse.js's 0.72 ([how each was configured](./benchmarks.md#libraries)):

<!-- bench:compare -->
| Library           |  MRR |    ms | Gzip kB | Junk | Typos     | Tiers | Ranges  | Deps |
|-------------------|-----:|------:|--------:|-----:|-----------|:-----:|:-------:|-----:|
| **Ekrina**        | 0.91 |  0.36 |     8.3 |   0% | ≤ 2 edits |  yes  |   yes   |    0 |
| fast-fuzzy        | 0.81 |  4.72 |    11.1 |  24% | any       |  no   | partial |    1 |
| Fuse.js (tuned)   | 0.76 | 10.78 |     9.6 |  47% | any       |  no   | opt-in  |    0 |
| uFuzzy (all opts) | 0.66 |  0.59 |     4.3 |   0% | ≤ 1 edit  |  no   |   yes   |    0 |
| fuzzysort         | 0.46 |  0.24 |     3.7 |   7% | none      |  no   |   yes   |    0 |
| @nozbe/microfuzz  | 0.41 |  1.40 |     1.7 |   7% | none      |  no   |   yes   |    0 |
| match-sorter      | 0.39 |  2.14 |     3.6 |   7% | none      |  yes  |   no    |    2 |
| fuzzy             | 0.30 |  1.53 |     0.8 |   7% | none      |  no   | partial |    0 |
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
On query time alone, the frontier chart in [the benchmarks](./benchmarks.md) has fuzzysort on it beside Ekrina (indexed), at 0.46 MRR.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./pareto-total-dark.svg">
  <img alt="Native-corpus accuracy (MRR) vs. cold one-shot time (constructor plus first answer in a fresh process, log scale) as a Pareto frontier. The frontier is fuzzy, then Ekrina (acronym): Ekrina (acronym) scores 0.91 at ~3.2 ms one-shot, base Ekrina 0.91 at ~3.5 ms and Ekrina (indexed) 0.91 at ~3.9 ms, and everything else, including fast-fuzzy at 0.81 and ~43 ms and Fuse.js (tuned) at 0.76 and ~16 ms, is dominated." src="./pareto-total-light.svg">
</picture>

Lazy Ekrina comes out a little ahead of indexed Ekrina cold, at 3.5 ms against 3.9, and level or ahead on every timed query, even the typo, the acronym and the query nothing matches, which make it scan the raw text and then build the whole-list index anyway.
On a plain prefix the gap is widest, at 2.3 ms against 3.6.

Ekrina is the only one of the eight that returns both a categorical `tier` and the `ranges` to highlight.
microfuzz and fuzzysort also fold diacritics, match multi-word queries and take per-field config by default, and match-sorter returns tiers without ranges.
It is built for matching in-memory lists on the client, and the cold-process numbers hold up for server-side work too.

## What to pick

Pick Ekrina, unless one of the cases below is yours.
It tops the quality scorecard on all three benchmark corpora, answers nothing it shouldn't, and runs its session ten to twenty times faster than the two libraries closest to it on quality.
At <!-- bench:ekrina-size-standing -->~8.3 kB gzip it is the third-largest of the eight, and only Fuse.js, at ~9.6 kB, and fast-fuzzy, at ~11.1 kB, are larger<!-- bench:end -->.
Most of what it has grown by since 1.x is the correction machinery, which is also where the quality lead comes from.
Pick something else when:

- **A tight bundle budget:** @nozbe/microfuzz is ~1.7 kB, at 0.41 MRR and with no typo tolerance.
- **Query time matters more than quality:** fuzzysort answers in 0.24 ms against Ekrina's 0.36 at 10k, at 0.46 MRR.
- **Typos run past two edits:** Fuse.js and fast-fuzzy score any edit distance, so they can still find an item three or more edits away, while answering 47% and 24% of the queries that have no right answer.
- **Results that match only some of the query's words:** Ekrina returns an item only when every word of the query matches it, so `red car` finds nothing in a list of "Red Bike" and "Blue Car", where fast-fuzzy returns Blue Car.
  fast-fuzzy is 1.3× the bundle with ~4.7 ms queries; with Ekrina, search each word on its own and merge the results.

[The recommendation](./benchmarks.md#the-recommendation) has the full argument, library by library.
