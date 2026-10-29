# Ekrina

Every configuration of Ekrina the bench runs, over the same corpora and queries as [the benchmarks](../benchmarks.md).
The headline tables there show every Ekrina configuration.

- **Ekrina**: the defaults, `createFuzzySearch(list)`.
- **Ekrina (acronym)**: `acronym: true`, which adds the word-initials tier.
- **Ekrina (indexed)**: the defaults with `buildIndex()` called up front, so the whole-list mask index moves into the constructor; results are identical to the defaults.

## Scorecard

The columns are [the scorecard's](../benchmarks.md#scorecard).

**mixed corpus:**

<!-- bench:library-ekrina-scorecard-mixed -->
| Library          |  MRR | index ms | cold ms | batch ms | batch/query |
|------------------|-----:|---------:|--------:|---------:|------------:|
| Ekrina (acronym) | 0.89 |     0.13 |    3.93 |    18.73 |        0.67 |
| Ekrina           | 0.87 |     0.13 |    3.71 |    18.49 |        0.67 |
| Ekrina (indexed) | 0.87 |     2.10 |    1.34 |    13.54 |        0.52 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:library-ekrina-scorecard-ascii -->
| Library          |  MRR | index ms | cold ms | batch ms | batch/query |
|------------------|-----:|---------:|--------:|---------:|------------:|
| Ekrina (acronym) | 0.89 |     0.12 |    3.42 |    19.03 |        0.71 |
| Ekrina           | 0.86 |     0.12 |    3.33 |    18.68 |        0.71 |
| Ekrina (indexed) | 0.86 |     2.08 |    1.43 |    15.35 |        0.59 |
<!-- bench:end -->

## Speed at 100k

The columns are [the speed tables'](../benchmarks.md#size-speed--search-type), at 100k.

**ascii corpus:**

<!-- bench:library-ekrina-speed-ascii -->
| Library          |    index | cold query |    total | total rel |
|------------------|---------:|-----------:|---------:|----------:|
| **Ekrina**       |  0.36 ms |   12.41 ms | 12.74 ms |  **100%** |
| Ekrina (acronym) |  0.31 ms |   12.21 ms | 12.55 ms |       99% |
| Ekrina (indexed) | 12.08 ms |    2.64 ms | 14.15 ms |      111% |
<!-- bench:end -->

<!-- bench:library-ekrina-batch-ascii -->
| Library          | batch/query | batch total | batch rel |
|------------------|------------:|------------:|----------:|
| **Ekrina**       |     2.51 ms |    64.52 ms |  **100%** |
| Ekrina (acronym) |     2.51 ms |    64.53 ms |      100% |
| Ekrina (indexed) |     1.95 ms |    49.31 ms |       76% |
<!-- bench:end -->

**mixed corpus:**

<!-- bench:library-ekrina-speed-mixed -->
| Library          |    index | cold query |    total | total rel |
|------------------|---------:|-----------:|---------:|----------:|
| **Ekrina**       |  0.35 ms |   19.22 ms | 19.57 ms |  **100%** |
| Ekrina (acronym) |  0.32 ms |   19.88 ms | 20.22 ms |      103% |
| Ekrina (indexed) | 20.58 ms |    2.39 ms | 23.37 ms |      119% |
<!-- bench:end -->

<!-- bench:library-ekrina-batch-mixed -->
| Library          | batch/query | batch total | batch rel |
|------------------|------------:|------------:|----------:|
| **Ekrina**       |     2.43 ms |    63.47 ms |  **100%** |
| Ekrina (acronym) |     2.41 ms |    63.29 ms |      100% |
| Ekrina (indexed) |     1.19 ms |    30.79 ms |       49% |
<!-- bench:end -->

## Match quality, by query family

MRR@10 per family, scored as in [Match quality, by query family](../benchmarks.md#match-quality-by-query-family).

**mixed corpus:**

<!-- bench:library-ekrina-families-mixed -->
| Family                     | Ekrina | Ekrina (acronym) | Ekrina (indexed) |
|----------------------------|-------:|-----------------:|-----------------:|
| long-word                  |   1.00 |             1.00 |             1.00 |
| short-word                 |   1.00 |             1.00 |             1.00 |
| two-words                  |   1.00 |             1.00 |             1.00 |
| two-words-reversed         |   0.97 |             0.97 |             0.97 |
| two-words-partial-reversed |   1.00 |             1.00 |             1.00 |
| two-words-joined           |   1.00 |             1.00 |             1.00 |
| two-words-typo             |   1.00 |             1.00 |             1.00 |
| two-words-typo-second      |   1.00 |             1.00 |             1.00 |
| two-words-typo-reversed    |   1.00 |             1.00 |             1.00 |
| plural-to-singular         |   0.97 |             0.97 |             0.97 |
| short-word-typo            |   0.86 |             0.86 |             0.86 |
| prefix                     |   1.00 |             1.00 |             1.00 |
| infix                      |   1.00 |             1.00 |             1.00 |
| scatter-light              |   1.00 |             1.00 |             1.00 |
| scatter-medium             |   0.00 |             0.00 |             0.00 |
| scatter-heavy              |   0.00 |             0.00 |             0.00 |
| transposition              |   1.00 |             1.00 |             1.00 |
| insertion                  |   1.00 |             1.00 |             1.00 |
| substitution               |   1.00 |             1.00 |             1.00 |
| acronym                    |   0.44 |             0.86 |             0.44 |
| accent-stripped            |   1.00 |             1.00 |             1.00 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:library-ekrina-families-ascii -->
| Family                     | Ekrina | Ekrina (acronym) | Ekrina (indexed) |
|----------------------------|-------:|-----------------:|-----------------:|
| long-word                  |   1.00 |             1.00 |             1.00 |
| short-word                 |   1.00 |             1.00 |             1.00 |
| two-words                  |   1.00 |             1.00 |             1.00 |
| two-words-reversed         |   1.00 |             1.00 |             1.00 |
| two-words-partial-reversed |   1.00 |             1.00 |             1.00 |
| two-words-joined           |   1.00 |             1.00 |             1.00 |
| two-words-typo             |   1.00 |             1.00 |             1.00 |
| two-words-typo-second      |   1.00 |             1.00 |             1.00 |
| two-words-typo-reversed    |   1.00 |             1.00 |             1.00 |
| plural-to-singular         |   0.95 |             0.95 |             0.95 |
| short-word-typo            |   0.90 |             0.90 |             0.90 |
| prefix                     |   1.00 |             1.00 |             1.00 |
| infix                      |   1.00 |             1.00 |             1.00 |
| scatter-light              |   0.94 |             0.94 |             0.94 |
| scatter-medium             |   0.00 |             0.00 |             0.00 |
| scatter-heavy              |   0.00 |             0.00 |             0.00 |
| transposition              |   1.00 |             1.00 |             1.00 |
| insertion                  |   1.00 |             1.00 |             1.00 |
| substitution               |   0.98 |             0.98 |             0.98 |
| acronym                    |   0.35 |             1.00 |             0.35 |
<!-- bench:end -->
