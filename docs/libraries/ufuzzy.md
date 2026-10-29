# uFuzzy

Every configuration of uFuzzy the bench runs, over the same corpora and queries as [the benchmarks](../benchmarks.md).
The headline tables there show whichever scores best on those benchmarks, which makes it the configuration tuned to the tests it is ranked on.
That row is in bold in the scorecard below.

- **uFuzzy**: the defaults, with in-order terms, no diacritic folding and no typo mode.
- **uFuzzy (all opts)**: folds diacritics with `latinize()`, matches multi-word queries out of order with `outOfOrder`, and runs its one-typo `SingleError` mode with all four edits.

## Scorecard

The columns are [the scorecard's](../benchmarks.md#scorecard).

**mixed corpus:**

<!-- bench:library-ufuzzy-scorecard-mixed -->
| Library               |  MRR | index ms | cold ms | batch ms | batch/query |
|-----------------------|-----:|---------:|--------:|---------:|------------:|
| **uFuzzy (all opts)** | 0.76 |     5.20 |    1.89 |    32.79 |        1.29 |
| uFuzzy                | 0.24 |     5.27 |    0.97 |     7.25 |        0.24 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:library-ufuzzy-scorecard-ascii -->
| Library               |  MRR | index ms | cold ms | batch ms | batch/query |
|-----------------------|-----:|---------:|--------:|---------:|------------:|
| **uFuzzy (all opts)** | 0.75 |     4.58 |    1.41 |    17.17 |        0.65 |
| uFuzzy                | 0.24 |     4.02 |    0.88 |     6.03 |        0.21 |
<!-- bench:end -->

## Speed at 100k

The columns are [the speed tables'](../benchmarks.md#size-speed--search-type), at 100k, with base Ekrina as the 100% row.
Only the ascii corpus is shown, because the mixed tables list only configurations that fold diacritics, and at most one of this library's does.

**ascii corpus:**

<!-- bench:library-ufuzzy-speed-ascii -->
| Library           |    index | cold query |    total | total rel |
|-------------------|---------:|-----------:|---------:|----------:|
| **Ekrina**        |  0.34 ms |   12.83 ms | 13.13 ms |  **100%** |
| uFuzzy            |  7.74 ms |    3.01 ms |  7.84 ms |       60% |
| uFuzzy (all opts) | 10.69 ms |    3.58 ms | 12.56 ms |       96% |
<!-- bench:end -->

<!-- bench:library-ufuzzy-batch-ascii -->
| Library           | batch/query | batch total | batch rel |
|-------------------|------------:|------------:|----------:|
| **Ekrina**        |     3.00 ms |    76.65 ms |  **100%** |
| uFuzzy            |     2.82 ms |    73.44 ms |       96% |
| uFuzzy (all opts) |     3.90 ms |    98.86 ms |      129% |
<!-- bench:end -->

## Match quality, by query family

MRR@10 per family, scored as in [Match quality, by query family](../benchmarks.md#match-quality-by-query-family).

**mixed corpus:**

<!-- bench:library-ufuzzy-families-mixed -->
| Family                     | uFuzzy | uFuzzy (all opts) |
|----------------------------|-------:|------------------:|
| long-word                  |   1.00 |              1.00 |
| short-word                 |   1.00 |              1.00 |
| two-words                  |   1.00 |              1.00 |
| two-words-reversed         |   0.10 |              1.00 |
| two-words-partial-reversed |   0.00 |              1.00 |
| two-words-joined           |   0.00 |              0.00 |
| two-words-typo             |   0.00 |              1.00 |
| two-words-typo-second      |   0.00 |              1.00 |
| two-words-typo-reversed    |   0.00 |              1.00 |
| plural-to-singular         |   0.00 |              1.00 |
| short-word-typo            |   0.00 |              0.00 |
| prefix                     |   1.00 |              1.00 |
| infix                      |   1.00 |              1.00 |
| scatter-light              |   0.00 |              1.00 |
| scatter-medium             |   0.00 |              0.00 |
| scatter-heavy              |   0.00 |              0.00 |
| transposition              |   0.00 |              1.00 |
| insertion                  |   0.00 |              1.00 |
| substitution               |   0.00 |              1.00 |
| acronym                    |   0.00 |              0.00 |
| accent-stripped            |   0.00 |              1.00 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:library-ufuzzy-families-ascii -->
| Family                     | uFuzzy | uFuzzy (all opts) |
|----------------------------|-------:|------------------:|
| long-word                  |   1.00 |              1.00 |
| short-word                 |   1.00 |              1.00 |
| two-words                  |   1.00 |              1.00 |
| two-words-reversed         |   0.00 |              1.00 |
| two-words-partial-reversed |   0.10 |              1.00 |
| two-words-joined           |   0.00 |              0.00 |
| two-words-typo             |   0.00 |              1.00 |
| two-words-typo-second      |   0.00 |              1.00 |
| two-words-typo-reversed    |   0.00 |              1.00 |
| plural-to-singular         |   0.00 |              1.00 |
| short-word-typo            |   0.00 |              0.00 |
| prefix                     |   1.00 |              1.00 |
| infix                      |   1.00 |              1.00 |
| scatter-light              |   0.00 |              0.75 |
| scatter-medium             |   0.00 |              0.00 |
| scatter-heavy              |   0.00 |              0.00 |
| transposition              |   0.00 |              1.00 |
| insertion                  |   0.00 |              1.00 |
| substitution               |   0.00 |              1.00 |
| acronym                    |   0.00 |              0.00 |
| accent-stripped            |   0.00 |              1.00 |
<!-- bench:end -->
