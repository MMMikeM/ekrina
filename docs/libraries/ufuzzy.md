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
| **uFuzzy (all opts)** | 0.75 |     4.95 |    1.68 |    23.40 |        0.91 |
| uFuzzy                | 0.25 |     4.25 |    0.92 |     6.04 |        0.21 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:library-ufuzzy-scorecard-ascii -->
| Library               |  MRR | index ms | cold ms | batch ms | batch/query |
|-----------------------|-----:|---------:|--------:|---------:|------------:|
| **uFuzzy (all opts)** | 0.74 |     4.73 |    1.39 |    17.27 |        0.66 |
| uFuzzy                | 0.26 |     4.22 |    0.82 |     5.56 |        0.19 |
<!-- bench:end -->

## Speed at 100k

The columns are [the speed tables'](../benchmarks.md#size-speed--search-type), at 100k, with base Ekrina as the 100% row.
Only the ascii corpus is shown, because the mixed tables list only configurations that fold diacritics, and at most one of this library's does.

**ascii corpus:**

<!-- bench:library-ufuzzy-speed-ascii -->
| Library           |   index | cold query |    total | total rel |
|-------------------|--------:|-----------:|---------:|----------:|
| **Ekrina**        | 0.36 ms |   12.41 ms | 12.74 ms |  **100%** |
| uFuzzy            | 4.13 ms |    2.46 ms |  6.54 ms |       51% |
| uFuzzy (all opts) | 7.89 ms |    3.09 ms | 11.37 ms |       89% |
<!-- bench:end -->

<!-- bench:library-ufuzzy-batch-ascii -->
| Library           | batch/query | batch total | batch rel |
|-------------------|------------:|------------:|----------:|
| **Ekrina**        |     2.51 ms |    64.52 ms |  **100%** |
| uFuzzy            |     1.71 ms |    44.09 ms |       68% |
| uFuzzy (all opts) |     2.38 ms |    60.21 ms |       93% |
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
| two-words-reversed         |   0.10 |              0.95 |
| two-words-partial-reversed |   0.00 |              1.00 |
| two-words-joined           |   0.00 |              0.00 |
| two-words-typo             |   0.00 |              1.00 |
| two-words-typo-second      |   0.00 |              1.00 |
| two-words-typo-reversed    |   0.00 |              1.00 |
| plural-to-singular         |   0.00 |              0.93 |
| short-word-typo            |   0.00 |              0.00 |
| prefix                     |   1.00 |              1.00 |
| infix                      |   1.00 |              1.00 |
| scatter-light              |   0.00 |              0.85 |
| scatter-medium             |   0.00 |              0.00 |
| scatter-heavy              |   0.00 |              0.00 |
| transposition              |   0.00 |              1.00 |
| insertion                  |   0.00 |              1.00 |
| substitution               |   0.00 |              1.00 |
| acronym                    |   0.00 |              0.00 |
| accent-stripped            |   0.10 |              1.00 |
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
| plural-to-singular         |   0.00 |              0.95 |
| short-word-typo            |   0.00 |              0.00 |
| prefix                     |   1.00 |              1.00 |
| infix                      |   1.00 |              1.00 |
| scatter-light              |   0.00 |              0.80 |
| scatter-medium             |   0.00 |              0.00 |
| scatter-heavy              |   0.00 |              0.00 |
| transposition              |   0.00 |              1.00 |
| insertion                  |   0.00 |              1.00 |
| substitution               |   0.00 |              1.00 |
| acronym                    |   0.00 |              0.00 |
<!-- bench:end -->
