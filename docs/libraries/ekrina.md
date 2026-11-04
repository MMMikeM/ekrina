# Ekrina

Every configuration of Ekrina the bench runs, over the same corpora and queries as [the benchmarks](../benchmarks.md).
The headline tables there show every Ekrina configuration.

- **Ekrina**: the defaults, `createFuzzySearch(list)`.
- **Ekrina (acronym)**: `acronym: true`, which adds the word-initials tier.
- **Ekrina (indexed)**: the defaults with `buildIndex()` called up front, so the whole-list mask index moves into the constructor; results are identical to the defaults.
- **Ekrina (fuzzier)**: the field opts in to `fuzzier` (`[{ text: (x) => x, fuzzier }]`), which adds two-edit corrections, sparse words, stray spaces and split or joined words.

## Scorecard

The columns are [the scorecard's](../benchmarks.md#scorecard).

**native corpus:**

<!-- bench:library-ekrina-scorecard-native -->
| Library          |  MRR | junk | index ms | cold ms | batch ms | batch/query |
|------------------|-----:|-----:|---------:|--------:|---------:|------------:|
| Ekrina (fuzzier) | 0.90 | 0.00 |     0.18 |    5.14 |    29.91 |        0.88 |
| Ekrina           | 0.70 | 0.00 |     0.17 |    4.89 |    23.55 |        0.64 |
| Ekrina (indexed) | 0.70 | 0.00 |     3.09 |    2.02 |    19.43 |        0.63 |
| Ekrina (acronym) | 0.70 | 0.00 |     0.17 |    4.95 |    23.84 |        0.64 |
<!-- bench:end -->

**en corpus:**

<!-- bench:library-ekrina-scorecard-en -->
| Library          |  MRR | junk | index ms | cold ms | batch ms | batch/query |
|------------------|-----:|-----:|---------:|--------:|---------:|------------:|
| Ekrina (fuzzier) | 0.90 | 0.00 |     0.19 |    3.98 |    24.64 |        0.74 |
| Ekrina           | 0.70 | 0.00 |     0.17 |    3.96 |    19.81 |        0.54 |
| Ekrina (indexed) | 0.70 | 0.00 |     1.76 |    1.86 |    16.70 |        0.54 |
| Ekrina (acronym) | 0.70 | 0.00 |     0.17 |    3.90 |    20.06 |        0.55 |
<!-- bench:end -->

**emoji corpus** (quality only; the list is too short for the timing cells):

<!-- bench:library-ekrina-scorecard-emoji -->
| Library          |  MRR | junk | index ms | cold ms | batch ms | batch/query |
|------------------|-----:|-----:|---------:|--------:|---------:|------------:|
| Ekrina (fuzzier) | 0.90 | 0.00 |        — |       — |        — |           — |
| Ekrina           | 0.70 | 0.00 |        — |       — |        — |           — |
| Ekrina (indexed) | 0.70 | 0.00 |        — |       — |        — |           — |
| Ekrina (acronym) | 0.70 | 0.00 |        — |       — |        — |           — |
<!-- bench:end -->

## Speed at 100k

The columns are [the speed tables'](../benchmarks.md#size-speed--search-type), at 100k.

**en corpus:**

<!-- bench:library-ekrina-speed-en -->
| Library          |   index | cold query |    total | total rel |
|------------------|--------:|-----------:|---------:|----------:|
| **Ekrina**       | 0.39 ms |   10.12 ms | 10.45 ms |  **100%** |
| Ekrina (acronym) | 0.34 ms |   10.77 ms | 11.11 ms |      106% |
| Ekrina (fuzzier) | 0.43 ms |   10.74 ms | 11.17 ms |      107% |
| Ekrina (indexed) | 9.71 ms |    2.71 ms | 12.42 ms |      119% |
<!-- bench:end -->

<!-- bench:library-ekrina-batch-en -->
| Library          | batch/query | batch total | batch rel |
|------------------|------------:|------------:|----------:|
| **Ekrina**       |     1.99 ms |    53.66 ms |  **100%** |
| Ekrina (acronym) |     2.01 ms |    55.64 ms |      104% |
| Ekrina (fuzzier) |     2.75 ms |    71.76 ms |      134% |
| Ekrina (indexed) |     1.38 ms |    36.16 ms |       67% |
<!-- bench:end -->

**native corpus:**

<!-- bench:library-ekrina-speed-native -->
| Library          |    index | cold query |    total | total rel |
|------------------|---------:|-----------:|---------:|----------:|
| **Ekrina**       |  0.35 ms |   14.18 ms | 14.52 ms |  **100%** |
| Ekrina (acronym) |  0.37 ms |   14.72 ms | 15.06 ms |      104% |
| Ekrina (fuzzier) |  0.44 ms |   14.48 ms | 14.90 ms |      103% |
| Ekrina (indexed) | 14.67 ms |    3.42 ms | 18.48 ms |      127% |
<!-- bench:end -->

<!-- bench:library-ekrina-batch-native -->
| Library          | batch/query | batch total | batch rel |
|------------------|------------:|------------:|----------:|
| **Ekrina**       |     2.59 ms |    68.75 ms |  **100%** |
| Ekrina (acronym) |     2.62 ms |    70.45 ms |      102% |
| Ekrina (fuzzier) |     3.27 ms |    85.05 ms |      124% |
| Ekrina (indexed) |     1.70 ms |    44.31 ms |       64% |
<!-- bench:end -->

## Match quality, by query family

MRR@10 per family, scored as in [Match quality, by query family](../benchmarks.md#match-quality-by-query-family).

**native corpus:**

<!-- bench:library-ekrina-families-native -->
| Group         | Family                        | Ekrina | Ekrina (acronym) | Ekrina (fuzzier) | Ekrina (indexed) |
|---------------|-------------------------------|-------:|-----------------:|-----------------:|-----------------:|
| typos         | neighbouring key              |   1.00 |             1.00 |             1.00 |             1.00 |
| typos         | two neighbouring keys         |   0.00 |             0.00 |             0.97 |             0.00 |
| typos         | random letter                 |   0.95 |             0.95 |             0.95 |             0.95 |
| typos         | dropped letter                |   0.78 |             0.78 |             0.97 |             0.78 |
| typos         | two dropped letters           |   0.76 |             0.76 |             1.00 |             0.76 |
| typos         | inserted neighbouring key     |   1.00 |             1.00 |             1.00 |             1.00 |
| typos         | swapped neighbours            |   0.80 |             0.80 |             0.79 |             0.80 |
| typos         | stuck key                     |   0.00 |             0.00 |             0.80 |             0.00 |
| typos         | first letter wrong            |   0.90 |             0.90 |             0.80 |             0.90 |
| typos         | typo in each of two words     |   0.00 |             0.00 |             1.00 |             0.00 |
| typos         | typo then a half-typed word   |   1.00 |             1.00 |             1.00 |             1.00 |
| typos         | two words joined, with a typo |   0.00 |             0.00 |             0.97 |             0.00 |
| phonetic      | consonant spelt another way   |   0.80 |             0.80 |             1.00 |             0.80 |
| phonetic      | letter doubled or singled     |   0.87 |             0.87 |             0.92 |             0.87 |
| phonetic      | silent letters dropped        |   0.58 |             0.58 |             0.61 |             0.58 |
| phonetic      | vowel sound spelt another way |   0.95 |             0.95 |             0.95 |             0.95 |
| partial words | prefix of 3                   |   1.00 |             1.00 |             1.00 |             1.00 |
| partial words | prefix of 5                   |   1.00 |             1.00 |             1.00 |             1.00 |
| partial words | infix of 5                    |   1.00 |             1.00 |             1.00 |             1.00 |
| partial words | two words half typed          |   1.00 |             1.00 |             1.00 |             1.00 |
| partial words | a vowel dropped               |   0.92 |             0.92 |             0.97 |             0.92 |
| partial words | 2 vowels dropped              |   0.25 |             0.25 |             0.95 |             0.25 |
| query shape   | two words                     |   1.00 |             1.00 |             1.00 |             1.00 |
| query shape   | two words reversed            |   1.00 |             1.00 |             1.00 |             1.00 |
| query shape   | two words joined              |   1.00 |             1.00 |             1.00 |             1.00 |
| query shape   | an absent word added          |   0.00 |             0.00 |             0.00 |             0.00 |
| noise         | space inside a word           |   0.00 |             0.00 |             1.00 |             0.00 |
| noise         | punctuation inside a word     |   0.00 |             0.00 |             1.00 |             0.00 |
| noise         | accents stripped              |   1.00 |             1.00 |             1.00 |             1.00 |
| noise         | accents added                 |   1.00 |             1.00 |             1.00 |             1.00 |
| reported only | acronym                       |   0.37 |             0.90 |             0.37 |             0.37 |
| reported only | plural for a singular         |   1.00 |             1.00 |             1.00 |             1.00 |
| phonetic      | real misspelling              |   0.73 |             0.73 |             0.65 |             0.73 |
<!-- bench:end -->

**en corpus:**

<!-- bench:library-ekrina-families-en -->
| Group         | Family                        | Ekrina | Ekrina (acronym) | Ekrina (fuzzier) | Ekrina (indexed) |
|---------------|-------------------------------|-------:|-----------------:|-----------------:|-----------------:|
| typos         | neighbouring key              |   1.00 |             1.00 |             1.00 |             1.00 |
| typos         | two neighbouring keys         |   0.00 |             0.00 |             1.00 |             0.00 |
| typos         | random letter                 |   0.95 |             0.95 |             0.88 |             0.95 |
| typos         | dropped letter                |   0.77 |             0.77 |             0.95 |             0.77 |
| typos         | two dropped letters           |   0.82 |             0.82 |             1.00 |             0.82 |
| typos         | inserted neighbouring key     |   1.00 |             1.00 |             1.00 |             1.00 |
| typos         | swapped neighbours            |   0.80 |             0.80 |             0.79 |             0.80 |
| typos         | stuck key                     |   0.00 |             0.00 |             0.90 |             0.00 |
| typos         | first letter wrong            |   0.95 |             0.95 |             0.90 |             0.95 |
| typos         | typo in each of two words     |   0.00 |             0.00 |             1.00 |             0.00 |
| typos         | typo then a half-typed word   |   1.00 |             1.00 |             1.00 |             1.00 |
| typos         | two words joined, with a typo |   0.00 |             0.00 |             0.97 |             0.00 |
| phonetic      | consonant spelt another way   |   0.80 |             0.80 |             1.00 |             0.80 |
| phonetic      | letter doubled or singled     |   0.95 |             0.95 |             1.00 |             0.95 |
| phonetic      | silent letters dropped        |   0.57 |             0.57 |             0.60 |             0.57 |
| phonetic      | vowel sound spelt another way |   0.95 |             0.95 |             0.95 |             0.95 |
| partial words | prefix of 3                   |   1.00 |             1.00 |             1.00 |             1.00 |
| partial words | prefix of 5                   |   1.00 |             1.00 |             1.00 |             1.00 |
| partial words | infix of 5                    |   1.00 |             1.00 |             1.00 |             1.00 |
| partial words | two words half typed          |   1.00 |             1.00 |             1.00 |             1.00 |
| partial words | a vowel dropped               |   0.94 |             0.94 |             0.97 |             0.94 |
| partial words | 2 vowels dropped              |   0.13 |             0.13 |             0.93 |             0.13 |
| query shape   | two words                     |   1.00 |             1.00 |             1.00 |             1.00 |
| query shape   | two words reversed            |   1.00 |             1.00 |             1.00 |             1.00 |
| query shape   | two words joined              |   1.00 |             1.00 |             1.00 |             1.00 |
| query shape   | an absent word added          |   0.00 |             0.00 |             0.00 |             0.00 |
| noise         | space inside a word           |   0.00 |             0.00 |             1.00 |             0.00 |
| noise         | punctuation inside a word     |   0.00 |             0.00 |             1.00 |             0.00 |
| noise         | accents stripped              |   1.00 |             1.00 |             1.00 |             1.00 |
| noise         | accents added                 |   1.00 |             1.00 |             1.00 |             1.00 |
| reported only | acronym                       |   0.64 |             0.88 |             0.64 |             0.64 |
| reported only | plural for a singular         |   1.00 |             1.00 |             1.00 |             1.00 |
| phonetic      | real misspelling              |   0.73 |             0.73 |             0.57 |             0.73 |
<!-- bench:end -->

**emoji corpus:**

<!-- bench:library-ekrina-families-emoji -->
| Group         | Family                        | Ekrina | Ekrina (acronym) | Ekrina (fuzzier) | Ekrina (indexed) |
|---------------|-------------------------------|-------:|-----------------:|-----------------:|-----------------:|
| typos         | neighbouring key              |   1.00 |             1.00 |             1.00 |             1.00 |
| typos         | two neighbouring keys         |   0.00 |             0.00 |             1.00 |             0.00 |
| typos         | random letter                 |   0.88 |             0.88 |             0.78 |             0.88 |
| typos         | dropped letter                |   0.76 |             0.76 |             1.00 |             0.76 |
| typos         | two dropped letters           |   0.90 |             0.90 |             1.00 |             0.90 |
| typos         | inserted neighbouring key     |   0.95 |             0.95 |             0.95 |             0.95 |
| typos         | swapped neighbours            |   1.00 |             1.00 |             1.00 |             1.00 |
| typos         | stuck key                     |   0.00 |             0.00 |             0.90 |             0.00 |
| typos         | first letter wrong            |   0.82 |             0.82 |             0.82 |             0.82 |
| typos         | typo in each of two words     |   0.00 |             0.00 |             1.00 |             0.00 |
| typos         | typo then a half-typed word   |   1.00 |             1.00 |             1.00 |             1.00 |
| typos         | two words joined, with a typo |   0.00 |             0.00 |             1.00 |             0.00 |
| phonetic      | consonant spelt another way   |   0.70 |             0.70 |             1.00 |             0.70 |
| phonetic      | letter doubled or singled     |   0.87 |             0.87 |             0.87 |             0.87 |
| phonetic      | silent letters dropped        |   0.60 |             0.60 |             0.60 |             0.60 |
| phonetic      | vowel sound spelt another way |   0.90 |             0.90 |             0.85 |             0.90 |
| partial words | prefix of 3                   |   1.00 |             1.00 |             1.00 |             1.00 |
| partial words | prefix of 5                   |   1.00 |             1.00 |             1.00 |             1.00 |
| partial words | infix of 5                    |   1.00 |             1.00 |             1.00 |             1.00 |
| partial words | two words half typed          |   1.00 |             1.00 |             1.00 |             1.00 |
| partial words | a vowel dropped               |   0.93 |             0.93 |             1.00 |             0.93 |
| partial words | 2 vowels dropped              |   0.32 |             0.32 |             1.00 |             0.32 |
| query shape   | two words                     |   1.00 |             1.00 |             1.00 |             1.00 |
| query shape   | two words reversed            |   1.00 |             1.00 |             1.00 |             1.00 |
| query shape   | two words joined              |   1.00 |             1.00 |             1.00 |             1.00 |
| query shape   | an absent word added          |   0.00 |             0.00 |             0.00 |             0.00 |
| noise         | space inside a word           |   0.10 |             0.10 |             1.00 |             0.10 |
| noise         | punctuation inside a word     |   0.10 |             0.10 |             1.00 |             0.10 |
| noise         | accents stripped              |   0.95 |             0.95 |             0.95 |             0.95 |
| noise         | accents added                 |   1.00 |             1.00 |             1.00 |             1.00 |
| reported only | acronym                       |   0.35 |             0.90 |             0.35 |             0.35 |
| reported only | plural for a singular         |   1.00 |             1.00 |             1.00 |             1.00 |
| phonetic      | real misspelling              |   0.75 |             0.75 |             0.80 |             0.75 |
<!-- bench:end -->
