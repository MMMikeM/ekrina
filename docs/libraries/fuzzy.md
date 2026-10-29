# fuzzy

Every configuration of fuzzy the bench runs, over the same corpora and queries as [the benchmarks](../benchmarks.md).
The headline tables there show whichever scores best on those benchmarks, which makes it the configuration tuned to the tests it is ranked on.
That row is in bold in the scorecard below.

- **fuzzy**: the defaults, `fuzzy.filter(query, list)`.
- **fuzzy (all opts)**: `pre` and `post` set, so each result comes back with its matches wrapped for highlighting.

## Scorecard

The columns are [the scorecard's](../benchmarks.md#scorecard).

**mixed corpus:**

<!-- bench:library-fuzzy-scorecard-mixed -->
| Library          |  MRR | index ms | cold ms | batch ms | batch/query |
|------------------|-----:|---------:|--------:|---------:|------------:|
| **fuzzy**        | 0.43 |     0.05 |    2.14 |   107.57 |        4.35 |
| fuzzy (all opts) | 0.43 |     0.05 |    2.30 |    50.60 |        2.01 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:library-fuzzy-scorecard-ascii -->
| Library          |  MRR | index ms | cold ms | batch ms | batch/query |
|------------------|-----:|---------:|--------:|---------:|------------:|
| **fuzzy**        | 0.42 |     0.04 |    1.88 |    37.47 |        1.48 |
| fuzzy (all opts) | 0.42 |     0.03 |    2.04 |    37.64 |        1.49 |
<!-- bench:end -->

## Speed at 100k

The columns are [the speed tables'](../benchmarks.md#size-speed--search-type), at 100k, with base Ekrina as the 100% row.
Only the ascii corpus is shown, because the mixed tables list only configurations that fold diacritics, and at most one of this library's does.

**ascii corpus:**

<!-- bench:library-fuzzy-speed-ascii -->
| Library          |   index | cold query |    total | total rel |
|------------------|--------:|-----------:|---------:|----------:|
| **Ekrina**       | 0.34 ms |   12.83 ms | 13.13 ms |  **100%** |
| fuzzy            | 0.06 ms |   19.25 ms | 19.29 ms |      147% |
| fuzzy (all opts) | 0.05 ms |   19.14 ms | 19.18 ms |      146% |
<!-- bench:end -->

<!-- bench:library-fuzzy-batch-ascii -->
| Library          | batch/query | batch total | batch rel |
|------------------|------------:|------------:|----------:|
| **Ekrina**       |     3.00 ms |    76.65 ms |  **100%** |
| fuzzy            |    35.12 ms |   870.60 ms |     1136% |
| fuzzy (all opts) |    30.14 ms |   749.11 ms |      977% |
<!-- bench:end -->

## Match quality, by query family

MRR@10 per family, scored as in [Match quality, by query family](../benchmarks.md#match-quality-by-query-family).

**mixed corpus:**

<!-- bench:library-fuzzy-families-mixed -->
| Family                     | fuzzy | fuzzy (all opts) |
|----------------------------|------:|-----------------:|
| long-word                  |  0.99 |             0.99 |
| short-word                 |  0.86 |             0.86 |
| two-words                  |  0.90 |             0.90 |
| two-words-reversed         |  0.10 |             0.10 |
| two-words-partial-reversed |  0.00 |             0.00 |
| two-words-joined           |  1.00 |             1.00 |
| two-words-typo             |  0.00 |             0.00 |
| two-words-typo-second      |  0.00 |             0.00 |
| two-words-typo-reversed    |  0.00 |             0.00 |
| plural-to-singular         |  0.69 |             0.69 |
| short-word-typo            |  0.00 |             0.00 |
| prefix                     |  0.97 |             0.97 |
| infix                      |  1.00 |             1.00 |
| scatter-light              |  0.99 |             0.99 |
| scatter-medium             |  0.52 |             0.52 |
| scatter-heavy              |  0.35 |             0.35 |
| transposition              |  0.35 |             0.35 |
| insertion                  |  0.20 |             0.20 |
| substitution               |  0.00 |             0.00 |
| acronym                    |  0.07 |             0.07 |
| accent-stripped            |  0.11 |             0.11 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:library-fuzzy-families-ascii -->
| Family                     | fuzzy | fuzzy (all opts) |
|----------------------------|------:|-----------------:|
| long-word                  |  0.97 |             0.97 |
| short-word                 |  0.84 |             0.84 |
| two-words                  |  1.00 |             1.00 |
| two-words-reversed         |  0.00 |             0.00 |
| two-words-partial-reversed |  0.07 |             0.07 |
| two-words-joined           |  0.97 |             0.97 |
| two-words-typo             |  0.00 |             0.00 |
| two-words-typo-second      |  0.00 |             0.00 |
| two-words-typo-reversed    |  0.00 |             0.00 |
| plural-to-singular         |  0.82 |             0.82 |
| short-word-typo            |  0.20 |             0.20 |
| prefix                     |  1.00 |             1.00 |
| infix                      |  1.00 |             1.00 |
| scatter-light              |  0.72 |             0.72 |
| scatter-medium             |  0.62 |             0.62 |
| scatter-heavy              |  0.16 |             0.16 |
| transposition              |  0.20 |             0.20 |
| insertion                  |  0.10 |             0.10 |
| substitution               |  0.00 |             0.00 |
| acronym                    |  0.01 |             0.01 |
| accent-stripped            |  0.20 |             0.20 |
<!-- bench:end -->
