# @nozbe/microfuzz

Every configuration of @nozbe/microfuzz the bench runs, over the same corpora and queries as [the benchmarks](../benchmarks.md).
The headline tables there show whichever scores best on those benchmarks, which makes it the configuration tuned to the tests it is ranked on.
That row is in bold in the scorecard below.

- **@nozbe/microfuzz**: the defaults.
- **@nozbe/microfuzz (all opts)**: `strategy: "aggressive"`, which keeps every in-order letter match where the default `"smart"` drops the poor ones.

## Scorecard

The columns are [the scorecard's](../benchmarks.md#scorecard).

**native corpus:**

<!-- bench:library-microfuzz-scorecard-native -->
| Library                     |  MRR | Junk | index ms | cold ms | batch ms | batch/query |
|-----------------------------|-----:|-----:|---------:|--------:|---------:|------------:|
| **@nozbe/microfuzz**        | 0.41 |   7% |     4.50 |    2.97 |    35.05 |        1.33 |
| @nozbe/microfuzz (all opts) | 0.41 |   7% |     4.59 |    2.96 |    35.49 |        1.34 |
<!-- bench:end -->

**en corpus:**

<!-- bench:library-microfuzz-scorecard-en -->
| Library                     |  MRR | Junk | index ms | cold ms | batch ms | batch/query |
|-----------------------------|-----:|-----:|---------:|--------:|---------:|------------:|
| **@nozbe/microfuzz**        | 0.40 |   3% |     4.21 |    2.86 |    33.15 |        1.25 |
| @nozbe/microfuzz (all opts) | 0.40 |   3% |     4.21 |    2.89 |    32.97 |        1.25 |
<!-- bench:end -->

**emoji corpus** (quality only here; its timing is listed, unranked, in [the benchmarks](../benchmarks.md#emoji-corpus-unranked)):

<!-- bench:library-microfuzz-scorecard-emoji -->
| Library                     |  MRR | Junk | index ms | cold ms | batch ms | batch/query |
|-----------------------------|-----:|-----:|---------:|--------:|---------:|------------:|
| **@nozbe/microfuzz**        | 0.47 |  24% |        — |       — |        — |           — |
| @nozbe/microfuzz (all opts) | 0.47 |  24% |        — |       — |        — |           — |
<!-- bench:end -->

## Speed at 100k

The columns are [the speed tables'](../benchmarks.md#size-speed--search-type), at 100k, with Ekrina as the <!-- bench:{{ constant("100%") }} -->100%<!-- bench:end --> row.

**en corpus:**

<!-- bench:library-microfuzz-speed-en -->
| Library                     |    index | cold query |    total | total rel |
|-----------------------------|---------:|-----------:|---------:|----------:|
| **Ekrina**                  |  0.23 ms |    8.10 ms |  8.34 ms |  **100%** |
| @nozbe/microfuzz            | 48.59 ms |   16.54 ms | 65.41 ms |      784% |
| @nozbe/microfuzz (all opts) | 48.81 ms |   16.66 ms | 66.19 ms |      793% |
<!-- bench:end -->

<!-- bench:library-microfuzz-batch-en -->
| Library                     | batch/query | batch total | batch rel |
|-----------------------------|------------:|------------:|----------:|
| **Ekrina**                  |     1.64 ms |    47.91 ms |  **100%** |
| @nozbe/microfuzz            |    11.16 ms |   289.04 ms |      603% |
| @nozbe/microfuzz (all opts) |    11.19 ms |   289.77 ms |      605% |
<!-- bench:end -->

**native corpus:**

<!-- bench:library-microfuzz-speed-native -->
| Library                     |    index | cold query |    total | total rel |
|-----------------------------|---------:|-----------:|---------:|----------:|
| **Ekrina**                  |  0.23 ms |    9.94 ms | 10.19 ms |  **100%** |
| @nozbe/microfuzz            | 51.83 ms |   18.51 ms | 70.90 ms |      696% |
| @nozbe/microfuzz (all opts) | 51.90 ms |   18.42 ms | 70.83 ms |      695% |
<!-- bench:end -->

<!-- bench:library-microfuzz-batch-native -->
| Library                     | batch/query | batch total | batch rel |
|-----------------------------|------------:|------------:|----------:|
| **Ekrina**                  |     1.96 ms |    56.56 ms |  **100%** |
| @nozbe/microfuzz            |    12.11 ms |   312.01 ms |      552% |
| @nozbe/microfuzz (all opts) |    12.21 ms |   314.54 ms |      556% |
<!-- bench:end -->

## Match quality, by query family

MRR@10 per family, scored as in [Match quality, by query family](../benchmarks.md#match-quality-by-query-family).

**native corpus:**

<!-- bench:library-microfuzz-families-native -->
| Group         | Family                        | @nozbe/microfuzz | @nozbe/microfuzz (all opts) |
|---------------|-------------------------------|-----------------:|----------------------------:|
| typos         | neighbouring key              |             0.00 |                        0.00 |
| typos         | two neighbouring keys         |             0.00 |                        0.00 |
| typos         | random letter                 |             0.00 |                        0.00 |
| typos         | dropped letter                |             0.77 |                        0.77 |
| typos         | two dropped letters           |             0.89 |                        0.89 |
| typos         | inserted neighbouring key     |             0.05 |                        0.05 |
| typos         | swapped neighbours            |             0.04 |                        0.04 |
| typos         | stuck key                     |             0.00 |                        0.00 |
| typos         | first letter wrong            |             0.10 |                        0.10 |
| typos         | typo in each of two words     |             0.00 |                        0.00 |
| typos         | typo then a half-typed word   |             0.00 |                        0.00 |
| typos         | two words joined, with a typo |             0.00 |                        0.00 |
| phonetic      | consonant spelt another way   |             0.10 |                        0.10 |
| phonetic      | letter doubled or singled     |             0.20 |                        0.20 |
| phonetic      | silent letters dropped        |             0.56 |                        0.56 |
| phonetic      | vowel sound spelt another way |             0.00 |                        0.00 |
| partial words | prefix of 3                   |             1.00 |                        1.00 |
| partial words | prefix of 5                   |             1.00 |                        1.00 |
| partial words | infix of 5                    |             1.00 |                        1.00 |
| partial words | two words half typed          |             1.00 |                        1.00 |
| partial words | a vowel dropped               |             0.87 |                        0.87 |
| partial words | 2 vowels dropped              |             0.80 |                        0.80 |
| query shape   | two words                     |             0.88 |                        0.88 |
| query shape   | two words reversed            |             0.90 |                        0.90 |
| query shape   | two words joined              |             1.00 |                        1.00 |
| query shape   | an absent word added          |             0.00 |                        0.00 |
| noise         | space inside a word           |             0.00 |                        0.00 |
| noise         | punctuation inside a word     |             0.00 |                        0.00 |
| noise         | accents stripped              |             0.96 |                        0.96 |
| noise         | accents added                 |             0.96 |                        0.96 |
| reported only | acronym                       |             0.44 |                        0.44 |
| reported only | plural for a singular         |             0.20 |                        0.20 |
| phonetic      | real misspelling              |             0.30 |                        0.30 |
<!-- bench:end -->

**en corpus:**

<!-- bench:library-microfuzz-families-en -->
| Group         | Family                        | @nozbe/microfuzz | @nozbe/microfuzz (all opts) |
|---------------|-------------------------------|-----------------:|----------------------------:|
| typos         | neighbouring key              |             0.00 |                        0.00 |
| typos         | two neighbouring keys         |             0.00 |                        0.00 |
| typos         | random letter                 |             0.00 |                        0.00 |
| typos         | dropped letter                |             0.77 |                        0.77 |
| typos         | two dropped letters           |             1.00 |                        1.00 |
| typos         | inserted neighbouring key     |             0.00 |                        0.00 |
| typos         | swapped neighbours            |             0.04 |                        0.04 |
| typos         | stuck key                     |             0.00 |                        0.00 |
| typos         | first letter wrong            |             0.10 |                        0.10 |
| typos         | typo in each of two words     |             0.00 |                        0.00 |
| typos         | typo then a half-typed word   |             0.00 |                        0.00 |
| typos         | two words joined, with a typo |             0.00 |                        0.00 |
| phonetic      | consonant spelt another way   |             0.10 |                        0.10 |
| phonetic      | letter doubled or singled     |             0.20 |                        0.20 |
| phonetic      | silent letters dropped        |             0.54 |                        0.54 |
| phonetic      | vowel sound spelt another way |             0.00 |                        0.00 |
| partial words | prefix of 3                   |             1.00 |                        1.00 |
| partial words | prefix of 5                   |             1.00 |                        1.00 |
| partial words | infix of 5                    |             1.00 |                        1.00 |
| partial words | two words half typed          |             1.00 |                        1.00 |
| partial words | a vowel dropped               |             0.85 |                        0.85 |
| partial words | 2 vowels dropped              |             0.80 |                        0.80 |
| query shape   | two words                     |             0.88 |                        0.88 |
| query shape   | two words reversed            |             0.90 |                        0.90 |
| query shape   | two words joined              |             1.00 |                        1.00 |
| query shape   | an absent word added          |             0.00 |                        0.00 |
| noise         | space inside a word           |             0.00 |                        0.00 |
| noise         | punctuation inside a word     |             0.00 |                        0.00 |
| noise         | accents stripped              |             0.96 |                        0.96 |
| noise         | accents added                 |             0.95 |                        0.95 |
| reported only | acronym                       |             0.47 |                        0.47 |
| reported only | plural for a singular         |             0.30 |                        0.30 |
| phonetic      | real misspelling              |             0.20 |                        0.20 |
<!-- bench:end -->

**emoji corpus:**

<!-- bench:library-microfuzz-families-emoji -->
| Group         | Family                        | @nozbe/microfuzz | @nozbe/microfuzz (all opts) |
|---------------|-------------------------------|-----------------:|----------------------------:|
| typos         | neighbouring key              |             0.13 |                        0.13 |
| typos         | two neighbouring keys         |             0.00 |                        0.00 |
| typos         | random letter                 |             0.20 |                        0.20 |
| typos         | dropped letter                |             0.78 |                        0.78 |
| typos         | two dropped letters           |             0.68 |                        0.68 |
| typos         | inserted neighbouring key     |             0.20 |                        0.20 |
| typos         | swapped neighbours            |             0.29 |                        0.29 |
| typos         | stuck key                     |             0.23 |                        0.23 |
| typos         | first letter wrong            |             0.35 |                        0.35 |
| typos         | typo in each of two words     |             0.00 |                        0.00 |
| typos         | typo then a half-typed word   |             0.10 |                        0.10 |
| typos         | two words joined, with a typo |             0.05 |                        0.05 |
| phonetic      | consonant spelt another way   |             0.00 |                        0.00 |
| phonetic      | letter doubled or singled     |             0.55 |                        0.55 |
| phonetic      | silent letters dropped        |             0.60 |                        0.60 |
| phonetic      | vowel sound spelt another way |             0.28 |                        0.28 |
| partial words | prefix of 3                   |             1.00 |                        1.00 |
| partial words | prefix of 5                   |             1.00 |                        1.00 |
| partial words | infix of 5                    |             1.00 |                        1.00 |
| partial words | two words half typed          |             1.00 |                        1.00 |
| partial words | a vowel dropped               |             0.97 |                        0.97 |
| partial words | 2 vowels dropped              |             0.77 |                        0.77 |
| query shape   | two words                     |             1.00 |                        1.00 |
| query shape   | two words reversed            |             0.70 |                        0.70 |
| query shape   | two words joined              |             1.00 |                        1.00 |
| query shape   | an absent word added          |             0.00 |                        0.00 |
| noise         | space inside a word           |             0.10 |                        0.10 |
| noise         | punctuation inside a word     |             0.10 |                        0.10 |
| noise         | accents stripped              |             0.95 |                        0.95 |
| noise         | accents added                 |             1.00 |                        1.00 |
| reported only | acronym                       |             0.62 |                        0.62 |
| reported only | plural for a singular         |             0.70 |                        0.70 |
| phonetic      | real misspelling              |             0.23 |                        0.23 |
<!-- bench:end -->
