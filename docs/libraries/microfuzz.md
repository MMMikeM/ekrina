# @nozbe/microfuzz

Every configuration of @nozbe/microfuzz the bench runs, over the same corpora and queries as [the benchmarks](../benchmarks.md).
The headline tables there show whichever scores best on those benchmarks, which makes it the configuration tuned to the tests it is ranked on.
That row is in bold in the scorecard below.

- **@nozbe/microfuzz**: the defaults.
- **@nozbe/microfuzz (all opts)**: `strategy: "aggressive"`.

## Scorecard

The columns are [the scorecard's](../benchmarks.md#scorecard).

**native corpus:**

<!-- bench:library-microfuzz-scorecard-native -->
| Library                     |  MRR | Junk | index ms | cold ms | batch ms | batch/query |
|-----------------------------|-----:|-----:|---------:|--------:|---------:|------------:|
| **@nozbe/microfuzz**        | 0.41 |   7% |     7.74 |    3.53 |    56.01 |        2.10 |
| @nozbe/microfuzz (all opts) | 0.41 |   7% |     6.43 |    3.45 |    52.25 |        1.95 |
<!-- bench:end -->

**en corpus:**

<!-- bench:library-microfuzz-scorecard-en -->
| Library                     |  MRR | Junk | index ms | cold ms | batch ms | batch/query |
|-----------------------------|-----:|-----:|---------:|--------:|---------:|------------:|
| **@nozbe/microfuzz**        | 0.40 |   3% |     4.99 |    3.61 |    40.30 |        1.49 |
| @nozbe/microfuzz (all opts) | 0.40 |   3% |     4.53 |    3.30 |    36.92 |        1.39 |
<!-- bench:end -->

**emoji corpus** (quality only; the list is too short for the timing cells):

<!-- bench:library-microfuzz-scorecard-emoji -->
| Library                     |  MRR | Junk | index ms | cold ms | batch ms | batch/query |
|-----------------------------|-----:|-----:|---------:|--------:|---------:|------------:|
| **@nozbe/microfuzz**        | 0.47 |  24% |        — |       — |        — |           — |
| @nozbe/microfuzz (all opts) | 0.47 |  24% |        — |       — |        — |           — |
<!-- bench:end -->

## Speed at 100k

The columns are [the speed tables'](../benchmarks.md#size-speed--search-type), at 100k, with Ekrina as the 100% row.

**en corpus:**

<!-- bench:library-microfuzz-speed-en -->
| Library                     |    index | cold query |    total | total rel |
|-----------------------------|---------:|-----------:|---------:|----------:|
| **Ekrina**                  |  0.42 ms |   14.55 ms | 15.42 ms |  **100%** |
| @nozbe/microfuzz            | 58.14 ms |   19.07 ms | 80.38 ms |      521% |
| @nozbe/microfuzz (all opts) | 52.28 ms |   19.19 ms | 79.59 ms |      516% |
<!-- bench:end -->

<!-- bench:library-microfuzz-batch-en -->
| Library                     | batch/query | batch total | batch rel |
|-----------------------------|------------:|------------:|----------:|
| **Ekrina**                  |     3.14 ms |    81.24 ms |  **100%** |
| @nozbe/microfuzz            |    15.99 ms |   404.20 ms |      498% |
| @nozbe/microfuzz (all opts) |    15.89 ms |   399.71 ms |      492% |
<!-- bench:end -->

**native corpus:**

<!-- bench:library-microfuzz-speed-native -->
| Library                     |    index | cold query |    total | total rel |
|-----------------------------|---------:|-----------:|---------:|----------:|
| **Ekrina**                  |  0.44 ms |   19.25 ms | 19.67 ms |  **100%** |
| @nozbe/microfuzz            | 65.74 ms |   20.03 ms | 79.18 ms |      403% |
| @nozbe/microfuzz (all opts) | 94.11 ms |   19.88 ms | 80.89 ms |      411% |
<!-- bench:end -->

<!-- bench:library-microfuzz-batch-native -->
| Library                     | batch/query | batch total | batch rel |
|-----------------------------|------------:|------------:|----------:|
| **Ekrina**                  |     3.58 ms |    93.21 ms |  **100%** |
| @nozbe/microfuzz            |    17.21 ms |   436.78 ms |      469% |
| @nozbe/microfuzz (all opts) |    15.15 ms |   386.60 ms |      415% |
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
