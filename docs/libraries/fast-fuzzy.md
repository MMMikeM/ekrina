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
| **fast-fuzzy**        | 0.72 |    32.22 |   16.42 |   173.10 |        6.50 |
| fast-fuzzy (all opts) | 0.72 |    29.30 |   16.56 |   163.70 |        6.03 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:library-fast-fuzzy-scorecard-ascii -->
| Library               |  MRR | index ms | cold ms | batch ms | batch/query |
|-----------------------|-----:|---------:|--------:|---------:|------------:|
| **fast-fuzzy**        | 0.70 |    27.45 |   16.46 |   148.67 |        5.55 |
| fast-fuzzy (all opts) | 0.70 |    26.69 |   16.78 |   145.09 |        5.35 |
<!-- bench:end -->

## Speed at 100k

The columns are [the speed tables'](../benchmarks.md#size-speed--search-type), at 100k, with base Ekrina as the 100% row.
Only the ascii corpus is shown, because the mixed tables list only configurations that fold diacritics, and at most one of this library's does.

**ascii corpus:**

<!-- bench:library-fast-fuzzy-speed-ascii -->
| Library               |     index | cold query |     total | total rel |
|-----------------------|----------:|-----------:|----------:|----------:|
| **Ekrina**            |   0.34 ms |   12.83 ms |  13.13 ms |  **100%** |
| fast-fuzzy            | 801.05 ms |   60.27 ms | 414.88 ms |     3159% |
| fast-fuzzy (all opts) | 740.33 ms |   60.47 ms | 417.34 ms |     3178% |
<!-- bench:end -->

<!-- bench:library-fast-fuzzy-batch-ascii -->
| Library               | batch/query | batch total | batch rel |
|-----------------------|------------:|------------:|----------:|
| **Ekrina**            |     3.00 ms |    76.65 ms |  **100%** |
| fast-fuzzy            |    85.20 ms |  2190.62 ms |     2858% |
| fast-fuzzy (all opts) |    90.04 ms |  2256.26 ms |     2944% |
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
