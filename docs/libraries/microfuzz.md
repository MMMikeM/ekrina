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
| **@nozbe/microfuzz**        | 0.52 |     3.71 |    1.41 |    30.06 |        1.19 |
| @nozbe/microfuzz (all opts) | 0.52 |     3.77 |    1.43 |    30.05 |        1.19 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:library-microfuzz-scorecard-ascii -->
| Library                     |  MRR | index ms | cold ms | batch ms | batch/query |
|-----------------------------|-----:|---------:|--------:|---------:|------------:|
| **@nozbe/microfuzz**        | 0.53 |     3.49 |    1.35 |    28.39 |        1.13 |
| @nozbe/microfuzz (all opts) | 0.53 |     3.66 |    1.32 |    28.59 |        1.13 |
<!-- bench:end -->

## Speed at 100k

The columns are [the speed tables'](../benchmarks.md#size-speed--search-type), at 100k, with base Ekrina as the 100% row.

**ascii corpus:**

<!-- bench:library-microfuzz-speed-ascii -->
| Library                     |    index | cold query |    total | total rel |
|-----------------------------|---------:|-----------:|---------:|----------:|
| **Ekrina**                  |  0.36 ms |   12.41 ms | 12.74 ms |  **100%** |
| @nozbe/microfuzz            | 41.49 ms |   19.23 ms | 61.74 ms |      485% |
| @nozbe/microfuzz (all opts) | 40.83 ms |   19.72 ms | 62.79 ms |      493% |
<!-- bench:end -->

<!-- bench:library-microfuzz-batch-ascii -->
| Library                     | batch/query | batch total | batch rel |
|-----------------------------|------------:|------------:|----------:|
| **Ekrina**                  |     2.51 ms |    64.52 ms |  **100%** |
| @nozbe/microfuzz            |     8.39 ms |   217.56 ms |      337% |
| @nozbe/microfuzz (all opts) |     8.47 ms |   219.38 ms |      340% |
<!-- bench:end -->

**mixed corpus:**

<!-- bench:library-microfuzz-speed-mixed -->
| Library                     |    index | cold query |    total | total rel |
|-----------------------------|---------:|-----------:|---------:|----------:|
| **Ekrina**                  |  0.35 ms |   19.22 ms | 19.57 ms |  **100%** |
| @nozbe/microfuzz            | 42.18 ms |   20.89 ms | 62.86 ms |      321% |
| @nozbe/microfuzz (all opts) | 41.60 ms |   19.04 ms | 61.32 ms |      313% |
<!-- bench:end -->

<!-- bench:library-microfuzz-batch-mixed -->
| Library                     | batch/query | batch total | batch rel |
|-----------------------------|------------:|------------:|----------:|
| **Ekrina**                  |     2.43 ms |    63.47 ms |  **100%** |
| @nozbe/microfuzz            |    13.81 ms |   351.99 ms |      555% |
| @nozbe/microfuzz (all opts) |    13.80 ms |   351.90 ms |      554% |
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
