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
| Ekrina (acronym) | 0.90 |     0.16 |    4.04 |    21.20 |        0.77 |
| Ekrina           | 0.87 |     0.15 |    3.78 |    21.73 |        0.80 |
| Ekrina (indexed) | 0.87 |     2.06 |    1.48 |    14.52 |        0.55 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:library-ekrina-scorecard-ascii -->
| Library          |  MRR | index ms | cold ms | batch ms | batch/query |
|------------------|-----:|---------:|--------:|---------:|------------:|
| Ekrina (acronym) | 0.90 |     0.13 |    3.69 |    18.95 |        0.71 |
| Ekrina           | 0.87 |     0.13 |    3.51 |    18.30 |        0.70 |
| Ekrina (indexed) | 0.87 |     2.66 |    1.49 |    19.91 |        0.77 |
<!-- bench:end -->

## Speed at 100k

The columns are [the speed tables'](../benchmarks.md#size-speed--search-type), at 100k.

**ascii corpus:**

<!-- bench:library-ekrina-speed-ascii -->
| Library          |    index | cold query |    total | total rel |
|------------------|---------:|-----------:|---------:|----------:|
| **Ekrina**       |  0.34 ms |   12.83 ms | 13.13 ms |  **100%** |
| Ekrina (acronym) |  0.43 ms |   12.98 ms | 13.31 ms |      101% |
| Ekrina (indexed) | 12.49 ms |    2.94 ms | 14.77 ms |      112% |
<!-- bench:end -->

<!-- bench:library-ekrina-batch-ascii -->
| Library          | batch/query | batch total | batch rel |
|------------------|------------:|------------:|----------:|
| **Ekrina**       |     3.00 ms |    76.65 ms |  **100%** |
| Ekrina (acronym) |     3.26 ms |    83.66 ms |      109% |
| Ekrina (indexed) |     2.22 ms |    55.71 ms |       73% |
<!-- bench:end -->

**mixed corpus:**

<!-- bench:library-ekrina-speed-mixed -->
| Library          |    index | cold query |    total | total rel |
|------------------|---------:|-----------:|---------:|----------:|
| **Ekrina**       |  0.30 ms |   26.46 ms | 26.89 ms |  **100%** |
| Ekrina (acronym) |  0.29 ms |   25.67 ms | 26.13 ms |       97% |
| Ekrina (indexed) | 22.93 ms |    4.25 ms | 31.15 ms |      116% |
<!-- bench:end -->

<!-- bench:library-ekrina-batch-mixed -->
| Library          | batch/query | batch total | batch rel |
|------------------|------------:|------------:|----------:|
| **Ekrina**       |     2.78 ms |    72.64 ms |  **100%** |
| Ekrina (acronym) |     3.09 ms |    80.78 ms |      111% |
| Ekrina (indexed) |     1.71 ms |    44.18 ms |       61% |
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
| two-words-reversed         |   1.00 |             1.00 |             1.00 |
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
| scatter-heavy              |   0.05 |             0.05 |             0.05 |
| transposition              |   1.00 |             1.00 |             1.00 |
| insertion                  |   1.00 |             1.00 |             1.00 |
| substitution               |   1.00 |             1.00 |             1.00 |
| acronym                    |   0.34 |             0.91 |             0.34 |
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
| plural-to-singular         |   1.00 |             1.00 |             1.00 |
| short-word-typo            |   1.00 |             1.00 |             1.00 |
| prefix                     |   1.00 |             1.00 |             1.00 |
| infix                      |   1.00 |             1.00 |             1.00 |
| scatter-light              |   1.00 |             1.00 |             1.00 |
| scatter-medium             |   0.00 |             0.00 |             0.00 |
| scatter-heavy              |   0.02 |             0.02 |             0.02 |
| transposition              |   1.00 |             1.00 |             1.00 |
| insertion                  |   1.00 |             1.00 |             1.00 |
| substitution               |   1.00 |             1.00 |             1.00 |
| acronym                    |   0.30 |             0.90 |             0.30 |
| accent-stripped            |   1.00 |             1.00 |             1.00 |
<!-- bench:end -->
