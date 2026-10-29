# @nozbe/microfuzz

Every configuration of @nozbe/microfuzz the bench runs, over the same corpora and queries as [the benchmarks](../benchmarks.md).
The headline tables there show whichever scores best on those benchmarks, which makes it the configuration tuned to the tests it is ranked on.
That row is in bold in the scorecard below.

- **@nozbe/microfuzz**: the defaults.
- **@nozbe/microfuzz (all opts)**: `strategy: "aggressive"`.

## Scorecard

The columns are [the scorecard's](../benchmarks.md#scorecard).

**mixed corpus:**

<!-- bench:library-microfuzz-scorecard-mixed -->
| Library                     |  MRR | index ms | cold ms | batch ms | batch/query |
|-----------------------------|-----:|---------:|--------:|---------:|------------:|
| **@nozbe/microfuzz**        | 0.52 |     4.52 |    1.56 |    35.53 |        1.41 |
| @nozbe/microfuzz (all opts) | 0.52 |     4.60 |    1.51 |    35.51 |        1.41 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:library-microfuzz-scorecard-ascii -->
| Library                     |  MRR | index ms | cold ms | batch ms | batch/query |
|-----------------------------|-----:|---------:|--------:|---------:|------------:|
| **@nozbe/microfuzz**        | 0.53 |     3.73 |    1.49 |    26.58 |        1.05 |
| @nozbe/microfuzz (all opts) | 0.53 |     3.78 |    1.42 |    29.62 |        1.18 |
<!-- bench:end -->

## Speed at 100k

The columns are [the speed tables'](../benchmarks.md#size-speed--search-type), at 100k, with base Ekrina as the 100% row.

**ascii corpus:**

<!-- bench:library-microfuzz-speed-ascii -->
| Library                     |     index | cold query |    total | total rel |
|-----------------------------|----------:|-----------:|---------:|----------:|
| **Ekrina**                  |   0.34 ms |   12.83 ms | 13.13 ms |  **100%** |
| @nozbe/microfuzz            |  49.24 ms |   15.84 ms | 63.62 ms |      484% |
| @nozbe/microfuzz (all opts) | 113.15 ms |   18.28 ms | 66.74 ms |      508% |
<!-- bench:end -->

<!-- bench:library-microfuzz-batch-ascii -->
| Library                     | batch/query | batch total | batch rel |
|-----------------------------|------------:|------------:|----------:|
| **Ekrina**                  |     3.00 ms |    76.65 ms |  **100%** |
| @nozbe/microfuzz            |    11.62 ms |   293.79 ms |      383% |
| @nozbe/microfuzz (all opts) |    10.91 ms |   281.40 ms |      367% |
<!-- bench:end -->

**mixed corpus:**

<!-- bench:library-microfuzz-speed-mixed -->
| Library                     |    index | cold query |     total | total rel |
|-----------------------------|---------:|-----------:|----------:|----------:|
| **Ekrina**                  |  0.30 ms |   26.46 ms |  26.89 ms |  **100%** |
| @nozbe/microfuzz            | 53.47 ms |   26.48 ms | 113.51 ms |      422% |
| @nozbe/microfuzz (all opts) | 68.93 ms |   25.73 ms | 103.64 ms |      385% |
<!-- bench:end -->

<!-- bench:library-microfuzz-batch-mixed -->
| Library                     | batch/query | batch total | batch rel |
|-----------------------------|------------:|------------:|----------:|
| **Ekrina**                  |     2.78 ms |    72.64 ms |  **100%** |
| @nozbe/microfuzz            |    15.62 ms |   400.99 ms |      552% |
| @nozbe/microfuzz (all opts) |    15.17 ms |   390.09 ms |      537% |
<!-- bench:end -->

## Match quality, by query family

MRR@10 per family, scored as in [Match quality, by query family](../benchmarks.md#match-quality-by-query-family).

**mixed corpus:**

<!-- bench:library-microfuzz-families-mixed -->
| Family                     | @nozbe/microfuzz | @nozbe/microfuzz (all opts) |
|----------------------------|-----------------:|----------------------------:|
| long-word                  |             0.99 |                        0.99 |
| short-word                 |             0.91 |                        0.91 |
| two-words                  |             0.90 |                        0.90 |
| two-words-reversed         |             0.60 |                        0.60 |
| two-words-partial-reversed |             0.00 |                        0.00 |
| two-words-joined           |             1.00 |                        1.00 |
| two-words-typo             |             0.00 |                        0.00 |
| two-words-typo-second      |             0.00 |                        0.00 |
| two-words-typo-reversed    |             0.00 |                        0.00 |
| plural-to-singular         |             0.70 |                        0.70 |
| short-word-typo            |             0.00 |                        0.00 |
| prefix                     |             1.00 |                        1.00 |
| infix                      |             1.00 |                        1.00 |
| scatter-light              |             0.99 |                        0.99 |
| scatter-medium             |             0.66 |                        0.66 |
| scatter-heavy              |             0.30 |                        0.30 |
| transposition              |             0.35 |                        0.35 |
| insertion                  |             0.20 |                        0.20 |
| substitution               |             0.00 |                        0.00 |
| acronym                    |             0.42 |                        0.42 |
| accent-stripped            |             1.00 |                        1.00 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:library-microfuzz-families-ascii -->
| Family                     | @nozbe/microfuzz | @nozbe/microfuzz (all opts) |
|----------------------------|-----------------:|----------------------------:|
| long-word                  |             0.93 |                        0.93 |
| short-word                 |             0.86 |                        0.86 |
| two-words                  |             1.00 |                        1.00 |
| two-words-reversed         |             0.70 |                        0.70 |
| two-words-partial-reversed |             0.10 |                        0.10 |
| two-words-joined           |             1.00 |                        1.00 |
| two-words-typo             |             0.00 |                        0.00 |
| two-words-typo-second      |             0.00 |                        0.00 |
| two-words-typo-reversed    |             0.00 |                        0.00 |
| plural-to-singular         |             0.90 |                        0.90 |
| short-word-typo            |             0.20 |                        0.20 |
| prefix                     |             1.00 |                        1.00 |
| infix                      |             1.00 |                        1.00 |
| scatter-light              |             0.95 |                        0.95 |
| scatter-medium             |             0.80 |                        0.80 |
| scatter-heavy              |             0.10 |                        0.10 |
| transposition              |             0.15 |                        0.15 |
| insertion                  |             0.10 |                        0.10 |
| substitution               |             0.00 |                        0.00 |
| acronym                    |             0.31 |                        0.31 |
| accent-stripped            |             1.00 |                        1.00 |
<!-- bench:end -->
