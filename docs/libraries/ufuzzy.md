# uFuzzy

Every configuration of uFuzzy the bench runs, over the same corpora and queries as [the benchmarks](../benchmarks.md).
The headline tables there show whichever scores best on those benchmarks, which makes it the configuration tuned to the tests it is ranked on.
That row is in bold in the scorecard below.

- **uFuzzy**: the defaults, with in-order terms, no diacritic folding and no typo mode.
- **uFuzzy (all opts)**: folds diacritics with `latinize()`, matches multi-word queries out of order with `outOfOrder`, and runs its one-typo `SingleError` mode with all four edits.

## Scorecard

The columns are [the scorecard's](../benchmarks.md#scorecard).

**native corpus:**

<!-- bench:library-ufuzzy-scorecard-native -->
| Library               |  MRR | Junk | index ms | cold ms | batch ms | batch/query |
|-----------------------|-----:|-----:|---------:|--------:|---------:|------------:|
| **uFuzzy (all opts)** | 0.66 |   0% |     4.33 |    1.47 |    16.52 |        0.63 |
| uFuzzy                | 0.21 |   0% |     3.76 |    0.81 |     5.33 |        0.18 |
<!-- bench:end -->

**en corpus:**

<!-- bench:library-ufuzzy-scorecard-en -->
| Library               |  MRR | Junk | index ms | cold ms | batch ms | batch/query |
|-----------------------|-----:|-----:|---------:|--------:|---------:|------------:|
| **uFuzzy (all opts)** | 0.66 |   0% |     4.35 |    1.42 |    15.06 |        0.56 |
| uFuzzy                | 0.21 |   0% |     3.70 |    0.77 |     5.06 |        0.17 |
<!-- bench:end -->

**emoji corpus** (quality only here; its timing is listed, unranked, in [the benchmarks](../benchmarks.md#emoji-corpus-unranked)):

<!-- bench:library-ufuzzy-scorecard-emoji -->
| Library               |  MRR | Junk | index ms | cold ms | batch ms | batch/query |
|-----------------------|-----:|-----:|---------:|--------:|---------:|------------:|
| **uFuzzy (all opts)** | 0.65 |   0% |        — |       — |        — |           — |
| uFuzzy                | 0.23 |   0% |        — |       — |        — |           — |
<!-- bench:end -->

## Speed at 100k

The columns are [the speed tables'](../benchmarks.md#size-speed--search-type), at 100k, with Ekrina as the <!-- bench:{{ constant("100%") }} -->100%<!-- bench:end --> row.
Only the en corpus is shown, because the native tables list only configurations that fold diacritics and of this library's configurations only uFuzzy (all opts) does; its native row is in [the headline native tables](../benchmarks.md#native-corpus), and the emoji corpus is timed only unranked, in [the benchmarks](../benchmarks.md#emoji-corpus-unranked).

**en corpus:**

<!-- bench:library-ufuzzy-speed-en -->
| Library           |   index | cold query |    total | total rel |
|-------------------|--------:|-----------:|---------:|----------:|
| **Ekrina**        | 0.23 ms |    8.10 ms |  8.34 ms |  **100%** |
| uFuzzy            | 3.84 ms |    2.24 ms |  6.06 ms |       73% |
| uFuzzy (all opts) | 8.03 ms |    3.16 ms | 11.19 ms |      134% |
<!-- bench:end -->

<!-- bench:library-ufuzzy-batch-en -->
| Library           | batch/query | batch total | batch rel |
|-------------------|------------:|------------:|----------:|
| **Ekrina**        |     1.64 ms |    47.91 ms |  **100%** |
| uFuzzy            |     1.50 ms |    38.97 ms |       81% |
| uFuzzy (all opts) |     2.09 ms |    54.43 ms |      114% |
<!-- bench:end -->

## Match quality, by query family

MRR@10 per family, scored as in [Match quality, by query family](../benchmarks.md#match-quality-by-query-family).

**native corpus:**

<!-- bench:library-ufuzzy-families-native -->
| Group         | Family                        | uFuzzy | uFuzzy (all opts) |
|---------------|-------------------------------|-------:|------------------:|
| typos         | neighbouring key              |   0.00 |              1.00 |
| typos         | two neighbouring keys         |   0.00 |              0.00 |
| typos         | random letter                 |   0.00 |              0.88 |
| typos         | dropped letter                |   0.00 |              0.80 |
| typos         | two dropped letters           |   0.00 |              0.00 |
| typos         | inserted neighbouring key     |   0.00 |              1.00 |
| typos         | swapped neighbours            |   0.00 |              0.79 |
| typos         | stuck key                     |   0.00 |              0.00 |
| typos         | first letter wrong            |   0.00 |              0.00 |
| typos         | typo in each of two words     |   0.00 |              1.00 |
| typos         | typo then a half-typed word   |   0.00 |              1.00 |
| typos         | two words joined, with a typo |   0.00 |              0.00 |
| phonetic      | consonant spelt another way   |   0.00 |              0.65 |
| phonetic      | letter doubled or singled     |   0.00 |              1.00 |
| phonetic      | silent letters dropped        |   0.30 |              0.53 |
| phonetic      | vowel sound spelt another way |   0.00 |              0.95 |
| partial words | prefix of 3                   |   0.90 |              1.00 |
| partial words | prefix of 5                   |   1.00 |              1.00 |
| partial words | infix of 5                    |   1.00 |              1.00 |
| partial words | two words half typed          |   0.90 |              1.00 |
| partial words | a vowel dropped               |   0.00 |              0.71 |
| partial words | 2 vowels dropped              |   0.00 |              0.03 |
| query shape   | two words                     |   0.80 |              1.00 |
| query shape   | two words reversed            |   0.00 |              0.95 |
| query shape   | two words joined              |   0.00 |              0.00 |
| query shape   | an absent word added          |   0.00 |              0.00 |
| noise         | space inside a word           |   0.80 |              0.90 |
| noise         | punctuation inside a word     |   1.00 |              1.00 |
| noise         | accents stripped              |   0.00 |              0.90 |
| noise         | accents added                 |   0.88 |              1.00 |
| reported only | acronym                       |   0.00 |              0.00 |
| reported only | plural for a singular         |   0.00 |              1.00 |
| phonetic      | real misspelling              |   0.00 |              0.64 |
<!-- bench:end -->

**en corpus:**

<!-- bench:library-ufuzzy-families-en -->
| Group         | Family                        | uFuzzy | uFuzzy (all opts) |
|---------------|-------------------------------|-------:|------------------:|
| typos         | neighbouring key              |   0.00 |              1.00 |
| typos         | two neighbouring keys         |   0.00 |              0.00 |
| typos         | random letter                 |   0.00 |              0.88 |
| typos         | dropped letter                |   0.00 |              0.83 |
| typos         | two dropped letters           |   0.00 |              0.00 |
| typos         | inserted neighbouring key     |   0.00 |              1.00 |
| typos         | swapped neighbours            |   0.00 |              0.78 |
| typos         | stuck key                     |   0.00 |              0.00 |
| typos         | first letter wrong            |   0.00 |              0.00 |
| typos         | typo in each of two words     |   0.00 |              1.00 |
| typos         | typo then a half-typed word   |   0.00 |              1.00 |
| typos         | two words joined, with a typo |   0.00 |              0.00 |
| phonetic      | consonant spelt another way   |   0.00 |              0.65 |
| phonetic      | letter doubled or singled     |   0.00 |              1.00 |
| phonetic      | silent letters dropped        |   0.33 |              0.58 |
| phonetic      | vowel sound spelt another way |   0.00 |              0.80 |
| partial words | prefix of 3                   |   0.90 |              1.00 |
| partial words | prefix of 5                   |   1.00 |              1.00 |
| partial words | infix of 5                    |   1.00 |              1.00 |
| partial words | two words half typed          |   0.90 |              1.00 |
| partial words | a vowel dropped               |   0.00 |              0.76 |
| partial words | 2 vowels dropped              |   0.00 |              0.02 |
| query shape   | two words                     |   0.80 |              1.00 |
| query shape   | two words reversed            |   0.00 |              1.00 |
| query shape   | two words joined              |   0.00 |              0.00 |
| query shape   | an absent word added          |   0.00 |              0.00 |
| noise         | space inside a word           |   0.80 |              0.90 |
| noise         | punctuation inside a word     |   1.00 |              1.00 |
| noise         | accents stripped              |   0.10 |              1.00 |
| noise         | accents added                 |   0.88 |              1.00 |
| reported only | acronym                       |   0.00 |              0.00 |
| reported only | plural for a singular         |   0.00 |              1.00 |
| phonetic      | real misspelling              |   0.00 |              0.58 |
<!-- bench:end -->

**emoji corpus:**

<!-- bench:library-ufuzzy-families-emoji -->
| Group         | Family                        | uFuzzy | uFuzzy (all opts) |
|---------------|-------------------------------|-------:|------------------:|
| typos         | neighbouring key              |   0.00 |              1.00 |
| typos         | two neighbouring keys         |   0.00 |              0.00 |
| typos         | random letter                 |   0.00 |              0.95 |
| typos         | dropped letter                |   0.00 |              0.52 |
| typos         | two dropped letters           |   0.00 |              0.00 |
| typos         | inserted neighbouring key     |   0.00 |              1.00 |
| typos         | swapped neighbours            |   0.00 |              1.00 |
| typos         | stuck key                     |   0.00 |              0.00 |
| typos         | first letter wrong            |   0.00 |              0.00 |
| typos         | typo in each of two words     |   0.00 |              1.00 |
| typos         | typo then a half-typed word   |   0.00 |              1.00 |
| typos         | two words joined, with a typo |   0.00 |              0.00 |
| phonetic      | consonant spelt another way   |   0.00 |              0.60 |
| phonetic      | letter doubled or singled     |   0.10 |              0.77 |
| phonetic      | silent letters dropped        |   0.30 |              0.50 |
| phonetic      | vowel sound spelt another way |   0.00 |              0.85 |
| partial words | prefix of 3                   |   1.00 |              1.00 |
| partial words | prefix of 5                   |   1.00 |              1.00 |
| partial words | infix of 5                    |   1.00 |              1.00 |
| partial words | two words half typed          |   1.00 |              1.00 |
| partial words | a vowel dropped               |   0.00 |              0.88 |
| partial words | 2 vowels dropped              |   0.00 |              0.10 |
| query shape   | two words                     |   1.00 |              1.00 |
| query shape   | two words reversed            |   0.10 |              0.92 |
| query shape   | two words joined              |   0.00 |              0.00 |
| query shape   | an absent word added          |   0.00 |              0.00 |
| noise         | space inside a word           |   1.00 |              1.00 |
| noise         | punctuation inside a word     |   0.90 |              1.00 |
| noise         | accents stripped              |   0.10 |              0.70 |
| noise         | accents added                 |   0.90 |              1.00 |
| reported only | acronym                       |   0.00 |              0.00 |
| reported only | plural for a singular         |   0.00 |              1.00 |
| phonetic      | real misspelling              |   0.00 |              0.68 |
<!-- bench:end -->
