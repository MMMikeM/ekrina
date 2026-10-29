# fast-fuzzy

Every configuration of fast-fuzzy the bench runs, over the same corpora and queries as [the benchmarks](../benchmarks.md).
The headline tables there show whichever scores best on those benchmarks, which makes it the configuration tuned to the tests it is ranked on.
That row is in bold in the scorecard below.

- **fast-fuzzy**: the defaults.
- **fast-fuzzy (all opts)**: `returnMatchData: true`, which returns a match span with each result.

## Scorecard

The columns are [the scorecard's](../benchmarks.md#scorecard).

**mixed corpus:**

<!-- bench:library-fast-fuzzy-scorecard-mixed -->
| Library               |  MRR | index ms | cold ms | batch ms | batch/query |
|-----------------------|-----:|---------:|--------:|---------:|------------:|
| **fast-fuzzy**        | 0.72 |    27.04 |   14.94 |   170.83 |        6.40 |
| fast-fuzzy (all opts) | 0.72 |    26.39 |   16.66 |   151.85 |        5.60 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:library-fast-fuzzy-scorecard-ascii -->
| Library               |  MRR | index ms | cold ms | batch ms | batch/query |
|-----------------------|-----:|---------:|--------:|---------:|------------:|
| **fast-fuzzy**        | 0.70 |    25.42 |   15.21 |   135.02 |        4.99 |
| fast-fuzzy (all opts) | 0.70 |    24.79 |   15.21 |   137.47 |        5.09 |
<!-- bench:end -->

## Speed at 100k

The columns are [the speed tables'](../benchmarks.md#size-speed--search-type), at 100k, with base Ekrina as the 100% row.
Only the ascii corpus is shown, because the mixed tables list only configurations that fold diacritics, and at most one of this library's does.

**ascii corpus:**

<!-- bench:library-fast-fuzzy-speed-ascii -->
| Library               |     index | cold query |     total | total rel |
|-----------------------|----------:|-----------:|----------:|----------:|
| **Ekrina**            |   0.36 ms |   12.41 ms |  12.74 ms |  **100%** |
| fast-fuzzy            | 267.26 ms |   51.96 ms | 322.45 ms |     2531% |
| fast-fuzzy (all opts) | 265.17 ms |   55.47 ms | 323.66 ms |     2540% |
<!-- bench:end -->

<!-- bench:library-fast-fuzzy-batch-ascii -->
| Library               | batch/query | batch total | batch rel |
|-----------------------|------------:|------------:|----------:|
| **Ekrina**            |     2.51 ms |    64.52 ms |  **100%** |
| fast-fuzzy            |    43.67 ms |  1097.99 ms |     1702% |
| fast-fuzzy (all opts) |    44.02 ms |  1105.36 ms |     1713% |
<!-- bench:end -->

## Match quality, by query family

MRR@10 per family, scored as in [Match quality, by query family](../benchmarks.md#match-quality-by-query-family).

**mixed corpus:**

<!-- bench:library-fast-fuzzy-families-mixed -->
| Family                     | fast-fuzzy | fast-fuzzy (all opts) |
|----------------------------|-----------:|----------------------:|
| long-word                  |       1.00 |                  1.00 |
| short-word                 |       0.93 |                  0.93 |
| two-words                  |       1.00 |                  1.00 |
| two-words-reversed         |       0.12 |                  0.12 |
| two-words-partial-reversed |       0.35 |                  0.35 |
| two-words-joined           |       1.00 |                  1.00 |
| two-words-typo             |       1.00 |                  1.00 |
| two-words-typo-second      |       1.00 |                  1.00 |
| two-words-typo-reversed    |       0.00 |                  0.00 |
| plural-to-singular         |       0.94 |                  0.94 |
| short-word-typo            |       0.95 |                  0.95 |
| prefix                     |       1.00 |                  1.00 |
| infix                      |       1.00 |                  1.00 |
| scatter-light              |       1.00 |                  1.00 |
| scatter-medium             |       0.01 |                  0.01 |
| scatter-heavy              |       0.01 |                  0.01 |
| transposition              |       1.00 |                  1.00 |
| insertion                  |       1.00 |                  1.00 |
| substitution               |       1.00 |                  1.00 |
| acronym                    |       0.00 |                  0.00 |
| accent-stripped            |       0.78 |                  0.78 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:library-fast-fuzzy-families-ascii -->
| Family                     | fast-fuzzy | fast-fuzzy (all opts) |
|----------------------------|-----------:|----------------------:|
| long-word                  |       1.00 |                  1.00 |
| short-word                 |       0.85 |                  0.85 |
| two-words                  |       1.00 |                  1.00 |
| two-words-reversed         |       0.01 |                  0.01 |
| two-words-partial-reversed |       0.23 |                  0.23 |
| two-words-joined           |       1.00 |                  1.00 |
| two-words-typo             |       1.00 |                  1.00 |
| two-words-typo-second      |       1.00 |                  1.00 |
| two-words-typo-reversed    |       0.23 |                  0.23 |
| plural-to-singular         |       1.00 |                  1.00 |
| short-word-typo            |       0.86 |                  0.86 |
| prefix                     |       1.00 |                  1.00 |
| infix                      |       1.00 |                  1.00 |
| scatter-light              |       0.79 |                  0.79 |
| scatter-medium             |       0.14 |                  0.14 |
| scatter-heavy              |       0.00 |                  0.00 |
| transposition              |       1.00 |                  1.00 |
| insertion                  |       1.00 |                  1.00 |
| substitution               |       1.00 |                  1.00 |
| acronym                    |       0.00 |                  0.00 |
| accent-stripped            |       0.60 |                  0.60 |
<!-- bench:end -->
