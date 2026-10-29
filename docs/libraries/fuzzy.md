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
| **fuzzy**        | 0.38 |     0.03 |    1.92 |    45.22 |        1.80 |
| fuzzy (all opts) | 0.38 |     0.03 |    2.02 |    47.79 |        1.90 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:library-fuzzy-scorecard-ascii -->
| Library          |  MRR | index ms | cold ms | batch ms | batch/query |
|------------------|-----:|---------:|--------:|---------:|------------:|
| **fuzzy**        | 0.39 |     0.03 |    1.73 |    34.64 |        1.37 |
| fuzzy (all opts) | 0.39 |     0.03 |    1.86 |    36.12 |        1.43 |
<!-- bench:end -->

## Speed at 100k

The columns are [the speed tables'](../benchmarks.md#size-speed--search-type), at 100k, with base Ekrina as the 100% row.
Only the ascii corpus is shown, because the mixed tables list only configurations that fold diacritics, and at most one of this library's does.

**ascii corpus:**

<!-- bench:library-fuzzy-speed-ascii -->
| Library          |   index | cold query |    total | total rel |
|------------------|--------:|-----------:|---------:|----------:|
| **Ekrina**       | 0.36 ms |   12.41 ms | 12.74 ms |  **100%** |
| fuzzy            | 0.03 ms |   16.98 ms | 17.01 ms |      134% |
| fuzzy (all opts) | 0.09 ms |   17.80 ms | 17.84 ms |      140% |
<!-- bench:end -->

<!-- bench:library-fuzzy-batch-ascii -->
| Library          | batch/query | batch total | batch rel |
|------------------|------------:|------------:|----------:|
| **Ekrina**       |     2.51 ms |    64.52 ms |  **100%** |
| fuzzy            |    17.81 ms |   445.16 ms |      690% |
| fuzzy (all opts) |    22.82 ms |   575.69 ms |      892% |
<!-- bench:end -->

## Match quality, by query family

MRR@10 per family, scored as in [Match quality, by query family](../benchmarks.md#match-quality-by-query-family).

**mixed corpus:**

<!-- bench:library-fuzzy-families-mixed -->
| Family                     | fuzzy | fuzzy (all opts) |
|----------------------------|------:|-----------------:|
| long-word                  |  0.93 |             0.93 |
| short-word                 |  0.75 |             0.75 |
| two-words                  |  0.90 |             0.90 |
| two-words-reversed         |  0.10 |             0.10 |
| two-words-partial-reversed |  0.00 |             0.00 |
| two-words-joined           |  1.00 |             1.00 |
| two-words-typo             |  0.00 |             0.00 |
| two-words-typo-second      |  0.00 |             0.00 |
| two-words-typo-reversed    |  0.00 |             0.00 |
| plural-to-singular         |  0.38 |             0.38 |
| short-word-typo            |  0.00 |             0.00 |
| prefix                     |  0.97 |             0.97 |
| infix                      |  1.00 |             1.00 |
| scatter-light              |  0.90 |             0.90 |
| scatter-medium             |  0.56 |             0.56 |
| scatter-heavy              |  0.24 |             0.24 |
| transposition              |  0.00 |             0.00 |
| insertion                  |  0.00 |             0.00 |
| substitution               |  0.00 |             0.00 |
| acronym                    |  0.12 |             0.12 |
| accent-stripped            |  0.18 |             0.18 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:library-fuzzy-families-ascii -->
| Family                     | fuzzy | fuzzy (all opts) |
|----------------------------|------:|-----------------:|
| long-word                  |  0.96 |             0.96 |
| short-word                 |  0.80 |             0.80 |
| two-words                  |  1.00 |             1.00 |
| two-words-reversed         |  0.00 |             0.00 |
| two-words-partial-reversed |  0.07 |             0.07 |
| two-words-joined           |  0.97 |             0.97 |
| two-words-typo             |  0.00 |             0.00 |
| two-words-typo-second      |  0.00 |             0.00 |
| two-words-typo-reversed    |  0.00 |             0.00 |
| plural-to-singular         |  0.40 |             0.40 |
| short-word-typo            |  0.00 |             0.00 |
| prefix                     |  0.98 |             0.98 |
| infix                      |  1.00 |             1.00 |
| scatter-light              |  0.78 |             0.78 |
| scatter-medium             |  0.55 |             0.55 |
| scatter-heavy              |  0.12 |             0.12 |
| transposition              |  0.00 |             0.00 |
| insertion                  |  0.10 |             0.10 |
| substitution               |  0.00 |             0.00 |
| acronym                    |  0.03 |             0.03 |
<!-- bench:end -->
