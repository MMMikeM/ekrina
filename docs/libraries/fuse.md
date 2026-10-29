# Fuse.js

Every configuration of Fuse.js the bench runs, over the same corpora and queries as [the benchmarks](../benchmarks.md).
The headline tables there show whichever scores best on those benchmarks, which makes it the configuration tuned to the tests it is ranked on.
That row is in bold in the scorecard below.

- **Fuse.js**: the defaults, `new Fuse(list)`.
- **Fuse.js (all opts)**: adds `includeMatches` for ranges, `ignoreDiacritics` for folding, and `useExtendedSearch`, which turns space-separated terms into an AND of fuzzy patterns in any order.

## Scorecard

The columns are [the scorecard's](../benchmarks.md#scorecard).

**mixed corpus:**

<!-- bench:library-fuse-scorecard-mixed -->
| Library                |  MRR | index ms | cold ms | batch ms | batch/query |
|------------------------|-----:|---------:|--------:|---------:|------------:|
| **Fuse.js (all opts)** | 0.81 |     1.45 |   19.41 |   525.87 |       21.12 |
| Fuse.js                | 0.69 |     1.26 |   17.25 |   664.00 |       27.10 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:library-fuse-scorecard-ascii -->
| Library                |  MRR | index ms | cold ms | batch ms | batch/query |
|------------------------|-----:|---------:|--------:|---------:|------------:|
| **Fuse.js (all opts)** | 0.79 |     1.21 |   20.78 |   456.12 |       18.19 |
| Fuse.js                | 0.67 |     1.15 |   18.49 |   547.47 |       22.16 |
<!-- bench:end -->

## Speed at 100k

The columns are [the speed tables'](../benchmarks.md#size-speed--search-type), at 100k, with base Ekrina as the 100% row.
Only the ascii corpus is shown, because the mixed tables list only configurations that fold diacritics, and at most one of this library's does.

**ascii corpus:**

<!-- bench:library-fuse-speed-ascii -->
| Library            |   index | cold query |     total | total rel |
|--------------------|--------:|-----------:|----------:|----------:|
| **Ekrina**         | 0.34 ms |   12.83 ms |  13.13 ms |  **100%** |
| Fuse.js            | 5.70 ms |  184.18 ms | 190.32 ms |     1449% |
| Fuse.js (all opts) | 6.14 ms |  181.55 ms | 187.57 ms |     1428% |
<!-- bench:end -->

<!-- bench:library-fuse-batch-ascii -->
| Library            | batch/query | batch total | batch rel |
|--------------------|------------:|------------:|----------:|
| **Ekrina**         |     3.00 ms |    76.65 ms |  **100%** |
| Fuse.js            |   230.35 ms |  5671.12 ms |     7399% |
| Fuse.js (all opts) |   173.15 ms |  4325.99 ms |     5644% |
<!-- bench:end -->

## Match quality, by query family

MRR@10 per family, scored as in [Match quality, by query family](../benchmarks.md#match-quality-by-query-family).

**mixed corpus:**

<!-- bench:library-fuse-families-mixed -->
| Family                     | Fuse.js | Fuse.js (all opts) |
|----------------------------|--------:|-------------------:|
| long-word                  |    0.97 |               0.97 |
| short-word                 |    0.81 |               0.81 |
| two-words                  |    1.00 |               1.00 |
| two-words-reversed         |    0.07 |               1.00 |
| two-words-partial-reversed |    0.42 |               1.00 |
| two-words-joined           |    1.00 |               1.00 |
| two-words-typo             |    1.00 |               1.00 |
| two-words-typo-second      |    1.00 |               1.00 |
| two-words-typo-reversed    |    0.14 |               1.00 |
| plural-to-singular         |    0.82 |               0.79 |
| short-word-typo            |    0.22 |               0.21 |
| prefix                     |    1.00 |               1.00 |
| infix                      |    1.00 |               1.00 |
| scatter-light              |    0.95 |               0.95 |
| scatter-medium             |    0.35 |               0.35 |
| scatter-heavy              |    0.00 |               0.00 |
| transposition              |    0.93 |               0.86 |
| insertion                  |    1.00 |               1.00 |
| substitution               |    0.98 |               0.98 |
| acronym                    |    0.00 |               0.00 |
| accent-stripped            |    0.79 |               1.00 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:library-fuse-families-ascii -->
| Family                     | Fuse.js | Fuse.js (all opts) |
|----------------------------|--------:|-------------------:|
| long-word                  |    0.91 |               0.91 |
| short-word                 |    0.65 |               0.65 |
| two-words                  |    1.00 |               1.00 |
| two-words-reversed         |    0.16 |               1.00 |
| two-words-partial-reversed |    0.27 |               0.93 |
| two-words-joined           |    1.00 |               1.00 |
| two-words-typo             |    0.97 |               1.00 |
| two-words-typo-second      |    1.00 |               1.00 |
| two-words-typo-reversed    |    0.19 |               1.00 |
| plural-to-singular         |    0.97 |               0.97 |
| short-word-typo            |    0.54 |               0.54 |
| prefix                     |    1.00 |               1.00 |
| infix                      |    1.00 |               1.00 |
| scatter-light              |    0.92 |               0.92 |
| scatter-medium             |    0.38 |               0.38 |
| scatter-heavy              |    0.00 |               0.00 |
| transposition              |    0.92 |               0.92 |
| insertion                  |    0.82 |               0.82 |
| substitution               |    0.98 |               0.98 |
| acronym                    |    0.00 |               0.00 |
| accent-stripped            |    0.44 |               0.63 |
<!-- bench:end -->
