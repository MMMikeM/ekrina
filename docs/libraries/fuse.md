# Fuse.js

Every configuration of Fuse.js the bench runs, over the same corpora and queries as [the benchmarks](../benchmarks.md).
The headline tables there show whichever scores best on those benchmarks, which makes it the configuration tuned to the tests it is ranked on.
That row is in bold in the scorecard below.

- **Fuse.js**: the defaults, `new Fuse(list)`.
- **Fuse.js (all opts)**: adds `includeMatches` for ranges, `ignoreDiacritics` for folding, and `useExtendedSearch`, which turns space-separated terms into an AND of fuzzy patterns in any order.
- **Fuse.js (tuned)**: all opts with `threshold` <!-- bench:{{ constant("0.45") }} -->0.45<!-- bench:end --> rather than the default 0.6, chosen by a sweep against an earlier version of this bench.

## The threshold

Tuned differs from all opts only in `threshold`, so the two rows below isolate it.
MRR is unrounded, so the ties the two-decimal tables show are broken; rows are the median, across the scored families, of each family's median result-set size (`medianRows` in [`bench/results.json`](../../bench/results.json)); junk is the scorecard's.

| `threshold` | MRR en / native / emoji | rows en / native / emoji | junk en / native / emoji |
|---|--:|--:|--:|
| 0.6 (default, all opts) | <!-- bench:{{ fixed(headlineMrr("en", "fuse.js (all opts)"), 3) }} -->0.755<!-- bench:end --> / <!-- bench:{{ fixed(headlineMrr("native", "fuse.js (all opts)"), 3) }} -->0.753<!-- bench:end --> / <!-- bench:{{ fixed(headlineMrr("emoji", "fuse.js (all opts)"), 3) }} -->0.670<!-- bench:end --> | <!-- bench:{{ medianRows("en", "fuse.js (all opts)") }} -->551<!-- bench:end --> / <!-- bench:{{ medianRows("native", "fuse.js (all opts)") }} -->387<!-- bench:end --> / <!-- bench:{{ medianRows("emoji", "fuse.js (all opts)") }} -->114<!-- bench:end --> | <!-- bench:{{ fixed(div(n("library-fuse-scorecard-en", "Fuse.js (all opts)", "Junk"), 100), 2) }} -->0.95<!-- bench:end --> / <!-- bench:{{ fixed(div(n("library-fuse-scorecard-native", "Fuse.js (all opts)", "Junk"), 100), 2) }} -->0.91<!-- bench:end --> / <!-- bench:{{ fixed(div(n("library-fuse-scorecard-emoji", "Fuse.js (all opts)", "Junk"), 100), 2) }} -->0.85<!-- bench:end --> |
| **<!-- bench:{{ constant("0.45") }} -->0.45<!-- bench:end --> (tuned)** | **<!-- bench:{{ fixed(headlineMrr("en", "fuse.js (tuned)"), 3) }} -->0.758<!-- bench:end --> / <!-- bench:{{ fixed(headlineMrr("native", "fuse.js (tuned)"), 3) }} -->0.757<!-- bench:end --> / <!-- bench:{{ fixed(headlineMrr("emoji", "fuse.js (tuned)"), 3) }} -->0.713<!-- bench:end -->** | **<!-- bench:{{ medianRows("en", "fuse.js (tuned)") }} -->32<!-- bench:end --> / <!-- bench:{{ medianRows("native", "fuse.js (tuned)") }} -->31<!-- bench:end --> / <!-- bench:{{ medianRows("emoji", "fuse.js (tuned)") }} -->8<!-- bench:end -->** | **<!-- bench:{{ fixed(div(n("library-fuse-scorecard-en", "Fuse.js (tuned)", "Junk"), 100), 2) }} -->0.46<!-- bench:end --> / <!-- bench:{{ fixed(div(n("library-fuse-scorecard-native", "Fuse.js (tuned)", "Junk"), 100), 2) }} -->0.47<!-- bench:end --> / <!-- bench:{{ fixed(div(n("library-fuse-scorecard-emoji", "Fuse.js (tuned)", "Junk"), 100), 2) }} -->0.35<!-- bench:end -->** |

At <!-- bench:{{ constant("0.45") }} -->0.45<!-- bench:end --> Fuse.js scores higher on every corpus, most on emoji, returns <!-- bench:{{ span(mul(min(div(medianRows("en", "fuse.js (tuned)"), medianRows("en", "fuse.js (all opts)")), div(medianRows("native", "fuse.js (tuned)"), medianRows("native", "fuse.js (all opts)")), div(medianRows("emoji", "fuse.js (tuned)"), medianRows("emoji", "fuse.js (all opts)"))), 100), mul(max(div(medianRows("en", "fuse.js (tuned)"), medianRows("en", "fuse.js (all opts)")), div(medianRows("native", "fuse.js (tuned)"), medianRows("native", "fuse.js (all opts)")), div(medianRows("emoji", "fuse.js (tuned)"), medianRows("emoji", "fuse.js (all opts)"))), 100), 0, "%") }} -->6–8%<!-- bench:end --> of the rows, and answers <!-- bench:{{ span(mul(min(div(n("library-fuse-scorecard-en", "Fuse.js (tuned)", "Junk"), n("library-fuse-scorecard-en", "Fuse.js (all opts)", "Junk")), div(n("library-fuse-scorecard-native", "Fuse.js (tuned)", "Junk"), n("library-fuse-scorecard-native", "Fuse.js (all opts)", "Junk")), div(n("library-fuse-scorecard-emoji", "Fuse.js (tuned)", "Junk"), n("library-fuse-scorecard-emoji", "Fuse.js (all opts)", "Junk"))), 100), mul(max(div(n("library-fuse-scorecard-en", "Fuse.js (tuned)", "Junk"), n("library-fuse-scorecard-en", "Fuse.js (all opts)", "Junk")), div(n("library-fuse-scorecard-native", "Fuse.js (tuned)", "Junk"), n("library-fuse-scorecard-native", "Fuse.js (all opts)", "Junk")), div(n("library-fuse-scorecard-emoji", "Fuse.js (tuned)", "Junk"), n("library-fuse-scorecard-emoji", "Fuse.js (all opts)", "Junk"))), 100), 0, "%") }} -->41–52%<!-- bench:end --> as many of the queries nothing answers.<!-- bench:{{ assert(gt(min(sub(headlineMrr("en", "fuse.js (tuned)"), headlineMrr("en", "fuse.js (all opts)")), sub(headlineMrr("native", "fuse.js (tuned)"), headlineMrr("native", "fuse.js (all opts)")), sub(headlineMrr("emoji", "fuse.js (tuned)"), headlineMrr("emoji", "fuse.js (all opts)"))), 0), "tuned Fuse.js scores higher than all opts on every corpus") }} --><!-- bench:end --><!-- bench:{{ assert(gt(sub(headlineMrr("emoji", "fuse.js (tuned)"), headlineMrr("emoji", "fuse.js (all opts)")), max(sub(headlineMrr("en", "fuse.js (tuned)"), headlineMrr("en", "fuse.js (all opts)")), sub(headlineMrr("native", "fuse.js (tuned)"), headlineMrr("native", "fuse.js (all opts)")))), "tuned Fuse.js gains most on emoji") }} --><!-- bench:end -->

## Scorecard

The columns are [the scorecard's](../benchmarks.md#scorecard).

**native corpus:**

<!-- bench:library-fuse-scorecard-native -->
| Library             |  MRR | Junk | index ms | cold ms | session ms | per query |
|---------------------|-----:|-----:|---------:|--------:|-----------:|----------:|
| **Fuse.js (tuned)** | 0.76 |  47% |     1.11 |   14.98 |     278.14 |     10.92 |
| Fuse.js (all opts)  | 0.75 |  91% |     1.11 |   17.86 |     351.03 |     13.82 |
| Fuse.js             | 0.72 |  99% |     1.09 |   15.29 |     396.44 |     15.91 |
<!-- bench:end -->

**en corpus:**

<!-- bench:library-fuse-scorecard-en -->
| Library             |  MRR | Junk | index ms | cold ms | session ms | per query |
|---------------------|-----:|-----:|---------:|--------:|-----------:|----------:|
| **Fuse.js (tuned)** | 0.76 |  46% |     1.06 |   13.59 |     239.56 |      9.36 |
| Fuse.js (all opts)  | 0.76 |  95% |     1.06 |   15.92 |     304.97 |     11.96 |
| Fuse.js             | 0.72 | 100% |     1.05 |   13.43 |     323.61 |     12.94 |
<!-- bench:end -->

**emoji corpus** (quality only here; its timing is listed, unranked, in [the benchmarks](../benchmarks.md#emoji-corpus-unranked)):

<!-- bench:library-fuse-scorecard-emoji -->
| Library             |  MRR | Junk | index ms | cold ms | session ms | per query |
|---------------------|-----:|-----:|---------:|--------:|-----------:|----------:|
| **Fuse.js (tuned)** | 0.71 |  35% |        — |       — |          — |         — |
| Fuse.js (all opts)  | 0.67 |  85% |        — |       — |          — |         — |
| Fuse.js             | 0.65 |  92% |        — |       — |          — |         — |
<!-- bench:end -->

## Speed at 100k

The columns are [the speed tables'](../benchmarks.md#size-speed--search-type), at 100k, with Ekrina as the <!-- bench:{{ constant("100%") }} -->100%<!-- bench:end --> row.
The native tables list only the configurations that fold diacritics, so base Fuse.js, which doesn't, is timed on en only; the emoji corpus is timed only unranked, in [the benchmarks](../benchmarks.md#emoji-corpus-unranked).

**en corpus:**

<!-- bench:library-fuse-speed-en -->
| Library            |   index | cold query |     total | total rel |
|--------------------|--------:|-----------:|----------:|----------:|
| **Ekrina**         | 0.23 ms |    8.10 ms |   8.34 ms |  **100%** |
| Fuse.js            | 4.92 ms |  108.36 ms | 113.23 ms |     1357% |
| Fuse.js (all opts) | 4.88 ms |  126.22 ms | 131.11 ms |     1572% |
| Fuse.js (tuned)    | 4.93 ms |  100.15 ms | 105.01 ms |     1259% |
<!-- bench:end -->

<!-- bench:library-fuse-batch-en -->
| Library            |   build | first answer | session total | per query | per query rel |
|--------------------|--------:|-------------:|--------------:|----------:|--------------:|
| **Ekrina**         | 0.23 ms |      8.55 ms |      48.14 ms |   1.64 ms |      **100%** |
| Fuse.js            | 4.92 ms |     87.46 ms |    3293.28 ms | 133.43 ms |         8124% |
| Fuse.js (all opts) | 4.88 ms |    131.07 ms |    3043.51 ms | 121.19 ms |         7378% |
| Fuse.js (tuned)    | 4.93 ms |    102.14 ms |    2417.26 ms |  96.18 ms |         5856% |
<!-- bench:end -->

**native corpus:**

<!-- bench:library-fuse-speed-native -->
| Library            |   index | cold query |     total | total rel |
|--------------------|--------:|-----------:|----------:|----------:|
| **Ekrina**         | 0.23 ms |    9.94 ms |  10.19 ms |  **100%** |
| Fuse.js (all opts) | 5.35 ms |  142.40 ms | 147.68 ms |     1450% |
| Fuse.js (tuned)    | 5.38 ms |  113.15 ms | 118.45 ms |     1163% |
<!-- bench:end -->

<!-- bench:library-fuse-batch-native -->
| Library            |   build | first answer | session total | per query | per query rel |
|--------------------|--------:|-------------:|--------------:|----------:|--------------:|
| **Ekrina**         | 0.23 ms |      9.75 ms |      56.79 ms |   1.96 ms |      **100%** |
| Fuse.js (all opts) | 5.35 ms |    149.48 ms |    3579.04 ms | 142.68 ms |         7292% |
| Fuse.js (tuned)    | 5.38 ms |    114.78 ms |    2788.46 ms | 111.18 ms |         5682% |
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
