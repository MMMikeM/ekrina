# Fuse.js

Every configuration of Fuse.js the bench runs, over the same corpora and queries as [the benchmarks](../benchmarks.md).
The headline tables there show whichever scores best on those benchmarks, which makes it the configuration tuned to the tests it is ranked on.
That row is in bold in the scorecard below.

- **Fuse.js**: the defaults, `new Fuse(list)`.
- **Fuse.js (all opts)**: adds `includeMatches` for ranges, `ignoreDiacritics` for folding, and `useExtendedSearch`, which turns space-separated terms into an AND of fuzzy patterns in any order.
- **Fuse.js (tuned)**: all opts with `threshold` 0.5 rather than the default 0.6, the best setting of the sweep below.

## The threshold sweep

Every setting below is all opts with `threshold` changed, each run once as its own configuration in `bench/configs.ts` through `pnpm bench --quality`.
MRR is unrounded, so the ties the two-decimal tables show are broken; rows are the median, across the scored families, of each family's median result-set size; the last column is the median rows for the double typo `handcxafted wooxen`, which should return nothing.

| `threshold` | MRR mixed / ascii | rows mixed / ascii | double typo rows mixed / ascii |
|---|--:|--:|--:|
| 0.6 (default) | 0.806 / 0.794 | 566 / 499 | 36 / 31 |
| **0.5** | **0.808 / 0.794** | **144 / 116** | **3 / 4** |
| 0.4 | 0.802 / 0.791 | 23 / 24 | 1 / 1 |
| 0.3 | 0.799 / 0.766 | 7 / 13 | 1 / 1 |
| 0.2 | 0.71 / 0.68 | 1 / 1 | 0 / 0 |

Turning `ignoreLocation` on never raised MRR at any threshold, and at 0.6 it took the median to 993 rows on mixed.

## Scorecard

The columns are [the scorecard's](../benchmarks.md#scorecard).

**mixed corpus:**

<!-- bench:library-fuse-scorecard-mixed -->
| Library             |  MRR | index ms | cold ms | batch ms | batch/query |
|---------------------|-----:|---------:|--------:|---------:|------------:|
| **Fuse.js (tuned)** | 0.81 |     1.25 |   15.90 |   378.54 |       15.21 |
| Fuse.js (all opts)  | 0.81 |     1.23 |   17.99 |   448.45 |       18.06 |
| Fuse.js             | 0.69 |     1.26 |   18.34 |   610.05 |       24.93 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:library-fuse-scorecard-ascii -->
| Library             |  MRR | index ms | cold ms | batch ms | batch/query |
|---------------------|-----:|---------:|--------:|---------:|------------:|
| **Fuse.js (tuned)** | 0.79 |     1.17 |   16.39 |   354.10 |       14.04 |
| Fuse.js (all opts)  | 0.79 |     1.18 |   19.07 |   423.02 |       16.84 |
| Fuse.js             | 0.67 |     1.16 |   17.34 |   528.73 |       21.39 |
<!-- bench:end -->

## Speed at 100k

The columns are [the speed tables'](../benchmarks.md#size-speed--search-type), at 100k, with base Ekrina as the 100% row.
The mixed tables list only the configurations that fold diacritics, so the base row is on ascii only.

**ascii corpus:**

<!-- bench:library-fuse-speed-ascii -->
| Library            |   index | cold query |     total | total rel |
|--------------------|--------:|-----------:|----------:|----------:|
| **Ekrina**         | 0.36 ms |   12.41 ms |  12.74 ms |  **100%** |
| Fuse.js            | 5.40 ms |  157.47 ms | 162.82 ms |     1278% |
| Fuse.js (all opts) | 5.86 ms |  163.55 ms | 169.03 ms |     1327% |
| Fuse.js (tuned)    | 5.83 ms |  144.01 ms | 149.39 ms |     1173% |
<!-- bench:end -->

<!-- bench:library-fuse-batch-ascii -->
| Library            | batch/query | batch total | batch rel |
|--------------------|------------:|------------:|----------:|
| **Ekrina**         |     2.51 ms |    64.52 ms |  **100%** |
| Fuse.js            |   208.51 ms |  5140.51 ms |     7967% |
| Fuse.js (all opts) |   173.09 ms |  4325.07 ms |     6703% |
| Fuse.js (tuned)    |   142.05 ms |  3558.08 ms |     5515% |
<!-- bench:end -->

**mixed corpus:**

<!-- bench:library-fuse-speed-mixed -->
| Library            |   index | cold query |     total | total rel |
|--------------------|--------:|-----------:|----------:|----------:|
| **Ekrina**         | 0.35 ms |   19.22 ms |  19.57 ms |  **100%** |
| Fuse.js (all opts) | 5.21 ms |  155.26 ms | 160.63 ms |      821% |
| Fuse.js (tuned)    | 5.27 ms |  135.45 ms | 140.80 ms |      720% |
<!-- bench:end -->

<!-- bench:library-fuse-batch-mixed -->
| Library            | batch/query | batch total | batch rel |
|--------------------|------------:|------------:|----------:|
| **Ekrina**         |     2.43 ms |    63.47 ms |  **100%** |
| Fuse.js (all opts) |   177.82 ms |  4393.84 ms |     6922% |
| Fuse.js (tuned)    |   146.99 ms |  3634.87 ms |     5727% |
<!-- bench:end -->

## Match quality, by query family

MRR@10 per family, scored as in [Match quality, by query family](../benchmarks.md#match-quality-by-query-family).

**mixed corpus:**

<!-- bench:library-fuse-families-mixed -->
| Family                     | Fuse.js | Fuse.js (all opts) | Fuse.js (tuned) |
|----------------------------|--------:|-------------------:|----------------:|
| long-word                  |    0.97 |               0.97 |            0.97 |
| short-word                 |    0.81 |               0.81 |            0.81 |
| two-words                  |    1.00 |               1.00 |            1.00 |
| two-words-reversed         |    0.07 |               1.00 |            1.00 |
| two-words-partial-reversed |    0.42 |               1.00 |            1.00 |
| two-words-joined           |    1.00 |               1.00 |            1.00 |
| two-words-typo             |    1.00 |               1.00 |            1.00 |
| two-words-typo-second      |    1.00 |               1.00 |            1.00 |
| two-words-typo-reversed    |    0.14 |               1.00 |            1.00 |
| plural-to-singular         |    0.82 |               0.79 |            0.79 |
| short-word-typo            |    0.22 |               0.21 |            0.21 |
| prefix                     |    1.00 |               1.00 |            1.00 |
| infix                      |    1.00 |               1.00 |            1.00 |
| scatter-light              |    0.95 |               0.95 |            0.95 |
| scatter-medium             |    0.35 |               0.35 |            0.40 |
| scatter-heavy              |    0.00 |               0.00 |            0.00 |
| transposition              |    0.93 |               0.86 |            0.86 |
| insertion                  |    1.00 |               1.00 |            1.00 |
| substitution               |    0.98 |               0.98 |            0.98 |
| acronym                    |    0.00 |               0.00 |            0.00 |
| accent-stripped            |    0.79 |               1.00 |            1.00 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:library-fuse-families-ascii -->
| Family                     | Fuse.js | Fuse.js (all opts) | Fuse.js (tuned) |
|----------------------------|--------:|-------------------:|----------------:|
| long-word                  |    0.91 |               0.91 |            0.91 |
| short-word                 |    0.65 |               0.65 |            0.65 |
| two-words                  |    1.00 |               1.00 |            1.00 |
| two-words-reversed         |    0.16 |               1.00 |            1.00 |
| two-words-partial-reversed |    0.27 |               0.93 |            0.93 |
| two-words-joined           |    1.00 |               1.00 |            1.00 |
| two-words-typo             |    0.97 |               1.00 |            1.00 |
| two-words-typo-second      |    1.00 |               1.00 |            1.00 |
| two-words-typo-reversed    |    0.19 |               1.00 |            1.00 |
| plural-to-singular         |    0.97 |               0.97 |            0.97 |
| short-word-typo            |    0.54 |               0.54 |            0.54 |
| prefix                     |    1.00 |               1.00 |            1.00 |
| infix                      |    1.00 |               1.00 |            1.00 |
| scatter-light              |    0.92 |               0.92 |            0.92 |
| scatter-medium             |    0.38 |               0.38 |            0.38 |
| scatter-heavy              |    0.00 |               0.00 |            0.00 |
| transposition              |    0.92 |               0.92 |            0.92 |
| insertion                  |    0.82 |               0.82 |            0.82 |
| substitution               |    0.98 |               0.98 |            0.98 |
| acronym                    |    0.00 |               0.00 |            0.00 |
| accent-stripped            |    0.44 |               0.63 |            0.63 |
<!-- bench:end -->
