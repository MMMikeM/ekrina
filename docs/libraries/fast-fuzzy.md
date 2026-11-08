# fast-fuzzy

Every configuration of fast-fuzzy the bench runs, over the same corpora and queries as [the benchmarks](../benchmarks.md).
The headline tables there show whichever scores best on those benchmarks, which makes it the configuration tuned to the tests it is ranked on.
That row is in bold in the scorecard below.

- **fast-fuzzy**: the defaults.
- **fast-fuzzy (all opts)**: `returnMatchData: true`, which returns a match span with each result.

## Scorecard

The columns are [the scorecard's](../benchmarks.md#scorecard).

**native corpus:**

<!-- bench:library-fast-fuzzy-scorecard-native -->
| Library               |  MRR | Junk | index ms | cold ms | session ms | per query |
|-----------------------|-----:|-----:|---------:|--------:|-----------:|----------:|
| **fast-fuzzy**        | 0.81 |  24% |    27.86 |   14.06 |     148.57 |      4.41 |
| fast-fuzzy (all opts) | 0.81 |  24% |    27.78 |   14.96 |     147.39 |      4.35 |
<!-- bench:end -->

**en corpus:**

<!-- bench:library-fast-fuzzy-scorecard-en -->
| Library               |  MRR | Junk | index ms | cold ms | session ms | per query |
|-----------------------|-----:|-----:|---------:|--------:|-----------:|----------:|
| **fast-fuzzy**        | 0.80 |  26% |    24.00 |   18.78 |     143.55 |      4.13 |
| fast-fuzzy (all opts) | 0.80 |  26% |    24.05 |   18.99 |     139.78 |      4.02 |
<!-- bench:end -->

**emoji corpus** (quality only here; its timing is listed, unranked, in [the benchmarks](../benchmarks.md#emoji-corpus-unranked)):

<!-- bench:library-fast-fuzzy-scorecard-emoji -->
| Library               |  MRR | Junk | index ms | cold ms | session ms | per query |
|-----------------------|-----:|-----:|---------:|--------:|-----------:|----------:|
| **fast-fuzzy**        | 0.84 |  26% |        — |       — |          — |         — |
| fast-fuzzy (all opts) | 0.84 |  26% |        — |       — |          — |         — |
<!-- bench:end -->

## Speed at 100k

The columns are [the speed tables'](../benchmarks.md#size-speed--search-type), at 100k, with Ekrina as the <!-- bench:{{ constant("100%") }} -->100%<!-- bench:end --> row.
Only the en corpus is shown, because the native tables list only configurations that fold diacritics and this library has no folding option ([native corpus](../benchmarks.md#native-corpus)); the emoji corpus is timed only unranked, in [the benchmarks](../benchmarks.md#emoji-corpus-unranked).

**en corpus:**

<!-- bench:library-fast-fuzzy-speed-en -->
| Library               |     index | cold query |     total | total rel |
|-----------------------|----------:|-----------:|----------:|----------:|
| **Ekrina**            |   0.23 ms |    8.10 ms |   8.34 ms |  **100%** |
| fast-fuzzy            | 218.34 ms |   75.56 ms | 294.08 ms |     3525% |
| fast-fuzzy (all opts) | 218.28 ms |   77.34 ms | 298.87 ms |     3583% |
<!-- bench:end -->

<!-- bench:library-fast-fuzzy-batch-en -->
| Library               |     build | first answer | session total | per query | per query rel |
|-----------------------|----------:|-------------:|--------------:|----------:|--------------:|
| **Ekrina**            |   0.23 ms |      8.55 ms |      48.14 ms |   1.64 ms |      **100%** |
| fast-fuzzy            | 218.34 ms |     85.54 ms |    1199.20 ms |  37.30 ms |         2271% |
| fast-fuzzy (all opts) | 218.28 ms |     92.06 ms |    1208.96 ms |  37.43 ms |         2279% |
<!-- bench:end -->

## Match quality, by query family

MRR@10 per family, scored as in [Match quality, by query family](../benchmarks.md#match-quality-by-query-family).

**native corpus:**

<!-- bench:library-fast-fuzzy-families-native -->
| Group         | Family                        | fast-fuzzy | fast-fuzzy (all opts) |
|---------------|-------------------------------|-----------:|----------------------:|
| typos         | neighbouring key              |       1.00 |                  1.00 |
| typos         | two neighbouring keys         |       1.00 |                  1.00 |
| typos         | random letter                 |       0.93 |                  0.93 |
| typos         | dropped letter                |       0.63 |                  0.63 |
| typos         | two dropped letters           |       0.43 |                  0.43 |
| typos         | inserted neighbouring key     |       1.00 |                  1.00 |
| typos         | swapped neighbours            |       0.79 |                  0.79 |
| typos         | stuck key                     |       1.00 |                  1.00 |
| typos         | first letter wrong            |       0.85 |                  0.85 |
| typos         | typo in each of two words     |       1.00 |                  1.00 |
| typos         | typo then a half-typed word   |       1.00 |                  1.00 |
| typos         | two words joined, with a typo |       0.97 |                  0.97 |
| phonetic      | consonant spelt another way   |       0.93 |                  0.93 |
| phonetic      | letter doubled or singled     |       0.82 |                  0.82 |
| phonetic      | silent letters dropped        |       0.60 |                  0.60 |
| phonetic      | vowel sound spelt another way |       0.95 |                  0.95 |
| partial words | prefix of 3                   |       0.90 |                  0.90 |
| partial words | prefix of 5                   |       1.00 |                  1.00 |
| partial words | infix of 5                    |       1.00 |                  1.00 |
| partial words | two words half typed          |       0.14 |                  0.14 |
| partial words | a vowel dropped               |       0.71 |                  0.71 |
| partial words | 2 vowels dropped              |       0.37 |                  0.37 |
| query shape   | two words                     |       1.00 |                  1.00 |
| query shape   | two words reversed            |       0.07 |                  0.07 |
| query shape   | two words joined              |       1.00 |                  1.00 |
| query shape   | an absent word added          |       0.80 |                  0.80 |
| noise         | space inside a word           |       0.91 |                  0.91 |
| noise         | punctuation inside a word     |       0.95 |                  0.95 |
| noise         | accents stripped              |       0.62 |                  0.62 |
| noise         | accents added                 |       0.93 |                  0.93 |
| reported only | acronym                       |       0.00 |                  0.00 |
| reported only | plural for a singular         |       1.00 |                  1.00 |
| phonetic      | real misspelling              |       0.74 |                  0.74 |
<!-- bench:end -->

**en corpus:**

<!-- bench:library-fast-fuzzy-families-en -->
| Group         | Family                        | fast-fuzzy | fast-fuzzy (all opts) |
|---------------|-------------------------------|-----------:|----------------------:|
| typos         | neighbouring key              |       1.00 |                  1.00 |
| typos         | two neighbouring keys         |       1.00 |                  1.00 |
| typos         | random letter                 |       0.93 |                  0.93 |
| typos         | dropped letter                |       0.64 |                  0.64 |
| typos         | two dropped letters           |       0.46 |                  0.46 |
| typos         | inserted neighbouring key     |       1.00 |                  1.00 |
| typos         | swapped neighbours            |       0.78 |                  0.78 |
| typos         | stuck key                     |       1.00 |                  1.00 |
| typos         | first letter wrong            |       0.90 |                  0.90 |
| typos         | typo in each of two words     |       1.00 |                  1.00 |
| typos         | typo then a half-typed word   |       1.00 |                  1.00 |
| typos         | two words joined, with a typo |       0.97 |                  0.97 |
| phonetic      | consonant spelt another way   |       0.93 |                  0.93 |
| phonetic      | letter doubled or singled     |       0.93 |                  0.93 |
| phonetic      | silent letters dropped        |       0.53 |                  0.53 |
| phonetic      | vowel sound spelt another way |       0.81 |                  0.81 |
| partial words | prefix of 3                   |       0.90 |                  0.90 |
| partial words | prefix of 5                   |       1.00 |                  1.00 |
| partial words | infix of 5                    |       1.00 |                  1.00 |
| partial words | two words half typed          |       0.14 |                  0.14 |
| partial words | a vowel dropped               |       0.76 |                  0.76 |
| partial words | 2 vowels dropped              |       0.28 |                  0.28 |
| query shape   | two words                     |       1.00 |                  1.00 |
| query shape   | two words reversed            |       0.07 |                  0.07 |
| query shape   | two words joined              |       1.00 |                  1.00 |
| query shape   | an absent word added          |       0.80 |                  0.80 |
| noise         | space inside a word           |       0.91 |                  0.91 |
| noise         | punctuation inside a word     |       0.95 |                  0.95 |
| noise         | accents stripped              |       0.65 |                  0.65 |
| noise         | accents added                 |       0.93 |                  0.93 |
| reported only | acronym                       |       0.05 |                  0.05 |
| reported only | plural for a singular         |       1.00 |                  1.00 |
| phonetic      | real misspelling              |       0.57 |                  0.57 |
<!-- bench:end -->

**emoji corpus:**

<!-- bench:library-fast-fuzzy-families-emoji -->
| Group         | Family                        | fast-fuzzy | fast-fuzzy (all opts) |
|---------------|-------------------------------|-----------:|----------------------:|
| typos         | neighbouring key              |       1.00 |                  1.00 |
| typos         | two neighbouring keys         |       1.00 |                  1.00 |
| typos         | random letter                 |       0.95 |                  0.95 |
| typos         | dropped letter                |       0.75 |                  0.75 |
| typos         | two dropped letters           |       0.74 |                  0.74 |
| typos         | inserted neighbouring key     |       1.00 |                  1.00 |
| typos         | swapped neighbours            |       1.00 |                  1.00 |
| typos         | stuck key                     |       0.88 |                  0.88 |
| typos         | first letter wrong            |       0.90 |                  0.90 |
| typos         | typo in each of two words     |       1.00 |                  1.00 |
| typos         | typo then a half-typed word   |       0.95 |                  0.95 |
| typos         | two words joined, with a typo |       0.85 |                  0.85 |
| phonetic      | consonant spelt another way   |       1.00 |                  1.00 |
| phonetic      | letter doubled or singled     |       0.83 |                  0.83 |
| phonetic      | silent letters dropped        |       0.56 |                  0.56 |
| phonetic      | vowel sound spelt another way |       0.95 |                  0.95 |
| partial words | prefix of 3                   |       0.65 |                  0.65 |
| partial words | prefix of 5                   |       1.00 |                  1.00 |
| partial words | infix of 5                    |       1.00 |                  1.00 |
| partial words | two words half typed          |       0.13 |                  0.13 |
| partial words | a vowel dropped               |       0.80 |                  0.80 |
| partial words | 2 vowels dropped              |       0.49 |                  0.49 |
| query shape   | two words                     |       1.00 |                  1.00 |
| query shape   | two words reversed            |       0.23 |                  0.23 |
| query shape   | two words joined              |       0.88 |                  0.88 |
| query shape   | an absent word added          |       1.00 |                  1.00 |
| noise         | space inside a word           |       1.00 |                  1.00 |
| noise         | punctuation inside a word     |       1.00 |                  1.00 |
| noise         | accents stripped              |       0.80 |                  0.80 |
| noise         | accents added                 |       0.97 |                  0.97 |
| reported only | acronym                       |       0.02 |                  0.02 |
| reported only | plural for a singular         |       1.00 |                  1.00 |
| phonetic      | real misspelling              |       0.70 |                  0.70 |
<!-- bench:end -->
