# Fuse.js

Every configuration of Fuse.js the bench runs, over the same corpora and queries as [the benchmarks](../benchmarks.md).
The headline tables there show whichever scores best on those benchmarks, which makes it the configuration tuned to the tests it is ranked on.
That row is in bold in the scorecard below.

- **Fuse.js**: Fuse's defaults with two departures, `ignoreLocation` on and `threshold` 0.4, described in [Libraries](../benchmarks.md#libraries).
- **Fuse.js (all opts)**: adds `includeMatches` for ranges, `ignoreDiacritics` for folding, and `useExtendedSearch`, which turns space-separated terms into an AND of fuzzy patterns in any order.

## Scorecard

The columns are [the scorecard's](../benchmarks.md#scorecard).

**mixed corpus:**

<!-- bench:library-fuse-scorecard-mixed -->
| Library                |  MRR | index ms | cold ms | batch ms | batch/query |
|------------------------|-----:|---------:|--------:|---------:|------------:|
| **Fuse.js (all opts)** | 0.79 |     1.56 |   15.99 |   376.17 |       15.01 |
| Fuse.js                | 0.66 |     1.33 |   14.54 |   477.90 |       19.47 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:library-fuse-scorecard-ascii -->
| Library                |  MRR | index ms | cold ms | batch ms | batch/query |
|------------------------|-----:|---------:|--------:|---------:|------------:|
| **Fuse.js (all opts)** | 0.79 |     1.27 |   15.51 |   348.10 |       13.86 |
| Fuse.js                | 0.66 |     1.20 |   13.63 |   380.14 |       15.38 |
<!-- bench:end -->

## Speed at 100k

The columns are [the speed tables'](../benchmarks.md#size-speed--search-type), at 100k, with base Ekrina as the 100% row.
Only the ascii corpus is shown, because the mixed tables list only configurations that fold diacritics, and at most one of this library's does.

**ascii corpus:**

<!-- bench:library-fuse-speed-ascii -->
| Library            |   index | cold query |     total | total rel |
|--------------------|--------:|-----------:|----------:|----------:|
| **Ekrina**         | 0.34 ms |   12.83 ms |  13.13 ms |  **100%** |
| Fuse.js            | 7.32 ms |  138.16 ms | 144.87 ms |     1103% |
| Fuse.js (all opts) | 8.39 ms |  138.98 ms | 144.96 ms |     1104% |
<!-- bench:end -->

<!-- bench:library-fuse-batch-ascii -->
| Library            | batch/query | batch total | batch rel |
|--------------------|------------:|------------:|----------:|
| **Ekrina**         |     3.00 ms |    76.65 ms |  **100%** |
| Fuse.js            |   218.28 ms |  5374.24 ms |     7012% |
| Fuse.js (all opts) |   199.72 ms |  4991.91 ms |     6513% |
<!-- bench:end -->

## Match quality, by query family

MRR@10 per family, scored as in [Match quality, by query family](../benchmarks.md#match-quality-by-query-family).

**mixed corpus:**

<!-- bench:library-fuse-families-mixed -->
| Family                     | Fuse.js | Fuse.js (all opts) |
|----------------------------|--------:|-------------------:|
| long-word                  |    0.99 |               0.99 |
| short-word                 |    0.82 |               0.81 |
| two-words                  |    1.00 |               1.00 |
| two-words-reversed         |    0.14 |               1.00 |
| two-words-partial-reversed |    0.41 |               1.00 |
| two-words-joined           |    0.92 |               0.92 |
| two-words-typo             |    0.93 |               0.97 |
| two-words-typo-second      |    1.00 |               1.00 |
| two-words-typo-reversed    |    0.01 |               1.00 |
| plural-to-singular         |    0.92 |               0.85 |
| short-word-typo            |    0.19 |               0.19 |
| prefix                     |    0.98 |               0.98 |
| infix                      |    1.00 |               1.00 |
| scatter-light              |    0.96 |               0.96 |
| scatter-medium             |    0.06 |               0.06 |
| scatter-heavy              |    0.02 |               0.02 |
| transposition              |    0.92 |               0.85 |
| insertion                  |    1.00 |               1.00 |
| substitution               |    0.94 |               0.94 |
| acronym                    |    0.00 |               0.00 |
| accent-stripped            |    0.74 |               1.00 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:library-fuse-families-ascii -->
| Family                     | Fuse.js | Fuse.js (all opts) |
|----------------------------|--------:|-------------------:|
| long-word                  |    0.97 |               0.97 |
| short-word                 |    0.70 |               0.70 |
| two-words                  |    1.00 |               1.00 |
| two-words-reversed         |    0.00 |               1.00 |
| two-words-partial-reversed |    0.25 |               0.95 |
| two-words-joined           |    1.00 |               1.00 |
| two-words-typo             |    0.93 |               1.00 |
| two-words-typo-second      |    1.00 |               1.00 |
| two-words-typo-reversed    |    0.10 |               1.00 |
| plural-to-singular         |    0.96 |               0.96 |
| short-word-typo            |    0.31 |               0.31 |
| prefix                     |    1.00 |               1.00 |
| infix                      |    1.00 |               1.00 |
| scatter-light              |    0.91 |               0.91 |
| scatter-medium             |    0.22 |               0.22 |
| scatter-heavy              |    0.00 |               0.00 |
| transposition              |    0.95 |               0.95 |
| insertion                  |    0.91 |               0.91 |
| substitution               |    0.99 |               0.99 |
| acronym                    |    0.00 |               0.00 |
| accent-stripped            |    0.60 |               0.65 |
<!-- bench:end -->
