# Ekrina

Every configuration of Ekrina the bench runs, over the same corpora and queries as [the benchmarks](../benchmarks.md).
The scorecard and speed tables there show every Ekrina configuration.

- **Ekrina**: the defaults, `createSearcher(list)`.
- **Ekrina (acronym)**: `createSearcher(list, { selectField: (item) => item, acronym: true })`, a field spec that adds the word-initials tier.
- **Ekrina (indexed)**: the defaults with `buildIndex()` called up front, so the whole-list mask index moves into the constructor; results are identical to the defaults.

## Scorecard

The columns are [the scorecard's](../benchmarks.md#scorecard).

**native corpus:**

<!-- bench:library-ekrina-scorecard-native -->
| Library          |  MRR | Junk | index ms | cold ms | batch ms | batch/query |
|------------------|-----:|-----:|---------:|--------:|---------:|------------:|
| Ekrina           | 0.91 |   0% |     0.19 |    3.45 |    15.25 |        0.36 |
| Ekrina (indexed) | 0.91 |   0% |     2.26 |    1.76 |    11.59 |        0.31 |
| Ekrina (acronym) | 0.91 |   0% |     0.20 |    3.04 |    14.93 |        0.34 |
<!-- bench:end -->

**en corpus:**

<!-- bench:library-ekrina-scorecard-en -->
| Library          |  MRR | Junk | index ms | cold ms | batch ms | batch/query |
|------------------|-----:|-----:|---------:|--------:|---------:|------------:|
| Ekrina           | 0.92 |   0% |     0.18 |    2.98 |    14.41 |        0.33 |
| Ekrina (indexed) | 0.92 |   0% |     1.57 |    1.89 |    11.29 |        0.28 |
| Ekrina (acronym) | 0.92 |   0% |     0.22 |    2.70 |    14.81 |        0.33 |
<!-- bench:end -->

**emoji corpus** (quality only here; its timing is listed, unranked, in [the benchmarks](../benchmarks.md#emoji-corpus-unranked)):

<!-- bench:library-ekrina-scorecard-emoji -->
| Library          |  MRR | Junk | index ms | cold ms | batch ms | batch/query |
|------------------|-----:|-----:|---------:|--------:|---------:|------------:|
| Ekrina           | 0.91 |   0% |        — |       — |        — |           — |
| Ekrina (indexed) | 0.91 |   0% |        — |       — |        — |           — |
| Ekrina (acronym) | 0.91 |   0% |        — |       — |        — |           — |
<!-- bench:end -->

## Speed at 100k

The columns are [the speed tables'](../benchmarks.md#size-speed--search-type), at 100k.

**en corpus:**

<!-- bench:library-ekrina-speed-en -->
| Library          |   index | cold query |   total | total rel |
|------------------|--------:|-----------:|--------:|----------:|
| **Ekrina**       | 0.25 ms |    8.13 ms | 8.36 ms |  **100%** |
| Ekrina (acronym) | 0.30 ms |    7.81 ms | 8.08 ms |       97% |
| Ekrina (indexed) | 6.71 ms |    3.35 ms | 9.98 ms |      119% |
<!-- bench:end -->

<!-- bench:library-ekrina-batch-en -->
| Library          | batch/query | batch total | batch rel |
|------------------|------------:|------------:|----------:|
| **Ekrina**       |     1.74 ms |    50.87 ms |  **100%** |
| Ekrina (acronym) |     1.82 ms |    53.88 ms |      106% |
| Ekrina (indexed) |     1.31 ms |    36.21 ms |       71% |
<!-- bench:end -->

**native corpus:**

<!-- bench:library-ekrina-speed-native -->
| Library          |   index | cold query |    total | total rel |
|------------------|--------:|-----------:|---------:|----------:|
| **Ekrina**       | 0.22 ms |    9.74 ms |  9.98 ms |  **100%** |
| Ekrina (acronym) | 0.25 ms |    9.21 ms |  9.47 ms |       95% |
| Ekrina (indexed) | 8.34 ms |    3.53 ms | 11.98 ms |      120% |
<!-- bench:end -->

<!-- bench:library-ekrina-batch-native -->
| Library          | batch/query | batch total | batch rel |
|------------------|------------:|------------:|----------:|
| **Ekrina**       |     1.91 ms |    55.61 ms |  **100%** |
| Ekrina (acronym) |     1.96 ms |    58.58 ms |      105% |
| Ekrina (indexed) |     1.45 ms |    39.78 ms |       72% |
<!-- bench:end -->

## Match quality, by query family

MRR@10 per family, scored as in [Match quality, by query family](../benchmarks.md#match-quality-by-query-family).

**native corpus:**

<!-- bench:library-ekrina-families-native -->
| Group         | Family                        | Ekrina | Ekrina (acronym) | Ekrina (indexed) |
|---------------|-------------------------------|-------:|-----------------:|-----------------:|
| typos         | neighbouring key              |   1.00 |             1.00 |             1.00 |
| typos         | two neighbouring keys         |   0.97 |             0.97 |             0.97 |
| typos         | random letter                 |   0.95 |             0.95 |             0.95 |
| typos         | dropped letter                |   0.97 |             0.97 |             0.97 |
| typos         | two dropped letters           |   1.00 |             1.00 |             1.00 |
| typos         | inserted neighbouring key     |   1.00 |             1.00 |             1.00 |
| typos         | swapped neighbours            |   0.80 |             0.80 |             0.80 |
| typos         | stuck key                     |   1.00 |             1.00 |             1.00 |
| typos         | first letter wrong            |   0.90 |             0.90 |             0.90 |
| typos         | typo in each of two words     |   1.00 |             1.00 |             1.00 |
| typos         | typo then a half-typed word   |   1.00 |             1.00 |             1.00 |
| typos         | two words joined, with a typo |   0.97 |             0.97 |             0.97 |
| phonetic      | consonant spelt another way   |   1.00 |             1.00 |             1.00 |
| phonetic      | letter doubled or singled     |   0.92 |             0.92 |             0.92 |
| phonetic      | silent letters dropped        |   0.61 |             0.61 |             0.61 |
| phonetic      | vowel sound spelt another way |   0.95 |             0.95 |             0.95 |
| partial words | prefix of 3                   |   1.00 |             1.00 |             1.00 |
| partial words | prefix of 5                   |   1.00 |             1.00 |             1.00 |
| partial words | infix of 5                    |   1.00 |             1.00 |             1.00 |
| partial words | two words half typed          |   1.00 |             1.00 |             1.00 |
| partial words | a vowel dropped               |   0.97 |             0.97 |             0.97 |
| partial words | 2 vowels dropped              |   0.90 |             0.90 |             0.90 |
| query shape   | two words                     |   1.00 |             1.00 |             1.00 |
| query shape   | two words reversed            |   1.00 |             1.00 |             1.00 |
| query shape   | two words joined              |   1.00 |             1.00 |             1.00 |
| query shape   | an absent word added          |   0.00 |             0.00 |             0.00 |
| noise         | space inside a word           |   1.00 |             1.00 |             1.00 |
| noise         | punctuation inside a word     |   1.00 |             1.00 |             1.00 |
| noise         | accents stripped              |   1.00 |             1.00 |             1.00 |
| noise         | accents added                 |   1.00 |             1.00 |             1.00 |
| reported only | acronym                       |   0.37 |             0.90 |             0.37 |
| reported only | plural for a singular         |   1.00 |             1.00 |             1.00 |
| phonetic      | real misspelling              |   0.78 |             0.78 |             0.78 |
<!-- bench:end -->

**en corpus:**

<!-- bench:library-ekrina-families-en -->
| Group         | Family                        | Ekrina | Ekrina (acronym) | Ekrina (indexed) |
|---------------|-------------------------------|-------:|-----------------:|-----------------:|
| typos         | neighbouring key              |   1.00 |             1.00 |             1.00 |
| typos         | two neighbouring keys         |   1.00 |             1.00 |             1.00 |
| typos         | random letter                 |   0.95 |             0.95 |             0.95 |
| typos         | dropped letter                |   0.95 |             0.95 |             0.95 |
| typos         | two dropped letters           |   1.00 |             1.00 |             1.00 |
| typos         | inserted neighbouring key     |   1.00 |             1.00 |             1.00 |
| typos         | swapped neighbours            |   0.79 |             0.79 |             0.79 |
| typos         | stuck key                     |   1.00 |             1.00 |             1.00 |
| typos         | first letter wrong            |   0.95 |             0.95 |             0.95 |
| typos         | typo in each of two words     |   1.00 |             1.00 |             1.00 |
| typos         | typo then a half-typed word   |   1.00 |             1.00 |             1.00 |
| typos         | two words joined, with a typo |   0.97 |             0.97 |             0.97 |
| phonetic      | consonant spelt another way   |   1.00 |             1.00 |             1.00 |
| phonetic      | letter doubled or singled     |   1.00 |             1.00 |             1.00 |
| phonetic      | silent letters dropped        |   0.60 |             0.60 |             0.60 |
| phonetic      | vowel sound spelt another way |   0.95 |             0.95 |             0.95 |
| partial words | prefix of 3                   |   1.00 |             1.00 |             1.00 |
| partial words | prefix of 5                   |   1.00 |             1.00 |             1.00 |
| partial words | infix of 5                    |   1.00 |             1.00 |             1.00 |
| partial words | two words half typed          |   1.00 |             1.00 |             1.00 |
| partial words | a vowel dropped               |   0.97 |             0.97 |             0.97 |
| partial words | 2 vowels dropped              |   0.93 |             0.93 |             0.93 |
| query shape   | two words                     |   1.00 |             1.00 |             1.00 |
| query shape   | two words reversed            |   1.00 |             1.00 |             1.00 |
| query shape   | two words joined              |   1.00 |             1.00 |             1.00 |
| query shape   | an absent word added          |   0.00 |             0.00 |             0.00 |
| noise         | space inside a word           |   1.00 |             1.00 |             1.00 |
| noise         | punctuation inside a word     |   1.00 |             1.00 |             1.00 |
| noise         | accents stripped              |   1.00 |             1.00 |             1.00 |
| noise         | accents added                 |   1.00 |             1.00 |             1.00 |
| reported only | acronym                       |   0.64 |             0.88 |             0.64 |
| reported only | plural for a singular         |   1.00 |             1.00 |             1.00 |
| phonetic      | real misspelling              |   0.78 |             0.78 |             0.78 |
<!-- bench:end -->

**emoji corpus:**

<!-- bench:library-ekrina-families-emoji -->
| Group         | Family                        | Ekrina | Ekrina (acronym) | Ekrina (indexed) |
|---------------|-------------------------------|-------:|-----------------:|-----------------:|
| typos         | neighbouring key              |   1.00 |             1.00 |             1.00 |
| typos         | two neighbouring keys         |   1.00 |             1.00 |             1.00 |
| typos         | random letter                 |   0.88 |             0.88 |             0.88 |
| typos         | dropped letter                |   1.00 |             1.00 |             1.00 |
| typos         | two dropped letters           |   1.00 |             1.00 |             1.00 |
| typos         | inserted neighbouring key     |   0.95 |             0.95 |             0.95 |
| typos         | swapped neighbours            |   1.00 |             1.00 |             1.00 |
| typos         | stuck key                     |   1.00 |             1.00 |             1.00 |
| typos         | first letter wrong            |   0.82 |             0.82 |             0.82 |
| typos         | typo in each of two words     |   1.00 |             1.00 |             1.00 |
| typos         | typo then a half-typed word   |   1.00 |             1.00 |             1.00 |
| typos         | two words joined, with a typo |   1.00 |             1.00 |             1.00 |
| phonetic      | consonant spelt another way   |   1.00 |             1.00 |             1.00 |
| phonetic      | letter doubled or singled     |   0.87 |             0.87 |             0.87 |
| phonetic      | silent letters dropped        |   0.60 |             0.60 |             0.60 |
| phonetic      | vowel sound spelt another way |   0.90 |             0.90 |             0.90 |
| partial words | prefix of 3                   |   1.00 |             1.00 |             1.00 |
| partial words | prefix of 5                   |   1.00 |             1.00 |             1.00 |
| partial words | infix of 5                    |   1.00 |             1.00 |             1.00 |
| partial words | two words half typed          |   1.00 |             1.00 |             1.00 |
| partial words | a vowel dropped               |   1.00 |             1.00 |             1.00 |
| partial words | 2 vowels dropped              |   0.95 |             0.95 |             0.95 |
| query shape   | two words                     |   1.00 |             1.00 |             1.00 |
| query shape   | two words reversed            |   1.00 |             1.00 |             1.00 |
| query shape   | two words joined              |   1.00 |             1.00 |             1.00 |
| query shape   | an absent word added          |   0.00 |             0.00 |             0.00 |
| noise         | space inside a word           |   1.00 |             1.00 |             1.00 |
| noise         | punctuation inside a word     |   1.00 |             1.00 |             1.00 |
| noise         | accents stripped              |   0.95 |             0.95 |             0.95 |
| noise         | accents added                 |   1.00 |             1.00 |             1.00 |
| reported only | acronym                       |   0.40 |             0.90 |             0.40 |
| reported only | plural for a singular         |   1.00 |             1.00 |             1.00 |
| phonetic      | real misspelling              |   0.90 |             0.90 |             0.90 |
<!-- bench:end -->
