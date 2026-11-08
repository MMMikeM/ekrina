# fuzzy

Every configuration of fuzzy the bench runs, over the same corpora and queries as [the benchmarks](../benchmarks.md).
The headline tables there show whichever scores best on those benchmarks, which makes it the configuration tuned to the tests it is ranked on.
That row is in bold in the scorecard below.

- **fuzzy**: the defaults, `fuzzy.filter(query, list)`.
- **fuzzy (all opts)**: `pre` and `post` set, so each result comes back with its matches wrapped for highlighting.

## Scorecard

The columns are [the scorecard's](../benchmarks.md#scorecard).

**native corpus:**

<!-- bench:library-fuzzy-scorecard-native -->
| Library          |  MRR | Junk | index ms | cold ms | session ms | per query |
|------------------|-----:|-----:|---------:|--------:|-----------:|----------:|
| **fuzzy**        | 0.30 |   7% |     0.03 |    1.83 |      37.96 |      1.50 |
| fuzzy (all opts) | 0.30 |   7% |     0.03 |    1.90 |      39.50 |      1.56 |
<!-- bench:end -->

**en corpus:**

<!-- bench:library-fuzzy-scorecard-en -->
| Library          |  MRR | Junk | index ms | cold ms | session ms | per query |
|------------------|-----:|-----:|---------:|--------:|-----------:|----------:|
| **fuzzy**        | 0.29 |   3% |     0.03 |    1.67 |      34.52 |      1.36 |
| fuzzy (all opts) | 0.29 |   3% |     0.03 |    1.72 |      36.17 |      1.43 |
<!-- bench:end -->

**emoji corpus** (quality only here; its timing is listed, unranked, in [the benchmarks](../benchmarks.md#emoji-corpus-unranked)):

<!-- bench:library-fuzzy-scorecard-emoji -->
| Library          |  MRR | Junk | index ms | cold ms | session ms | per query |
|------------------|-----:|-----:|---------:|--------:|-----------:|----------:|
| **fuzzy**        | 0.39 |  24% |        — |       — |          — |         — |
| fuzzy (all opts) | 0.39 |  24% |        — |       — |          — |         — |
<!-- bench:end -->

## Speed at 100k

The columns are [the speed tables'](../benchmarks.md#size-speed--search-type), at 100k, with Ekrina as the <!-- bench:{{ constant("100%") }} -->100%<!-- bench:end --> row.
Only the en corpus is shown, because the native tables list only configurations that fold diacritics and this library has no folding option ([native corpus](../benchmarks.md#native-corpus)); the emoji corpus is timed only unranked, in [the benchmarks](../benchmarks.md#emoji-corpus-unranked).

**en corpus:**

<!-- bench:library-fuzzy-speed-en -->
| Library          |   index | cold query |    total | total rel |
|------------------|--------:|-----------:|---------:|----------:|
| **Ekrina**       | 0.23 ms |    8.10 ms |  8.34 ms |  **100%** |
| fuzzy            | 0.03 ms |   13.57 ms | 13.60 ms |      163% |
| fuzzy (all opts) | 0.03 ms |   13.99 ms | 14.02 ms |      168% |
<!-- bench:end -->

<!-- bench:library-fuzzy-batch-en -->
| Library          |   build | first answer | per query | session total | session rel |
|------------------|--------:|-------------:|----------:|--------------:|------------:|
| **Ekrina**       | 0.23 ms |      8.55 ms |   1.64 ms |      48.14 ms |    **100%** |
| fuzzy            | 0.03 ms |     15.72 ms |  13.06 ms |     329.25 ms |        684% |
| fuzzy (all opts) | 0.03 ms |     16.83 ms |  13.71 ms |     345.87 ms |        719% |
<!-- bench:end -->

## Match quality, by query family

MRR@10 per family, scored as in [Match quality, by query family](../benchmarks.md#match-quality-by-query-family).

**native corpus:**

<!-- bench:library-fuzzy-families-native -->
| Group         | Family                        | fuzzy | fuzzy (all opts) |
|---------------|-------------------------------|------:|-----------------:|
| typos         | neighbouring key              |  0.00 |             0.00 |
| typos         | two neighbouring keys         |  0.00 |             0.00 |
| typos         | random letter                 |  0.00 |             0.00 |
| typos         | dropped letter                |  0.62 |             0.62 |
| typos         | two dropped letters           |  0.94 |             0.94 |
| typos         | inserted neighbouring key     |  0.10 |             0.10 |
| typos         | swapped neighbours            |  0.06 |             0.06 |
| typos         | stuck key                     |  0.00 |             0.00 |
| typos         | first letter wrong            |  0.10 |             0.10 |
| typos         | typo in each of two words     |  0.00 |             0.00 |
| typos         | typo then a half-typed word   |  0.00 |             0.00 |
| typos         | two words joined, with a typo |  0.00 |             0.00 |
| phonetic      | consonant spelt another way   |  0.10 |             0.10 |
| phonetic      | letter doubled or singled     |  0.20 |             0.20 |
| phonetic      | silent letters dropped        |  0.62 |             0.62 |
| phonetic      | vowel sound spelt another way |  0.00 |             0.00 |
| partial words | prefix of 3                   |  0.66 |             0.66 |
| partial words | prefix of 5                   |  0.99 |             0.99 |
| partial words | infix of 5                    |  1.00 |             1.00 |
| partial words | two words half typed          |  0.80 |             0.80 |
| partial words | a vowel dropped               |  0.88 |             0.88 |
| partial words | 2 vowels dropped              |  0.76 |             0.76 |
| query shape   | two words                     |  0.68 |             0.68 |
| query shape   | two words reversed            |  0.00 |             0.00 |
| query shape   | two words joined              |  0.90 |             0.90 |
| query shape   | an absent word added          |  0.00 |             0.00 |
| noise         | space inside a word           |  0.00 |             0.00 |
| noise         | punctuation inside a word     |  0.00 |             0.00 |
| noise         | accents stripped              |  0.10 |             0.10 |
| noise         | accents added                 |  0.00 |             0.00 |
| reported only | acronym                       |  0.15 |             0.15 |
| reported only | plural for a singular         |  0.20 |             0.20 |
| phonetic      | real misspelling              |  0.30 |             0.30 |
<!-- bench:end -->

**en corpus:**

<!-- bench:library-fuzzy-families-en -->
| Group         | Family                        | fuzzy | fuzzy (all opts) |
|---------------|-------------------------------|------:|-----------------:|
| typos         | neighbouring key              |  0.00 |             0.00 |
| typos         | two neighbouring keys         |  0.00 |             0.00 |
| typos         | random letter                 |  0.00 |             0.00 |
| typos         | dropped letter                |  0.68 |             0.68 |
| typos         | two dropped letters           |  0.97 |             0.97 |
| typos         | inserted neighbouring key     |  0.00 |             0.00 |
| typos         | swapped neighbours            |  0.05 |             0.05 |
| typos         | stuck key                     |  0.00 |             0.00 |
| typos         | first letter wrong            |  0.10 |             0.10 |
| typos         | typo in each of two words     |  0.00 |             0.00 |
| typos         | typo then a half-typed word   |  0.00 |             0.00 |
| typos         | two words joined, with a typo |  0.00 |             0.00 |
| phonetic      | consonant spelt another way   |  0.10 |             0.10 |
| phonetic      | letter doubled or singled     |  0.20 |             0.20 |
| phonetic      | silent letters dropped        |  0.58 |             0.58 |
| phonetic      | vowel sound spelt another way |  0.00 |             0.00 |
| partial words | prefix of 3                   |  0.57 |             0.57 |
| partial words | prefix of 5                   |  0.97 |             0.97 |
| partial words | infix of 5                    |  0.94 |             0.94 |
| partial words | two words half typed          |  0.85 |             0.85 |
| partial words | a vowel dropped               |  0.84 |             0.84 |
| partial words | 2 vowels dropped              |  0.81 |             0.81 |
| query shape   | two words                     |  0.68 |             0.68 |
| query shape   | two words reversed            |  0.00 |             0.00 |
| query shape   | two words joined              |  0.80 |             0.80 |
| query shape   | an absent word added          |  0.00 |             0.00 |
| noise         | space inside a word           |  0.00 |             0.00 |
| noise         | punctuation inside a word     |  0.00 |             0.00 |
| noise         | accents stripped              |  0.13 |             0.13 |
| noise         | accents added                 |  0.00 |             0.00 |
| reported only | acronym                       |  0.03 |             0.03 |
| reported only | plural for a singular         |  0.30 |             0.30 |
| phonetic      | real misspelling              |  0.15 |             0.15 |
<!-- bench:end -->

**emoji corpus:**

<!-- bench:library-fuzzy-families-emoji -->
| Group         | Family                        | fuzzy | fuzzy (all opts) |
|---------------|-------------------------------|------:|-----------------:|
| typos         | neighbouring key              |  0.14 |             0.14 |
| typos         | two neighbouring keys         |  0.00 |             0.00 |
| typos         | random letter                 |  0.20 |             0.20 |
| typos         | dropped letter                |  0.66 |             0.66 |
| typos         | two dropped letters           |  0.69 |             0.69 |
| typos         | inserted neighbouring key     |  0.20 |             0.20 |
| typos         | swapped neighbours            |  0.38 |             0.38 |
| typos         | stuck key                     |  0.30 |             0.30 |
| typos         | first letter wrong            |  0.33 |             0.33 |
| typos         | typo in each of two words     |  0.00 |             0.00 |
| typos         | typo then a half-typed word   |  0.10 |             0.10 |
| typos         | two words joined, with a typo |  0.07 |             0.07 |
| phonetic      | consonant spelt another way   |  0.00 |             0.00 |
| phonetic      | letter doubled or singled     |  0.55 |             0.55 |
| phonetic      | silent letters dropped        |  0.50 |             0.50 |
| phonetic      | vowel sound spelt another way |  0.36 |             0.36 |
| partial words | prefix of 3                   |  0.61 |             0.61 |
| partial words | prefix of 5                   |  0.98 |             0.98 |
| partial words | infix of 5                    |  0.90 |             0.90 |
| partial words | two words half typed          |  0.91 |             0.91 |
| partial words | a vowel dropped               |  0.97 |             0.97 |
| partial words | 2 vowels dropped              |  0.75 |             0.75 |
| query shape   | two words                     |  1.00 |             1.00 |
| query shape   | two words reversed            |  0.10 |             0.10 |
| query shape   | two words joined              |  1.00 |             1.00 |
| query shape   | an absent word added          |  0.00 |             0.00 |
| noise         | space inside a word           |  0.10 |             0.10 |
| noise         | punctuation inside a word     |  0.10 |             0.10 |
| noise         | accents stripped              |  0.04 |             0.04 |
| noise         | accents added                 |  0.00 |             0.00 |
| reported only | acronym                       |  0.04 |             0.04 |
| reported only | plural for a singular         |  0.70 |             0.70 |
| phonetic      | real misspelling              |  0.23 |             0.23 |
<!-- bench:end -->
