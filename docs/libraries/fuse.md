# Fuse.js

Every configuration of Fuse.js the bench runs, over the same corpora and queries as [the benchmarks](../benchmarks.md).
The headline tables there show whichever scores best on those benchmarks, which makes it the configuration tuned to the tests it is ranked on.
That row is in bold in the scorecard below.

- **Fuse.js**: the defaults, `new Fuse(list)`.
- **Fuse.js (all opts)**: adds `includeMatches` for ranges, `ignoreDiacritics` for folding, and `useExtendedSearch`, which turns space-separated terms into an AND of fuzzy patterns in any order.
- **Fuse.js (tuned)**: all opts with `threshold` 0.45 rather than the default 0.6, chosen by a sweep against an earlier version of this bench.

## The threshold

Tuned differs from all opts only in `threshold`, so the two rows below isolate it.
MRR is unrounded, so the ties the two-decimal tables show are broken; rows are the median, across the scored families, of each family's median result-set size (`medianRows` in [`bench/results.json`](../../bench/results.json)); junk is the scorecard's.

| `threshold` | MRR en / native / emoji | rows en / native / emoji | junk en / native / emoji |
|---|--:|--:|--:|
| 0.6 (default, all opts) | 0.755 / 0.753 / 0.670 | 551 / 387 / 114 | 0.95 / 0.91 / 0.85 |
| **0.45 (tuned)** | **0.758 / 0.757 / 0.713** | **32 / 31 / 8** | **0.46 / 0.47 / 0.35** |

At 0.45 Fuse.js scores higher on every corpus, most on emoji, returns 6–8% of the rows, and answers 41–52% as many of the queries nothing answers.

## Scorecard

The columns are [the scorecard's](../benchmarks.md#scorecard).

**native corpus:**

<!-- bench:library-fuse-scorecard-native -->
| Library             |  MRR | Junk | index ms | cold ms | batch ms | batch/query |
|---------------------|-----:|-----:|---------:|--------:|---------:|------------:|
| **Fuse.js (tuned)** | 0.76 |  47% |     1.12 |   15.11 |   275.07 |       10.78 |
| Fuse.js (all opts)  | 0.75 |  91% |     1.10 |   17.88 |   350.38 |       13.78 |
| Fuse.js             | 0.72 |  99% |     1.09 |   15.39 |   392.96 |       15.76 |
<!-- bench:end -->

**en corpus:**

<!-- bench:library-fuse-scorecard-en -->
| Library             |  MRR | Junk | index ms | cold ms | batch ms | batch/query |
|---------------------|-----:|-----:|---------:|--------:|---------:|------------:|
| **Fuse.js (tuned)** | 0.76 |  46% |     1.06 |   13.80 |   238.62 |        9.33 |
| Fuse.js (all opts)  | 0.76 |  95% |     1.07 |   16.07 |   297.63 |       11.67 |
| Fuse.js             | 0.72 | 100% |     1.06 |   13.40 |   323.42 |       12.92 |
<!-- bench:end -->

**emoji corpus** (quality only; the list is too short for the timing cells):

<!-- bench:library-fuse-scorecard-emoji -->
| Library             |  MRR | Junk | index ms | cold ms | batch ms | batch/query |
|---------------------|-----:|-----:|---------:|--------:|---------:|------------:|
| **Fuse.js (tuned)** | 0.71 |  35% |        — |       — |        — |           — |
| Fuse.js (all opts)  | 0.67 |  85% |        — |       — |        — |           — |
| Fuse.js             | 0.65 |  92% |        — |       — |        — |           — |
<!-- bench:end -->

## Speed at 100k

The columns are [the speed tables'](../benchmarks.md#size-speed--search-type), at 100k, with Ekrina as the 100% row.
The native tables list only the configurations that fold diacritics, so base Fuse.js, which doesn't, is timed on en only; the emoji corpus is too short to time.

**en corpus:**

<!-- bench:library-fuse-speed-en -->
| Library            |   index | cold query |     total | total rel |
|--------------------|--------:|-----------:|----------:|----------:|
| **Ekrina**         | 0.32 ms |    7.82 ms |   8.14 ms |  **100%** |
| Fuse.js            | 4.90 ms |  108.26 ms | 113.13 ms |     1390% |
| Fuse.js (all opts) | 4.90 ms |  124.71 ms | 129.56 ms |     1592% |
| Fuse.js (tuned)    | 4.84 ms |   99.10 ms | 104.03 ms |     1279% |
<!-- bench:end -->

<!-- bench:library-fuse-batch-en -->
| Library            | batch/query | batch total | batch rel |
|--------------------|------------:|------------:|----------:|
| **Ekrina**         |     1.79 ms |    47.52 ms |  **100%** |
| Fuse.js            |   132.29 ms |  3270.20 ms |     6881% |
| Fuse.js (all opts) |   119.36 ms |  2995.94 ms |     6304% |
| Fuse.js (tuned)    |    94.65 ms |  2373.62 ms |     4995% |
<!-- bench:end -->

**native corpus:**

<!-- bench:library-fuse-speed-native -->
| Library            |   index | cold query |     total | total rel |
|--------------------|--------:|-----------:|----------:|----------:|
| **Ekrina**         | 0.31 ms |   10.05 ms |  10.37 ms |  **100%** |
| Fuse.js (all opts) | 5.34 ms |  140.99 ms | 146.28 ms |     1410% |
| Fuse.js (tuned)    | 5.36 ms |  113.96 ms | 119.34 ms |     1150% |
<!-- bench:end -->

<!-- bench:library-fuse-batch-native -->
| Library            | batch/query | batch total | batch rel |
|--------------------|------------:|------------:|----------:|
| **Ekrina**         |     2.16 ms |    57.54 ms |  **100%** |
| Fuse.js (all opts) |   139.96 ms |  3502.74 ms |     6087% |
| Fuse.js (tuned)    |   111.11 ms |  2784.82 ms |     4839% |
<!-- bench:end -->

## Match quality, by query family

MRR@10 per family, scored as in [Match quality, by query family](../benchmarks.md#match-quality-by-query-family).

**native corpus:**

<!-- bench:library-fuse-families-native -->
| Group         | Family                        | Fuse.js | Fuse.js (all opts) | Fuse.js (tuned) |
|---------------|-------------------------------|--------:|-------------------:|----------------:|
| typos         | neighbouring key              |    0.72 |               0.72 |            0.76 |
| typos         | two neighbouring keys         |    0.80 |               0.82 |            0.87 |
| typos         | random letter                 |    0.83 |               0.83 |            0.83 |
| typos         | dropped letter                |    0.66 |               0.71 |            0.71 |
| typos         | two dropped letters           |    0.33 |               0.33 |            0.34 |
| typos         | inserted neighbouring key     |    0.92 |               0.92 |            0.92 |
| typos         | swapped neighbours            |    0.48 |               0.48 |            0.48 |
| typos         | stuck key                     |    0.65 |               0.65 |            0.66 |
| typos         | first letter wrong            |    0.71 |               0.71 |            0.71 |
| typos         | typo in each of two words     |    1.00 |               0.95 |            1.00 |
| typos         | typo then a half-typed word   |    1.00 |               0.95 |            1.00 |
| typos         | two words joined, with a typo |    0.97 |               0.97 |            0.97 |
| phonetic      | consonant spelt another way   |    0.78 |               0.78 |            0.78 |
| phonetic      | letter doubled or singled     |    0.77 |               0.80 |            0.80 |
| phonetic      | silent letters dropped        |    0.47 |               0.47 |            0.47 |
| phonetic      | vowel sound spelt another way |    0.58 |               0.57 |            0.57 |
| partial words | prefix of 3                   |    0.90 |               1.00 |            1.00 |
| partial words | prefix of 5                   |    0.95 |               0.95 |            0.95 |
| partial words | infix of 5                    |    0.93 |               0.93 |            0.93 |
| partial words | two words half typed          |    0.23 |               1.00 |            1.00 |
| partial words | a vowel dropped               |    0.70 |               0.70 |            0.70 |
| partial words | 2 vowels dropped              |    0.38 |               0.38 |            0.43 |
| query shape   | two words                     |    1.00 |               1.00 |            1.00 |
| query shape   | two words reversed            |    0.12 |               1.00 |            1.00 |
| query shape   | two words joined              |    0.90 |               0.90 |            0.90 |
| query shape   | an absent word added          |    1.00 |               0.10 |            0.00 |
| noise         | space inside a word           |    0.83 |               1.00 |            1.00 |
| noise         | punctuation inside a word     |    0.83 |               0.83 |            0.83 |
| noise         | accents stripped              |    0.51 |               0.88 |            0.88 |
| noise         | accents added                 |    0.95 |               1.00 |            1.00 |
| reported only | acronym                       |    0.02 |               0.02 |            0.00 |
| reported only | plural for a singular         |    0.90 |               0.88 |            0.88 |
| phonetic      | real misspelling              |    0.59 |               0.58 |            0.58 |
<!-- bench:end -->

**en corpus:**

<!-- bench:library-fuse-families-en -->
| Group         | Family                        | Fuse.js | Fuse.js (all opts) | Fuse.js (tuned) |
|---------------|-------------------------------|--------:|-------------------:|----------------:|
| typos         | neighbouring key              |    0.90 |               0.90 |            0.90 |
| typos         | two neighbouring keys         |    0.86 |               0.86 |            0.95 |
| typos         | random letter                 |    0.81 |               0.81 |            0.81 |
| typos         | dropped letter                |    0.73 |               0.73 |            0.73 |
| typos         | two dropped letters           |    0.41 |               0.41 |            0.41 |
| typos         | inserted neighbouring key     |    0.85 |               0.85 |            0.85 |
| typos         | swapped neighbours            |    0.48 |               0.48 |            0.48 |
| typos         | stuck key                     |    0.68 |               0.68 |            0.68 |
| typos         | first letter wrong            |    0.80 |               0.80 |            0.80 |
| typos         | typo in each of two words     |    1.00 |               0.95 |            1.00 |
| typos         | typo then a half-typed word   |    1.00 |               1.00 |            1.00 |
| typos         | two words joined, with a typo |    0.97 |               0.97 |            0.97 |
| phonetic      | consonant spelt another way   |    0.63 |               0.63 |            0.65 |
| phonetic      | letter doubled or singled     |    0.79 |               0.83 |            0.83 |
| phonetic      | silent letters dropped        |    0.48 |               0.48 |            0.48 |
| phonetic      | vowel sound spelt another way |    0.47 |               0.44 |            0.44 |
| partial words | prefix of 3                   |    0.90 |               1.00 |            1.00 |
| partial words | prefix of 5                   |    1.00 |               1.00 |            1.00 |
| partial words | infix of 5                    |    0.92 |               0.92 |            0.92 |
| partial words | two words half typed          |    0.23 |               1.00 |            1.00 |
| partial words | a vowel dropped               |    0.76 |               0.76 |            0.76 |
| partial words | 2 vowels dropped              |    0.30 |               0.30 |            0.35 |
| query shape   | two words                     |    1.00 |               1.00 |            1.00 |
| query shape   | two words reversed            |    0.11 |               1.00 |            1.00 |
| query shape   | two words joined              |    1.00 |               1.00 |            1.00 |
| query shape   | an absent word added          |    1.00 |               0.10 |            0.00 |
| noise         | space inside a word           |    0.83 |               1.00 |            1.00 |
| noise         | punctuation inside a word     |    0.82 |               0.82 |            0.82 |
| noise         | accents stripped              |    0.47 |               0.85 |            0.85 |
| noise         | accents added                 |    0.93 |               0.97 |            0.97 |
| reported only | acronym                       |    0.00 |               0.00 |            0.00 |
| reported only | plural for a singular         |    0.73 |               0.71 |            0.71 |
| phonetic      | real misspelling              |    0.57 |               0.57 |            0.57 |
<!-- bench:end -->

**emoji corpus:**

<!-- bench:library-fuse-families-emoji -->
| Group         | Family                        | Fuse.js | Fuse.js (all opts) | Fuse.js (tuned) |
|---------------|-------------------------------|--------:|-------------------:|----------------:|
| typos         | neighbouring key              |    0.76 |               0.76 |            0.76 |
| typos         | two neighbouring keys         |    0.52 |               0.55 |            0.58 |
| typos         | random letter                 |    0.79 |               0.79 |            0.79 |
| typos         | dropped letter                |    0.45 |               0.45 |            0.46 |
| typos         | two dropped letters           |    0.40 |               0.40 |            0.49 |
| typos         | inserted neighbouring key     |    0.79 |               0.79 |            0.87 |
| typos         | swapped neighbours            |    0.41 |               0.41 |            0.44 |
| typos         | stuck key                     |    0.70 |               0.70 |            0.81 |
| typos         | first letter wrong            |    0.59 |               0.59 |            0.78 |
| typos         | typo in each of two words     |    1.00 |               0.93 |            1.00 |
| typos         | typo then a half-typed word   |    0.95 |               0.92 |            0.95 |
| typos         | two words joined, with a typo |    0.80 |               0.80 |            0.81 |
| phonetic      | consonant spelt another way   |    0.80 |               0.80 |            0.85 |
| phonetic      | letter doubled or singled     |    0.69 |               0.69 |            0.70 |
| phonetic      | silent letters dropped        |    0.24 |               0.24 |            0.27 |
| phonetic      | vowel sound spelt another way |    0.39 |               0.39 |            0.45 |
| partial words | prefix of 3                   |    0.67 |               0.67 |            0.67 |
| partial words | prefix of 5                   |    0.90 |               0.90 |            0.90 |
| partial words | infix of 5                    |    0.66 |               0.66 |            0.66 |
| partial words | two words half typed          |    0.26 |               0.95 |            0.95 |
| partial words | a vowel dropped               |    0.70 |               0.70 |            0.72 |
| partial words | 2 vowels dropped              |    0.48 |               0.48 |            0.50 |
| query shape   | two words                     |    1.00 |               1.00 |            1.00 |
| query shape   | two words reversed            |    0.22 |               1.00 |            1.00 |
| query shape   | two words joined              |    0.90 |               0.90 |            0.95 |
| query shape   | an absent word added          |    0.95 |               0.00 |            0.00 |
| noise         | space inside a word           |    0.91 |               0.93 |            1.00 |
| noise         | punctuation inside a word     |    0.93 |               0.95 |            1.00 |
| noise         | accents stripped              |    0.21 |               0.59 |            0.74 |
| noise         | accents added                 |    0.91 |               1.00 |            1.00 |
| reported only | acronym                       |    0.00 |               0.00 |            0.00 |
| reported only | plural for a singular         |    0.82 |               0.82 |            0.87 |
| phonetic      | real misspelling              |    0.47 |               0.47 |            0.60 |
<!-- bench:end -->
