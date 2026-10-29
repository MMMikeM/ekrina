# Benchmarks: match quality and speed

Full data behind the README's summary: what each library calls a match, where it ranks the right answer, and how long a query takes.
Every measured table below is generated, and `pnpm bench` regenerates all of them: it measures, writes [`bench/results.json`](../bench/results.json), rewrites each table in place, and redraws the Pareto charts.
No measured cell in this document is typed by hand.

- `pnpm bench --docs` re-emits the tables from the committed `results.json` without measuring anything.
- `pnpm bench --check` exits nonzero if any table here disagrees with `results.json`.
- `pnpm bench --speed`, `pnpm bench --quality` and `pnpm bench --memory` run one stage of the measurement; `--runs=N` sets the fresh processes per cold cell (default 1).
- `pnpm bench --scope=mixed-10k` scopes a dev run (tokens: a corpus, a size, or `corpus-size`, comma-separable). A scoped run measures a partial matrix, so it prints and stops: neither `results.json` nor this document is touched.

The pre-filter funnel ([`bench/funnel.test.ts`](../bench/funnel.test.ts)) is a diagnostic rather than a published table; run it with `pnpm --filter=ekrina-bench test`.
Improvements to the benchmarks are welcome.

## Libraries

The eight libraries compared throughout, and the configurations every table below is named after.
Feature coverage first; each cell is verified against the library's current source:

| Library                                                     | Per-field | Ranges | Diacritics | ESM | Multi-word | Typos | Tiers |
| ----------------------------------------------------------- | :-------: | :----: | :--------: | :-: | :--------: | :---: | :---: |
| **Ekrina**                                                   |    🟢     |   🟢   |     🟢     | 🟢  |     🟢     |  🟢   |  🟢   |
| [@nozbe/microfuzz](https://github.com/Nozbe/microfuzz)      |    🟢     |   🟢   |     🟢     | 🔴  |     🟢     |  🔴   |  🔴   |
| [fast-fuzzy](https://github.com/EthanRutherford/fast-fuzzy) |    🟢     |   🟡   |     🔴     | 🟢  |     🔴     |  🟢   |  🔴   |
| [Fuse.js](https://www.fusejs.io/)                           |    🟢     |   🟡   |     🟡     | 🟢  |     🟡     |  🟢   |  🔴   |
| [fuzzy](https://github.com/mattyork/fuzzy)                  |    🔴     |   🟡   |     🔴     | 🔴  |     🔴     |  🔴   |  🔴   |
| [fuzzysort](https://github.com/farzher/fuzzysort)           |    🟢     |   🟢   |     🟢     | 🔴  |     🟢     |  🔴   |  🔴   |
| [match-sorter](https://github.com/kentcdodds/match-sorter)  |    🟢     |   🔴   |     🟢     | 🟡  |     🔴     |  🔴   |  🟢   |
| [uFuzzy](https://github.com/leeoniya/uFuzzy)                |    🔴     |   🟢   |     🟡     | 🟡  |     🟡     |  🟡   |  🔴   |

🟢 built-in / on by default

🟡 opt-in or partial

🔴 not supported

Size and type, by bundle size ascending.

<!-- bench:libraries -->
| Library          | Gzip    | Deps | Type                 |
|------------------|---------|------|----------------------|
| **Ekrina**       | ~5.5 kB | 0    | subsequence (tiered) |
| fuzzy            | ~0.8 kB | 0    | substring            |
| @nozbe/microfuzz | ~1.7 kB | 0    | subsequence          |
| match-sorter     | ~3.4 kB | 2    | subsequence (tiered) |
| fuzzysort        | ~3.7 kB | 0    | subsequence          |
| uFuzzy           | ~4.1 kB | 0    | subsequence          |
| Fuse.js          | ~9.3 kB | 0    | typo-tolerant        |
| fast-fuzzy       | ~11 kB  | 1    | typo-tolerant        |
<!-- bench:end -->

An "(all opts)" row in the corpus tables shares its base library's size, deps, and type.
Ekrina's opt-in row is labelled **(acronym)** instead: `acronym: true` is its only matching opt-in, so the honest name is the specific one.
The specific opt-ins the "(all opts)" rows switch on, and where output formats differ:

- `Ekrina`: Typos 🟢 is the always-on one-edit rescue, reported as the `corrected` tier, a swap, an extra character, a missing one or a wrong one, i.e. Damerau-Levenshtein distance 1, not general edit distance
- `uFuzzy`: folds diacritics via `latinize()`, matches multi-word via `outOfOrder`, and runs its one-typo `SingleError` mode with all four edits, the closest config to Ekrina's one-edit rescue
- `Fuse.js`: returns `ranges` via `includeMatches`, folds diacritics via `ignoreDiacritics`, and matches multi-word via `useExtendedSearch`, which turns space-separated terms into an AND of fuzzy patterns in any order, the same result set Ekrina's multi-word tier returns. Fuse's other multi-word switch, `useTokenSearch`, defaults to OR (`tokenMatch: "any"`) and only reaches these semantics at `tokenMatch: "all"`
- `fast-fuzzy`: its `ranges` are one span (`index` + `length`), not per-character, and its default normalisation doesn't strip accents
- `fuzzy`: its "ranges" are a pre-wrapped string, not numeric indices

Every configuration is defined once, in [`bench/configs.ts`](../bench/configs.ts), so a row timed in the speed tables is the same row ranked in the scorecard.
A base row is the library's own defaults, with two departures, both for Fuse, and both because its defaults measure worse on every axis published here.
`ignoreLocation` is on: left off, Fuse decays a match's score with its distance from index 0, which for a list of names is a positional handicap rather than a matching one.
`threshold` is 0.4 rather than the default 0.6: at 0.6 Fuse loses ascii MRR (0.61 to 0.58), runs 49% slower, and returns 6,951 of the 10,000 items for the five-character `auxen` probe.

## How to read these numbers

The methodology lives here, once; the result sections point back to it instead of re-explaining.

### One measurement model: process-cold

Every time cell in this document comes from [`bench/run.ts`](../bench/run.ts): a **fresh node process per sample**, so the JIT, every per-searcher cache, and every process-wide cache (fuzzysort's prepare pool) start empty by construction, nothing is reconstructed by arithmetic, and no harness state can leak between cells.
Each child times:

- **index** = the constructor call, whatever the configuration builds there (uFuzzy (all opts) latinizing the haystack included; fuzzysort has no constructor at all, so its prepare-all pass lands in its first query, which is where a real user meets it).
- **cold query** = the first answer to one representative query, every lazy slice unpaid: ekrina's raw-gate scan and rescue mask build, fuzzysort's prepare-all. Six families are timed this way (short word, phrase, substitution, prefix, acronym, garbage), one path through a matcher each.
- **batch** = one process answering a short-word warmup match (like `grady`: guaranteed literal hit, absorbs the JIT and the first full scan) and then every family's representative query, once each: the realistic session. Warmth here is earned only by answering distinct real queries, no query is ever repeated, anywhere in the harness. The batch reports its total, the warmup (`first`), the mean of the 24 queries after it (`batch/query`), and each query's own post-warmup time, kept in `results.json`.
- **one-shot** = constructor + first answer, summed inside one child's consecutive windows: the whole of "given a list, get an answer".

The JIT is included deliberately.
A cold first call runs unoptimised code, and that is exactly what a user's first call runs; by the twentieth distinct query the engine is as warm as a real session ever makes it.
The previous harness sampled hundreds of repeats of one query, which tiered the JIT far past anything realistic and hid every first call inside an untimed calibration probe, [docs/measurement.md](./measurement.md) records the move.

Which column matters depends on workload: search-as-you-type → **batch/query** (and the session table below for the keystroke chain); a backend one-shot over fresh data → **one-shot**; a first-keystroke latency budget over a prebuilt index → **cold query**.

### Timing method

**Medians across fresh processes, published; minimums kept.**
Timing noise is one-sided (GC, scheduler, and thermal interruptions only ever _add_ time), so the median across processes rejects spikes; the per-cell minimum, the noise-free floor, stays in [`bench/results.json`](../bench/results.json) but is never the headline, because best-of-N flatters.
One process per cell is the default (`pnpm bench --runs=N` raises it): every number is milliseconds-scale under this model, and the small timed set keeps a whole run near four minutes, which is what makes rerunning on a quiet machine cheap.
A single cell is ~15% noisy at one process; the guards below look at sums for that reason.

Four guards keep a run honest:
result counts must be identical across a cell's processes (a variant whose answer drifts is not timing comparable work);
variant order rotates per repetition so thermal and load drift land evenly instead of on whichever library ran last;
base Ekrina measuring more than 10% slower than its strictly-more-code acronym configuration, summed over every cell, fails the run outright (more code cannot be faster, a violated invariant means absorbed load, and the artifact is not written);
and the first cell is re-timed after the last as a drift canary.

Numbers are expected to vary per machine: swapping between a Mac ARM host and an AMD x64 showed subtly different relative results.

### The corpus and the query families

Two seeded [Faker](https://github.com/faker-js/faker) corpora, benched separately: **ascii** (en locale, effectively no diacritics) and **mixed** (mostly en with every 7th item from fr/pl generators, ~5% of items carry a diacritic, a realistic international dataset; items are ~97% unique at 10k, faker repeats a few names).
Both are frozen JSON snapshots (`bench/corpus-*.json`), so runs do no generation work and the data can't drift when faker changes between versions; regenerating them is a deliberate act ([`bench/corpus-gen.test.ts`](../bench/corpus-gen.test.ts)) that rewrites history for every rank table here.

Each query runs against the same 10,000 items in every library, and each library is scored on three things:

- **Where it ranks a right answer.**
  A query's right answers are every item it could have meant ("Match quality, by query family" says how they are decided), and the score is the rank of the first one.
  In most cases, a deep rank is effectively a miss, particularly in a UI, so a rank outside the top 10 counts as a miss.
  Scoring uses the mean reciprocal rank (average of `1/rank`), **MRR** from here on, a bounded score ranging from 0 to 1.
  A rank 1 match gets a score of 1, rank 2 gets 0.5, rank 5 gets 0.2 and rank 10 gets 0.1; a rank outside the top 10, like a miss, gets 0.
- **How many items it returns.**
  This is reported as a _diagnostic_, not a score. If 50% of the corpus is returned as a potential match, it's easy to guarantee that the true match exists.
  However this is not a meaningful quality axis: any ranked list can be sliced to the top N, many of these libraries even provide a limit or threshold option. Junk results do no harm if they're never considered.
- **The duration taken to run the query.**
  Times spread three orders of magnitude on the same query (0.02 ms to ~40 ms at 10k), and search-as-you-type multiplies the spread: one query per keystroke, where 0.02 ms is invisible and 40 ms blows the frame budget.

Three rules picked the query set; none of them is "ekrina looks good here".

- **Every query is derived from the corpus.**
  A family is a fixed rule for turning an item into a query: its first word, its first two words reversed, its first word with one character substituted, its initials, and so on ([`bench/corpus.ts`](../bench/corpus.ts)).
  Each family samples ten items from a fixed shuffle of the whole list, so sources come from every position rather than the head, where a list-order tie-break would favour them.
  A corrupted query that is itself a corpus word is skipped: it would be a correct query, not a typo.
  Change the corpus snapshot and every query changes with it.
- **One family per matching behaviour, including the ones ekrina loses.**
  The table below names each family and what it isolates.
- **Graded degradation instead of a pass/fail cliff.**
  The three scatter families mutilate a source word in steps (drop one middle char, drop every third, keep every other) because a single scattered query only says who passes it; the gradient locates each engine's _effective fuzzy limit_, which is the actual design difference between the chain matchers, the typo engines, and uFuzzy's no-gaps default.
  The heavy step is deliberately past any sane threshold: an engine that still "matches" there is reporting noise tolerance, not typo tolerance.
  Three further families degrade a source word along a different axis: a **transposition** (two adjacent chars swapped), an **insertion** (a doubled keystroke), and a **substitution** (one wrong character, chosen to be absent from the source so it also removes a character class). All three keep the query close to the source but break the subsequence property, so no subsequence chain can represent them: they separate the engines that model edits from the engines that model subsequences.
  The scatter-light family is the fourth single-character edit, a **deletion**, which does stay a subsequence and so is reachable without any rescue.

The families, each with the representative query the speed tables time and the batch answers (from the mixed corpus):

| #     | family                        | example                        | isolates                                              |
| ----- | ----------------------------- | ------------------------------ | ----------------------------------------------------- |
| 1     | long single word              | `ergonomic`                    | baseline agreement; rank on a common word             |
| 2     | short single word             | `grady`                        | low-signal input, fewer chars for gates and chunking  |
| 3     | two-word phrase               | `handcrafted wooden`           | tokenization (in corpus order: any engine can pass)   |
| 4     | two words, reversed           | `wooden handcrafted`           | true order-independence, substring engines get 0      |
| 5     | reversed, second half-typed   | `woo handcrafted`              | a phrase mid-keystroke: word starts, not whole words  |
| 6     | two words, space forgotten    | `handcraftedwooden`            | a phrase typed as one word                            |
| 7     | two words plus one absent     | `handcrafted wooden ergonomic` | AND vs OR over query words (unscored)                 |
| 8     | two words, first mistyped     | `handcxafted wooden`           | a typo inside a phrase; word-level rescue             |
| 9     | two words, second mistyped    | `handcrafted wooxen`           | the rescue must find the failing word, not assume it  |
| 10    | reversed phrase, one mistyped | `wooden handcxafted`           | the correction must survive order-independence        |
| 11    | two words, both mistyped      | `handcxafted wooxen`           | two edits: refusal beats guessing (unscored)          |
| 12    | plural typed, singular stored | `romanowskis`                  | a trailing `-s` the corpus lacks, one deletion        |
| 13    | four-character typo           | `anxe`                         | corrected only when nothing matches as typed          |
| 14    | prefix / partial word         | `auxen`                        | a word not yet finished                               |
| 15    | mid-word infix                | `gonom`                        | contains-anywhere vs start-anchored ranking           |
| 16–18 | typo gradient (light → heavy) | `hugutte` `huuete` `hget`      | each engine's effective fuzzy limit                   |
| 19    | transposition typo            | `hugeutte`                     | adjacent-swap handling, rescue tier vs edit distance  |
| 20    | insertion typo                | `hugueette`                    | a doubled keystroke, one character too many           |
| 21    | substitution typo             | `huguxtte`                     | one wrong character, absent from the source entirely  |
| 22    | acronym                       | `rsaw`                         | deliberate acronym support vs accidental subsequences |
| 23    | accent-stripped               | `kepa`                         | diacritic folding                                     |
| 24    | garbage                       | `qxzwkv`                       | the reject path, verifying no impossible matches      |

Each library gets at least one family where its specialty should win: token engines the reversed phrases, folding engines the accent family, edit-distance engines the single-edit typos, chain engines the scatter gradient.
MRR averages the 21 scored families, ten queries each, so it rests on 210 queries per corpus; read differences of ±0.02 as ties.

## Build time

<!-- bench:build -->
| build |  Ekrina | Ekrina (indexed) | @nozbe/microfuzz | fast-fuzzy | Fuse.js | uFuzzy (all opts) |
|-------|--------:|-----------------:|-----------------:|-----------:|--------:|------------------:|
| 10k   | 0.15 ms |          2.06 ms |          4.52 ms |   32.22 ms | 1.33 ms |           5.20 ms |
| 100k  | 0.30 ms |         22.93 ms |         53.47 ms |  389.39 ms | 5.76 ms |           9.31 ms |
<!-- bench:end -->

Measured on the mixed corpus (process-cold constructor timings; build time barely differs between corpora).
Fuse.js's minimal build is the flip side of its slow queries: its "index" is trivial and the work is deferred to query time.
fast-fuzzy's trie is the opposite trade: the heaviest build in the set is what its subtree pruning needs.
fuzzysort has no constructor at all, so it has no column here, its lazy prepare-all pass lands in its first query's cold cell, where stock usage actually meets it.
uFuzzy's ~4 ms base construction is a process-cold discovery of its own: `new uFuzzy()` compiles the engine's regex machinery on first construction (a second construction takes 0.03 ms), so "keeps no index" is true per item but not per process, the base cell is near-identical at 10k and 100k, which is the proof it never touches the list; the (all opts) column shown here also latinizes the haystack, which is why it grows with the corpus (4.5 → 8.2 ms).
microfuzz's column is its whole index: the constructor normalises every item and builds its word sets up front, so nothing is left for the first search to pay (the memory table below gains 0.05 MB on its first query, and its 10k cold query, 1.64 ms, sits close to its 1.12 ms batch/query).
Ekrina's constructor only allocates - field text is trimmed, normalised and masked the first time an item survives a gate - so a 100k list swap takes about a millisecond, and the first query then carries what construction deferred (its cold cells).
Ekrina (indexed), the same searcher with its mask index built up front, moves the larger of those deferred costs into its constructor: 2.01 ms at 10k and 12.16 ms at 100k.

## Memory

<!-- bench:memory -->
| Library                     | built MB | + `grady` | + `qxzwkv` | + `ergonomic` | dropped MB |
|-----------------------------|---------:|----------:|-----------:|--------------:|-----------:|
| Ekrina                      |     1.93 |      2.44 |       3.24 |          3.36 |       0.17 |
| Ekrina (acronym)            |     1.93 |      2.45 |       3.24 |          3.37 |       0.18 |
| Ekrina (indexed)            |     2.71 |      3.32 |       3.34 |          3.44 |       0.15 |
| @nozbe/microfuzz            |    45.67 |     45.73 |      45.73 |         45.73 |       0.12 |
| @nozbe/microfuzz (all opts) |    45.67 |     45.73 |      45.73 |         45.73 |       0.12 |
| fast-fuzzy                  |   194.20 |    195.56 |     195.57 |        195.56 |       0.15 |
| fast-fuzzy (all opts)       |   194.20 |    195.57 |     195.57 |        195.57 |       0.16 |
| Fuse.js                     |     6.92 |      7.00 |       7.00 |          7.00 |       0.11 |
| Fuse.js (all opts)          |     6.92 |      7.03 |       7.11 |          7.06 |       0.17 |
| fuzzy                       |     0.02 |      0.05 |       0.05 |          0.05 |       0.05 |
| fuzzy (all opts)            |     0.02 |      0.03 |       0.03 |          0.03 |       0.03 |
| fuzzysort                   |     0.02 |     40.71 |      40.71 |         40.91 |      40.91 |
| match-sorter                |     0.02 |      0.13 |       0.13 |          0.13 |       0.13 |
| uFuzzy                      |     0.03 |      0.09 |       0.09 |          0.11 |       0.08 |
| uFuzzy (all opts)           |     1.09 |      1.17 |       1.17 |          1.18 |       0.10 |
<!-- bench:end -->

What each configuration retains at 100k on the mixed corpus: `heapUsed + external` over a baseline taken with the list already in memory, so typed arrays count and the caller's own strings don't.
Each row is one fresh process ([`bench/memory.ts`](../bench/memory.ts)): the searcher is built, then answers `grady`, `qxzwkv` and `ergonomic` warm in that order, so each column includes every query before it.
**dropped MB** is what is still retained once the searcher is unreachable and collected.
Ekrina allocates its per-item caches empty at construction; `grady` prepares the items it matches (~0.5 MB), and `qxzwkv`, the first query to reach the one-edit rescue, adds the mask index's bigram arrays (~0.8 MB).
Ekrina (indexed) pays for that index at construction instead (2.71 MB built), so `qxzwkv` adds only 0.02 MB.
fuzzysort retains nothing until its first `go()` fills its `prepare()` cache, which is process-wide and unevicted, so its **dropped** column equals its footprint until you call `cleanup()`.
Every other library gives its index back, leaving under 0.2 MB.
The ascii cells, in [`bench/results.json`](../bench/results.json), tell the same story.

## Match quality, by query family

Each library has its own definition of a match, so raw outputs aren't directly comparable.
Every family below is ten queries sampled from across the 10,000 items with a fixed seed ([`bench/corpus.ts`](../bench/corpus.ts)), each scored by the rank of its first relevant result.
A result is relevant when it holds what the query was typed for: every intended word as a word, in any order, for the phrases; the uncorrupted word for the typos; the same initials for the acronyms.
Relevance is judged on the bench's own accent folding and word split, never on a library's.
So any item a person could have meant counts, and no library is credited for breaking a tie in favour of one particular item.
Ties that list order breaks are found by re-running each query over the reversed list, and a tie mixing relevant and irrelevant items scores its expected first-relevant rank.
Each cell is MRR@10 over the family's ten queries; the scorecard's MRR is the mean over the scored families.

**mixed corpus:**

<!-- bench:families-mixed -->
| Family                     | Ekrina | Ekrina (acronym) | Fuse.js (all opts) | uFuzzy (all opts) | fast-fuzzy | fuzzysort | match-sorter | @nozbe/microfuzz | fuzzy |
|----------------------------|-------:|-----------------:|-------------------:|------------------:|-----------:|----------:|-------------:|-----------------:|------:|
| long-word                  |   0.99 |             0.99 |               0.99 |              1.00 |       1.00 |      1.00 |         1.00 |             0.99 |  0.99 |
| short-word                 |   0.91 |             0.91 |               0.81 |              1.00 |       0.93 |      0.98 |         1.00 |             0.91 |  0.86 |
| two-words                  |   1.00 |             1.00 |               1.00 |              1.00 |       1.00 |      1.00 |         0.90 |             0.90 |  0.90 |
| two-words-reversed         |   1.00 |             1.00 |               1.00 |              1.00 |       0.12 |      1.00 |         0.10 |             0.60 |  0.10 |
| two-words-partial-reversed |   1.00 |             1.00 |               1.00 |              1.00 |       0.35 |      1.00 |         0.00 |             0.00 |  0.00 |
| two-words-joined           |   1.00 |             1.00 |               0.92 |              0.00 |       1.00 |      1.00 |         1.00 |             1.00 |  1.00 |
| two-words-typo             |   1.00 |             1.00 |               0.97 |              1.00 |       1.00 |      0.00 |         0.00 |             0.00 |  0.00 |
| two-words-typo-second      |   1.00 |             1.00 |               1.00 |              1.00 |       1.00 |      0.00 |         0.00 |             0.00 |  0.00 |
| two-words-typo-reversed    |   1.00 |             1.00 |               1.00 |              1.00 |       0.00 |      0.00 |         0.00 |             0.00 |  0.00 |
| plural-to-singular         |   0.94 |             0.94 |               0.85 |              1.00 |       0.94 |      0.70 |         0.58 |             0.70 |  0.69 |
| short-word-typo            |   0.59 |             0.59 |               0.19 |              0.00 |       0.95 |      0.00 |         0.00 |             0.00 |  0.00 |
| prefix                     |   1.00 |             1.00 |               0.98 |              1.00 |       1.00 |      1.00 |         1.00 |             1.00 |  0.97 |
| infix                      |   1.00 |             1.00 |               1.00 |              1.00 |       1.00 |      1.00 |         1.00 |             1.00 |  1.00 |
| scatter-light              |   0.98 |             0.98 |               0.96 |              1.00 |       1.00 |      1.00 |         1.00 |             0.99 |  0.99 |
| scatter-medium             |   0.00 |             0.00 |               0.06 |              0.00 |       0.01 |      0.90 |         0.93 |             0.66 |  0.52 |
| scatter-heavy              |   0.05 |             0.05 |               0.02 |              0.00 |       0.01 |      0.59 |         0.85 |             0.30 |  0.35 |
| transposition              |   0.99 |             0.99 |               0.85 |              1.00 |       1.00 |      0.35 |         0.31 |             0.35 |  0.35 |
| insertion                  |   0.99 |             0.99 |               1.00 |              1.00 |       1.00 |      0.20 |         0.20 |             0.20 |  0.20 |
| substitution               |   0.96 |             0.96 |               0.94 |              1.00 |       1.00 |      0.00 |         0.00 |             0.00 |  0.00 |
| acronym                    |   0.34 |             0.91 |               0.00 |              0.00 |       0.00 |      0.62 |         0.90 |             0.42 |  0.07 |
| accent-stripped            |   1.00 |             1.00 |               1.00 |              1.00 |       0.78 |      1.00 |         1.00 |             1.00 |  0.11 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:families-ascii -->
| Family                     | Ekrina | Ekrina (acronym) | Fuse.js (all opts) | uFuzzy (all opts) | fast-fuzzy | fuzzysort | match-sorter | @nozbe/microfuzz | fuzzy |
|----------------------------|-------:|-----------------:|-------------------:|------------------:|-----------:|----------:|-------------:|-----------------:|------:|
| long-word                  |   0.93 |             0.93 |               0.97 |              1.00 |       1.00 |      1.00 |         1.00 |             0.93 |  0.97 |
| short-word                 |   0.86 |             0.86 |               0.70 |              1.00 |       0.85 |      0.93 |         1.00 |             0.86 |  0.84 |
| two-words                  |   1.00 |             1.00 |               1.00 |              1.00 |       1.00 |      1.00 |         1.00 |             1.00 |  1.00 |
| two-words-reversed         |   1.00 |             1.00 |               1.00 |              1.00 |       0.01 |      1.00 |         0.00 |             0.70 |  0.00 |
| two-words-partial-reversed |   1.00 |             1.00 |               0.95 |              1.00 |       0.23 |      1.00 |         0.05 |             0.10 |  0.07 |
| two-words-joined           |   1.00 |             1.00 |               1.00 |              0.00 |       1.00 |      1.00 |         1.00 |             1.00 |  0.97 |
| two-words-typo             |   1.00 |             1.00 |               1.00 |              1.00 |       1.00 |      0.00 |         0.00 |             0.00 |  0.00 |
| two-words-typo-second      |   1.00 |             1.00 |               1.00 |              1.00 |       1.00 |      0.00 |         0.00 |             0.00 |  0.00 |
| two-words-typo-reversed    |   1.00 |             1.00 |               1.00 |              1.00 |       0.23 |      0.00 |         0.00 |             0.00 |  0.00 |
| plural-to-singular         |   0.96 |             0.96 |               0.96 |              1.00 |       1.00 |      0.90 |         0.80 |             0.90 |  0.82 |
| short-word-typo            |   0.79 |             0.79 |               0.31 |              0.00 |       0.86 |      0.20 |         0.15 |             0.20 |  0.20 |
| prefix                     |   1.00 |             1.00 |               1.00 |              1.00 |       1.00 |      1.00 |         1.00 |             1.00 |  1.00 |
| infix                      |   1.00 |             1.00 |               1.00 |              1.00 |       1.00 |      1.00 |         1.00 |             1.00 |  1.00 |
| scatter-light              |   0.90 |             0.90 |               0.91 |              0.75 |       0.79 |      1.00 |         1.00 |             0.95 |  0.72 |
| scatter-medium             |   0.00 |             0.00 |               0.22 |              0.00 |       0.14 |      0.90 |         0.95 |             0.80 |  0.62 |
| scatter-heavy              |   0.03 |             0.03 |               0.00 |              0.00 |       0.00 |      0.28 |         0.67 |             0.10 |  0.16 |
| transposition              |   0.98 |             0.98 |               0.95 |              1.00 |       1.00 |      0.20 |         0.20 |             0.15 |  0.20 |
| insertion                  |   0.89 |             0.89 |               0.91 |              1.00 |       1.00 |      0.10 |         0.10 |             0.10 |  0.10 |
| substitution               |   0.99 |             0.99 |               0.99 |              1.00 |       1.00 |      0.00 |         0.00 |             0.00 |  0.00 |
| acronym                    |   0.30 |             0.90 |               0.00 |              0.00 |       0.00 |      0.56 |         0.78 |             0.31 |  0.01 |
| accent-stripped            |   1.00 |             1.00 |               0.65 |              1.00 |       0.60 |      1.00 |         1.00 |             1.00 |  0.20 |
<!-- bench:end -->

Two families have no right answer, so they are reported rather than scored: the median number of rows each library returned, where 0 is correct.

**mixed corpus:**

<!-- bench:refusals-mixed -->
| Family                | Ekrina | Ekrina (acronym) | Fuse.js (all opts) | uFuzzy (all opts) | fast-fuzzy | fuzzysort | match-sorter | @nozbe/microfuzz | fuzzy |
|-----------------------|-------:|-----------------:|-------------------:|------------------:|-----------:|----------:|-------------:|-----------------:|------:|
| two-words-extra       |      0 |                0 |                  0 |                 0 |          1 |         0 |            0 |                0 |     0 |
| two-words-double-typo |      0 |                0 |                  2 |                 1 |          5 |         0 |            0 |                0 |     0 |
<!-- bench:end -->

**ascii corpus:**

<!-- bench:refusals-ascii -->
| Family                | Ekrina | Ekrina (acronym) | Fuse.js (all opts) | uFuzzy (all opts) | fast-fuzzy | fuzzysort | match-sorter | @nozbe/microfuzz | fuzzy |
|-----------------------|-------:|-----------------:|-------------------:|------------------:|-----------:|----------:|-------------:|-----------------:|------:|
| two-words-extra       |      0 |                0 |                  0 |                 0 |          2 |         0 |            0 |                0 |     0 |
| two-words-double-typo |      0 |                0 |                  2 |                 1 |         12 |         0 |            0 |                0 |     0 |
<!-- bench:end -->

### garbage: `qxzwkv`

<!-- bench:probe-miss -->
| Library          | matches | cold ms | vs `grady` |
|------------------|--------:|--------:|-----------:|
| Ekrina           |       0 |   3.916 |       160% |
| @nozbe/microfuzz |       0 |   1.317 |        86% |
| fast-fuzzy       |       0 |  18.052 |       103% |
| Fuse.js          |       0 |   9.034 |        84% |
| fuzzysort        |       0 |   5.857 |       108% |
| uFuzzy           |       0 |   0.808 |        73% |
<!-- bench:end -->

No rank column: every library correctly returns nothing, which is the only right answer.
What separates them is how long that answer takes, shown against each library's own time for the short-word query `grady` (one that does match), so the column reads as "what fraction of a real query does a hopeless one take".
Process-cold, this query inverts: Ekrina's miss takes _more_ time than its hit, and the reason is diligence, not waste.
A hopeless six-character query is _rescuable_, so before saying "no results" Ekrina tries harder: the literal pass comes up empty, and rather than fail it builds the union and bigram masks and attempts every one-edit correction of the query, the same second pass that scores 0.96–0.99 on the single-edit typo families above.
The engines with fast misses are fast because they never tried; uFuzzy's refusal and Ekrina's bring different amounts of certainty that nothing was there.
The work also happens once per searcher, not per miss: the masks the garbage query builds are the ones every later rescue reuses, which is why the batch column absorbs it, a session's first thin query does it and the other twenty-three reuse it.
(The old warm harness showed the opposite ratio, 3%, because the masks were already built; both numbers are true, and the cold one is what a fresh searcher feels.)

## Scorecard

One line per configuration: MRR from [`bench/hits.test.ts`](../bench/hits.test.ts) (ranks are deterministic, measured once, untimed), times from the process-cold matrix ("Timing method"; `pnpm bench --runs=N` sets the processes per cell).
**MRR** = the mean over the 21 scored families of each family's MRR@10 ("Match quality, by query family"): ten queries each, scored by the rank of the first relevant result, misses and ranks outside the top 10 scoring 0.
**index ms** = the constructor call (from the batch cell's fresh processes).
**cold ms** = the mean first-answer time across the six timed queries, each in its own fresh process.
**batch ms** = one fresh process answering a short-word warmup match and then every family's representative query once, the realistic session, whole.
**batch/query** = the mean of the 24 post-warmup queries: how long a query takes once the searcher has genuinely worked.
Which column matters depends on workload: search-as-you-type → **batch/query**; backend one-shot → index + cold ("One measurement model"'s one-shot); a first-keystroke budget → **cold**.

**mixed corpus** (the query set above):

<!-- bench:scorecard-mixed -->
| Library                     |  MRR | index ms | cold ms | batch ms | batch/query |
|-----------------------------|-----:|---------:|--------:|---------:|------------:|
| Ekrina (acronym)            | 0.87 |     0.16 |    4.04 |    21.20 |        0.77 |
| Ekrina                      | 0.84 |     0.15 |    3.78 |    21.73 |        0.80 |
| Ekrina (indexed)            | 0.84 |     2.06 |    1.48 |    14.52 |        0.55 |
| Fuse.js (all opts)          | 0.79 |     1.56 |   15.99 |   376.17 |       15.01 |
| uFuzzy (all opts)           | 0.76 |     5.20 |    1.89 |    32.79 |        1.29 |
| fast-fuzzy                  | 0.72 |    32.22 |   16.42 |   173.10 |        6.50 |
| fast-fuzzy (all opts)       | 0.72 |    29.30 |   16.56 |   163.70 |        6.03 |
| Fuse.js                     | 0.66 |     1.33 |   14.54 |   477.90 |       19.47 |
| fuzzysort                   | 0.64 |     0.05 |    5.68 |    20.97 |        0.54 |
| match-sorter                | 0.56 |     0.04 |    5.31 |    66.59 |        2.43 |
| @nozbe/microfuzz            | 0.52 |     4.52 |    1.56 |    35.53 |        1.41 |
| @nozbe/microfuzz (all opts) | 0.52 |     4.60 |    1.51 |    35.51 |        1.41 |
| fuzzy                       | 0.43 |     0.05 |    2.14 |   107.57 |        4.35 |
| fuzzy (all opts)            | 0.43 |     0.05 |    2.30 |    50.60 |        2.01 |
| uFuzzy                      | 0.24 |     5.27 |    0.97 |     7.25 |        0.24 |
<!-- bench:end -->

**ascii corpus** (its own queries over its own items; its accent family has five queries, the accented words the en locale emits, such as `cote` from "Côte d'Ivoire"):

<!-- bench:scorecard-ascii -->
| Library                     |  MRR | index ms | cold ms | batch ms | batch/query |
|-----------------------------|-----:|---------:|--------:|---------:|------------:|
| Ekrina (acronym)            | 0.87 |     0.13 |    3.69 |    18.95 |        0.71 |
| Ekrina                      | 0.84 |     0.13 |    3.51 |    18.30 |        0.70 |
| Ekrina (indexed)            | 0.84 |     2.66 |    1.49 |    19.91 |        0.77 |
| Fuse.js (all opts)          | 0.79 |     1.27 |   15.51 |   348.10 |       13.86 |
| uFuzzy (all opts)           | 0.75 |     4.58 |    1.41 |    17.17 |        0.65 |
| fast-fuzzy                  | 0.70 |    27.45 |   16.46 |   148.67 |        5.55 |
| fast-fuzzy (all opts)       | 0.70 |    26.69 |   16.78 |   145.09 |        5.35 |
| Fuse.js                     | 0.66 |     1.20 |   13.63 |   380.14 |       15.38 |
| fuzzysort                   | 0.62 |     0.04 |    5.09 |    13.35 |        0.34 |
| match-sorter                | 0.56 |     0.03 |    5.49 |    55.34 |        2.01 |
| @nozbe/microfuzz            | 0.53 |     3.73 |    1.49 |    26.58 |        1.05 |
| @nozbe/microfuzz (all opts) | 0.53 |     3.78 |    1.42 |    29.62 |        1.18 |
| fuzzy                       | 0.42 |     0.04 |    1.88 |    37.47 |        1.48 |
| fuzzy (all opts)            | 0.42 |     0.03 |    2.04 |    37.64 |        1.49 |
| uFuzzy                      | 0.24 |     4.02 |    0.88 |     6.03 |        0.21 |
<!-- bench:end -->

Result-set size is _not_ a scorecard column: in a ranked UI any result list slices to the top N, so a large return does not hurt a picker (see "The corpus and the query families").
Each family's median rows per library stay in [`bench/results.json`](../bench/results.json) for the places size does matter: filter-style UIs that show every match, and telling whether an MRR came from a selective matcher or from ranking a huge candidate set.

_Ekrina (acronym) tops both corpora outright_ (0.87 mixed / 0.87 ascii), with base Ekrina and Ekrina (indexed) (0.84 / 0.84, identical ranks) next; the nearest non-Ekrina rows are Fuse.js (all opts) at 0.79 / 0.79 and uFuzzy (all opts) at 0.76 / 0.75.
The two Ekrina rows differ by one family: acronym, 0.34 base against 0.91 with the tier on, which is the whole of the gap.
Read across the family tables, the lead comes from scoring near 1 on every family at once:

- **Phrases in any order, half-typed or mistyped**: Ekrina scores 1.00 on all six phrase families, as do Fuse.js (all opts) and uFuzzy (all opts) on five of them; the subsequence engines score 0 on every phrase typo, and fast-fuzzy 0.12 or less on the reversed ones.
- **Single-edit typos** (transposition, insertion, substitution): Ekrina scores 0.89–0.99, the edit-distance engines 0.85–1.00, the chain engines 0.35 or less.
- **Refusal**: Ekrina returns nothing on both unscored families, where fast-fuzzy's median double typo returns 5 rows on mixed and 12 on ascii.

Three families go against Ekrina, and the family tables show by how much:

- **Scatter** (medium and heavy): 0.00–0.05, where match-sorter scores 0.67–0.95 and fuzzysort 0.28–0.90. Ekrina refuses a chain that sparse on purpose, since the density floor that does it is what holds long-text junk at 0% ("Matching inside long text").
- **Four-character typos**: 0.59 mixed / 0.79 ascii against fast-fuzzy's 0.95 / 0.86. Ekrina corrects a four-character query only when nothing matches it as typed, so a stray literal or fuzzy hit blocks the correction.
- **Short words**: 0.91 / 0.86 against 1.00 for uFuzzy (all opts) and match-sorter. A whole word ties with the longer words it starts, so `will` ranks "Willa Corkery" level with "Will Smith".

uFuzzy's typo configuration is the largest configuration spread in the table (0.76 mixed / 0.75 ascii against 0.24 / 0.24 for its defaults), so most of what separates uFuzzy from the field comes down to configuration rather than capability.

The scorecard's timing columns are exactly what the Pareto charts draw, one per workload; both draw the mixed 10k scorecard.

**Frontend workload** (the index is built once at load, so keystrokes run the query only):

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./pareto-query-dark.svg">
  <img alt="Mixed-corpus accuracy (MRR) vs. per-query cost across a 24-query session, log scale, as a Pareto frontier. The frontier runs uFuzzy, fuzzysort, Ekrina (indexed), Ekrina (acronym): Ekrina (acronym) tops MRR at 0.87 at 0.77 ms per query, Ekrina (indexed) reaches 0.84 at 0.55 ms, and everything else above 0.5 MRR, base Ekrina and Fuse.js (all opts, 0.79 at ~15 ms) included, is dominated." src="./pareto-query-light.svg">
</picture>

Its x-axis is the batch's per-query time, how long a query takes once the searcher has answered twenty-three real ones, and its frontier runs uFuzzy → fuzzysort → Ekrina (indexed) → Ekrina (acronym).
Base Ekrina sits off it because its batch pays for the mask build partway through, on the first query that needs the rescue, work its indexed twin did at construction, so the same 0.84 MRR costs it 0.80 ms per query against 0.55.
The fast end belongs to the bare-output engines, uFuzzy at 0.24 MRR and fuzzysort at 0.64; uFuzzy (all opts), at 0.76 the closest non-Ekrina row on quality, takes 1.29 ms per query against Ekrina (indexed)'s 0.55, and Fuse.js and fast-fuzzy are 11–35× slower.

**Backend one-shot workload** (a fresh process runs constructor + first answer): the chart lives in the README's Comparison section, deliberately the less flattering of the two there.
Its frontier runs `fuzzy` → Ekrina (indexed) → Ekrina (acronym): a no-index substring scan at 0.43 MRR owns the fast end, and every other configuration - uFuzzy included, once its constructor-and-first-call reality is measured rather than amortised - is dominated.
Base Ekrina is dominated too, by its indexed twin and only by a margin inside the tie band: 2.06 + 1.48 ms against 0.15 + 3.78 ms at the same 0.84 MRR, so building the mask index up front costs about what the first answer then saves.
This is where base Ekrina's lazy preparation shows up, in two parts against a 0.11 ms constructor.
A fresh searcher's first answer prepares the text of every item it matches, and a single-word query finds them with a scan of the raw strings (~2 ms at 10k).
The per-item mask index is built only on the first query that needs it: one with a second word, one of five or more characters that finds fewer than ten literal matches and so goes to the one-edit rescue, or one holding a character outside Latin letters and digits, which the raw scan cannot fold.
That is why a cold `two-words` answer costs more at 10k than `short-word`, and why `prefix`, a single word with too few literal matches to rule out a typo, costs more again (the per-query cells are in [`bench/results.json`](../bench/results.json)).
The batch's literal warmup never needs it, so its `first` column carries only the first part; the build lands on the third query, the first multi-word one.

_Both charts read the scorecard above out of [`bench/results.json`](../bench/results.json) ([`pareto.ts`](./pareto.ts)), so they cannot disagree with it; `pnpm bench` redraws them._

## Size, speed & search type

These tables position each library rather than rank them; the method is uniform throughout.
**Gzip** = esbuild `--bundle --minify` + gzip, tree-shaken to each lib's primary API (the size table is in [Libraries](#libraries)).
Every cell is process-cold ("One measurement model"), and each corpus gets two tables.
The scale table measures the one-shot workload: **index** = the constructor, **cold query** = mean first answer across the six timed queries (each in its own fresh process), **total** = the mean of constructor + first answer, summed inside each query's own child, **total rel** = that total relative to Ekrina (100% = same, lower = faster).
The batch table measures the session: **batch total** = one fresh process answering a short-word warmup match then every family's representative query once, **batch/query** = the mean of the 24 post-warmup queries, **batch rel** = batch total relative to Ekrina.
The aggregate row is a **geometric mean**: per-library times span orders of magnitude, so an arithmetic mean would only describe the slowest library; the geomean is the standard aggregate for multiplicative spreads, and the rel cells are equally the geomean of each rel column (a geomean of ratios is the ratio of geomeans).
These tables publish the 100k size; the 10k matrix and the scorecard carry the fine-grained view, and every cell of both sits in [`bench/results.json`](../bench/results.json).
The two corpora are described in "The corpus and the query families"; they're benched separately.
The mixed table only lists configurations that fold diacritics, i.e. actually do that corpus's task (cross-checked per query by [`bench/hits.test.ts`](../bench/hits.test.ts)); a fast non-folding row would be fast at a different, easier job, so those are omitted and named below the table.
The **_all libraries_** row is the corpus-wide view: the geometric mean of every shown configuration at that size.
**(all opts)** rows switch on every opt-in the library has: diacritic folding, multi-word, highlight/ranges output, and typo modes; base rows are stock defaults, and [Libraries](#libraries) itemizes which opt-in is which.
Typo modes are included because Ekrina's one-edit matching is always on and cannot be disabled, so holding another engine's typo mode off would time two engines doing different jobs.
Only uFuzzy is affected in practice. Fuse.js (Bitap) and fast-fuzzy (edit distance) are typo-tolerant in every configuration here.
Every child consumes its result counts, the runner asserts they are identical across a cell's processes, and [`bench/hits.test.ts`](../bench/hits.test.ts) records per-library match counts for every query, so the timings above are known to be timing comparable work.
Per-cell minimums and heap footprints are in [`bench/results.json`](../bench/results.json).
Ekrina leads its own table; the rest are alphabetical, so each library's base and (all opts) rows sit together and nothing is ordered by how well it did.

### ascii corpus

<!-- bench:speed-ascii -->
| Library                     |     index | cold query |     total | total rel |
|-----------------------------|----------:|-----------:|----------:|----------:|
| **Ekrina**                  |   0.34 ms |   12.83 ms |  13.13 ms |  **100%** |
| Ekrina (acronym)            |   0.43 ms |   12.98 ms |  13.31 ms |      101% |
| Ekrina (indexed)            |  12.49 ms |    2.94 ms |  14.77 ms |      112% |
| @nozbe/microfuzz            |  49.24 ms |   15.84 ms |  63.62 ms |      484% |
| @nozbe/microfuzz (all opts) | 113.15 ms |   18.28 ms |  66.74 ms |      508% |
| fast-fuzzy                  | 801.05 ms |   60.27 ms | 414.88 ms |     3159% |
| fast-fuzzy (all opts)       | 740.33 ms |   60.47 ms | 417.34 ms |     3178% |
| Fuse.js                     |   7.32 ms |  138.16 ms | 144.87 ms |     1103% |
| Fuse.js (all opts)          |   8.39 ms |  138.98 ms | 144.96 ms |     1104% |
| fuzzy                       |   0.06 ms |   19.25 ms |  19.29 ms |      147% |
| fuzzy (all opts)            |   0.05 ms |   19.14 ms |  19.18 ms |      146% |
| fuzzysort                   |   0.22 ms |   66.79 ms |  66.83 ms |      509% |
| match-sorter                |   0.05 ms |   26.21 ms |  26.25 ms |      200% |
| uFuzzy                      |   7.74 ms |    3.01 ms |   7.84 ms |       60% |
| uFuzzy (all opts)           |  10.69 ms |    3.58 ms |  12.56 ms |       96% |
| _all libraries (geomean)_   |   3.99 ms |   21.01 ms |  42.37 ms |      323% |
<!-- bench:end -->

**The session batch** (one process: a warmup match, then every family's representative query once):

<!-- bench:batch-ascii -->
| Library                     | batch/query | batch total | batch rel |
|-----------------------------|------------:|------------:|----------:|
| **Ekrina**                  |     3.00 ms |    76.65 ms |  **100%** |
| Ekrina (acronym)            |     3.26 ms |    83.66 ms |      109% |
| Ekrina (indexed)            |     2.22 ms |    55.71 ms |       73% |
| @nozbe/microfuzz            |    11.62 ms |   293.79 ms |      383% |
| @nozbe/microfuzz (all opts) |    10.91 ms |   281.40 ms |      367% |
| fast-fuzzy                  |    85.20 ms |  2190.62 ms |     2858% |
| fast-fuzzy (all opts)       |    90.04 ms |  2256.26 ms |     2944% |
| Fuse.js                     |   218.28 ms |  5374.24 ms |     7012% |
| Fuse.js (all opts)          |   199.72 ms |  4991.91 ms |     6513% |
| fuzzy                       |    35.12 ms |   870.60 ms |     1136% |
| fuzzy (all opts)            |    30.14 ms |   749.11 ms |      977% |
| fuzzysort                   |    11.39 ms |   400.33 ms |      522% |
| match-sorter                |    31.30 ms |   786.05 ms |     1026% |
| uFuzzy                      |     2.82 ms |    73.44 ms |       96% |
| uFuzzy (all opts)           |     3.90 ms |    98.86 ms |      129% |
| _all libraries (geomean)_   |    17.33 ms |   447.79 ms |      584% |
<!-- bench:end -->

### mixed corpus

<!-- bench:speed-mixed -->
| Library                     |    index | cold query |     total | total rel |
|-----------------------------|---------:|-----------:|----------:|----------:|
| **Ekrina**                  |  0.30 ms |   26.46 ms |  26.89 ms |  **100%** |
| Ekrina (acronym)            |  0.29 ms |   25.67 ms |  26.13 ms |       97% |
| Ekrina (indexed)            | 22.93 ms |    4.25 ms |  31.15 ms |      116% |
| @nozbe/microfuzz            | 53.47 ms |   26.48 ms | 113.51 ms |      422% |
| @nozbe/microfuzz (all opts) | 68.93 ms |   25.73 ms | 103.64 ms |      385% |
| Fuse.js (all opts)          |  5.40 ms |  183.49 ms | 191.36 ms |      712% |
| fuzzysort                   |  0.05 ms |  100.43 ms | 100.50 ms |      374% |
| match-sorter                |  0.04 ms |   39.75 ms |  39.81 ms |      148% |
| uFuzzy (all opts)           |  9.31 ms |    4.71 ms |  15.30 ms |       57% |
| _all libraries (geomean)_   |  2.05 ms |   26.65 ms |  52.47 ms |      195% |
<!-- bench:end -->

**The session batch** (one process: a warmup match, then every family's representative query once):

<!-- bench:batch-mixed -->
| Library                     | batch/query | batch total | batch rel |
|-----------------------------|------------:|------------:|----------:|
| **Ekrina**                  |     2.78 ms |    72.64 ms |  **100%** |
| Ekrina (acronym)            |     3.09 ms |    80.78 ms |      111% |
| Ekrina (indexed)            |     1.71 ms |    44.18 ms |       61% |
| @nozbe/microfuzz            |    15.62 ms |   400.99 ms |      552% |
| @nozbe/microfuzz (all opts) |    15.17 ms |   390.09 ms |      537% |
| Fuse.js (all opts)          |   144.04 ms |  3576.33 ms |     4924% |
| fuzzysort                   |     3.20 ms |   149.49 ms |      206% |
| match-sorter                |    23.39 ms |   592.47 ms |      816% |
| uFuzzy (all opts)           |     3.16 ms |    79.84 ms |      110% |
| _all libraries (geomean)_   |     7.89 ms |   216.05 ms |      297% |
<!-- bench:end -->

The acronym configuration runs strictly _more_ code per query (an extra tier, plus the one-edit rescues on candidates that reach it); its 100–102% cells are that extra work plus load swing.
Read sub-15% differences as statistical ties, the tie band from here on, and larger ones as real.
Folding uFuzzy sits at the edge of the tie band on this corpus: its batch is 115% of Ekrina's, 2.61 ms per query to Ekrina's 2.16.

Configurations that can't fold diacritics are omitted rather than flagged. A non-folding row on this corpus is timing a different, easier task (it silently misses accented matches), and we already _know_ it fails: on the accent family's representative query `kepa` (from "Kępa…") at 10k, base uFuzzy finds _0_ matches where its folding (all opts) config finds 4 and Ekrina 7 ([`bench/hits.test.ts`](../bench/hits.test.ts)).
Omitted: uFuzzy and fuse.js base configs (their (all opts) rows fold and stay), and fast-fuzzy and fuzzy entirely; they have no folding option at all.

### Reading the speed numbers

Every cell is process-cold, so read the columns as three different workloads, not three qualities of one number.
The **batch** column is the honest headline: one process, 24 distinct queries, and the amortisation each design promises either shows up or doesn't.
Ekrina's batch is carried by its architecture, a staged reject path (a per-item union of char-class bitmasks, then a native regex gate) cuts 90–100% of items before any ladder work, and the lazy preparation happens once per session: each item's text the first time it matches, and the mask index on the first multi-word query or the first that reaches the rescue.
_uFuzzy wins the raw batch at 100k on ascii_ (66% of Ekrina bare, where Ekrina (indexed) takes 74%) and its bare `batch/query` is the fastest in the set; folding, it ties base Ekrina on ascii (92%) but trails Ekrina (indexed), on mixed it trails base Ekrina at the edge of the tie band (115%) and takes 2.1× Ekrina (indexed)'s batch, and its MRR (0.24 bare, 0.75–0.76 folding) is what that speed leaves you with.
Ekrina's batch beats everything else - ~5× its parent microfuzz, 2× fuzzysort, ~9× match-sorter, ~16× fast-fuzzy (ascii; it can't fold), ~57× Fuse.js on mixed - while topping both scorecards outright.
The **cold query** column is where Ekrina's laziness shows up: ~13 ms mean at 100k, most of it the rescue's union-and-bigram mask build (Ekrina (indexed), which builds it in its 11–12 ms constructor, answers first in 2.4–3.2 ms), done once per searcher and visible per query in the 10k cells of [`bench/results.json`](../bench/results.json) (it lands on multi-word queries and on single words of five or more characters with fewer than ten literal matches, the substitution and prefix queries among the timed ones; the short word carries only the raw-gate scan).
An eager-index engine inverts this: fast-fuzzy's first answer is quick only because its constructor already ran for ~260 ms.
The **index** column plus the first answer is the one-shot measurement, and there `fuzzy`'s bare substring scan is the only thing faster than Ekrina at any quality level.
Cross-_type_ speed isn't apples-to-apples: **typo-tolerant** libs (Fuse.js, fast-fuzzy) do far more work per query, and non-folding configurations are omitted from the mixed table entirely (they would be timing a different task).
**fast-fuzzy is corpus-sensitive**: its trie rewards shared-prefix data but this natural-language corpus prunes less, dropping it among the slowest (on a combinatorial word-grid it measured far better; the corpus moves these numbers a lot).

## A frontend session: typing `grady` at 100k

Typing is a _sequence_: each query extends the last.
Ekrina's prefix-narrowing cache rescans only the previous query's mask-gate survivors, so successive keystrokes get faster; every other library runs a full scan per keystroke.
The probe types the doc's surname query `grady` from the 3-character UI gate onward (real UIs gate search behind 2–3 characters, because a 1–2 char query matches a huge fraction of the corpus and every rich-result library has to materialize it).
Each step is timed at its correct cache state (the untimed reset replays the previous prefix before every sample), on the 100k mixed corpus.

<!-- bench:session -->
| Library            | `gra` | `grad` | `grady` | session |
|--------------------|------:|-------:|--------:|--------:|
| Ekrina             |  2.54 |   1.45 |    0.58 |    4.57 |
| @nozbe/microfuzz   | 20.71 |  20.64 |   18.99 |   60.33 |
| fuzzysort          |  5.93 |   3.61 |    1.97 |   11.50 |
| uFuzzy (all opts)  |  3.99 |   2.02 |    2.02 |    8.03 |
| Fuse.js (all opts) | 82.37 |  75.97 |  104.30 |  262.64 |
<!-- bench:end -->

Ekrina's per-keystroke time falls _3.7×_ across the word (2.16 → 1.37 → 0.59) as the survivor cache narrows: the 3-character query is the widest candidate set the session ever sees, and it is the one that does the work.
Ekrina takes every step of the session, the wide opener included (2.16 vs uFuzzy's 3.73), and the session total by 1.8× (4.12 vs 7.51), while returning tiers and ranges against uFuzzy's bare index array, at 0.76 MRR to Ekrina's 0.84.
microfuzz stays at ~15–17 ms: same subsequence approach with no survivor cache, so nothing narrows between keystrokes.
Unlike the scorecard, this table is a single process rather than a median of five, so read its cells with the tie band in mind.
All rows assume a warm process: one-time work (Ekrina's mask build, fuzzysort's lazy target prep) happens at load, not on keystroke one; the cold cells above measure it.
Measured by [`bench/session.test.ts`](../bench/session.test.ts).

## Matching inside long text

Everything above matches short labels in a list; the other workload is one large string: `fuzzyMatch` over a document.
The hazard there is the fuzzy tier assembling a "match" from characters scattered across unrelated words, so the tier rejects any assembly covering less than 18% of the span it stretches across (`DENSITY_FLOOR` in [`src/fuzzy.ts`](../src/fuzzy.ts)).
The constant comes out of a measurement: with the floor disabled, this probe collects 570 junk chains across both corpora at every length, maxing out at _0.143_ density, while the sparsest genuine match (initials scattered across a four-word name) measures _0.211_; 0.18 splits the gap with margin both ways.

The probe: the document is the mixed corpus joined with spaces and sliced to graded lengths; queries are 40 real corpus words verified absent from the largest slice (no substring anywhere), so any hit is the fuzzy tier assembling a junk chain.

<!-- bench:longtext -->
| doc chars | junk rate | present hits | miss ms |
|----------:|----------:|-------------:|--------:|
|        64 |        0% |          8/8 |   0.004 |
|       128 |        0% |        15/15 |   0.004 |
|       256 |        0% |        20/20 |   0.005 |
|       512 |        0% |        20/20 |   0.007 |
|      1024 |        0% |        20/20 |   0.018 |
|      2048 |        0% |        20/20 |   0.030 |
|      4096 |        0% |        20/20 |   0.054 |
|      8192 |        0% |        20/20 |   0.107 |
|     16384 |        0% |        20/20 |   0.208 |
<!-- bench:end -->

Zero junk at every length, while every genuinely present word still matches (a present word is a substring, so `contains` needs no fuzzy assembly) and label-corpus behaviour is unchanged (same MRR, same ranks, slightly tighter sets: `rsaw` 8 → 7, ascii's `sgh` 55 → 31).
Miss time includes the one-edit rescues (a miss must fail those too), which is the work a document-length miss does for the typo rescues on labels; it stays around a fifth of a millisecond at 16k chars.
Residual exposure is the adjacent-word assembly (`zebra` over "zero … branch", density 0.38), structurally identical to wanted word-start matches like `hewo` → "hello world" (0.5), so no floor separates them; they need adjacency by luck, and they rank last when they occur.
Literal-only matching, for callers that want no fuzzy assemblies at all, is a one-line `tier` filter.
[`bench/longtext.test.ts`](../bench/longtext.test.ts) keeps this table as a regression guard, asserting the junk rate is exactly zero at every length.

## The recommendation

Everything above condenses to one recommendation: _pick Ekrina for list matching_, with two carve-outs the data supports.
Three things carry the claim, each measured in its own section:

- **Quality**: Ekrina (acronym) tops the scorecard on both corpora outright (0.87 mixed / 0.87 ascii), and base Ekrina (0.84) is still clear of every other library; the lead comes from scoring near 1 on every phrase and single-edit typo family at once, which no other library does.
- **Speed, measured cold**: the fastest 24-query session of anything above 0.5 MRR at both sizes (batch 14.8 ms at mixed 10k, ~0.5 ms per query after the first, and 10.0 ms / ~0.4 ms for Ekrina (indexed); ~4–57× under every typo-tolerant or tiered alternative), a near-zero constructor, ~5.5 kB gzip, zero deps. The honest asterisk is the first call: Ekrina prepares lazily, so a fresh searcher's first answer prepares what it matches, and its first multi-word or rescue-bound query builds the mask index over the whole list (a first answer averages ~3.4 ms at 10k and ~13 ms at 100k across the timed queries, or ~1.3 ms and ~2.4 ms once Ekrina (indexed) has spent ~2 ms and ~12 ms building the index up front); a workload that only ever asks one question of one searcher should read the one-shot numbers, where bare `fuzzy` is faster.
- **Long text**: the density floor holds `fuzzyMatch` junk at 0% at every measured document length, phrase probes included, so the same engine covers documents, not just labels.

The carve-outs:

- **Typo tolerance beyond a single edit.** The one-edit tiers correct every single-character typo from five characters up (transposition, insertion, deletion and substitution), scoring 0.89–0.99 on those families, and inside phrases too, where the failing word is corrected alone; from four characters they correct only when nothing matches as typed. _Two or more_ edits in one query still need real edit distance, and Ekrina deliberately refuses both deep scatter and the double-typo phrase.
  If user-typed queries over messy data must match through those, Fuse.js (Bitap) or fast-fuzzy (edit distance) is the right tool for the typos, and match-sorter or fuzzysort for the scatter (0.67–0.95 on the scatter families against Ekrina's 0.00–0.05); the scorecard measures what each gains and loses: 0.79 and 0.72 MRR on mixed for Fuse.js (all opts) and fast-fuzzy, at ~15 ms per cold query.
- **Raw throughput when a bare index array is enough.** uFuzzy wins the 100k ascii batch outright (66% of Ekrina bare, ahead of Ekrina (indexed)'s 74%; with folding it drops to 92%, a tie with base Ekrina, and on mixed its folding config trails base Ekrina at 115%) and owns the fastest bare per-query and miss cells at every size.
  Bare, it gives up most of the match quality to get there (0.24 MRR against Ekrina's 0.84); folded it scores 0.75–0.76, losing the joined-phrase and four-character typo families outright, and it has no ranges, tiers, or per-field config. A real trade, measured in full above.

The rest of the field is dominated on these benchmarks:

- **@nozbe/microfuzz**: Ekrina's parent; same subsequence approach, ~4–5× the batch at 100k, 2–17× larger result sets, no tier output. Its 0.52 mixed MRR sits 32 points under base Ekrina: it scores 0 on the substitution and phrase-typo families and 0.20 on insertion.
- **fuzzysort**: the fastest per-query time after uFuzzy, but its prepare-all pass lands a ~6 ms first call (57 ms at 100k) that stock usage absorbs inside the first `go()`, and it scores 0 on every phrase-typo and substitution family (0.64 MRR on mixed).
- **match-sorter**: tiered ranking but no ranges and no multi-word; it leads the scatter families and scores 0 on every phrase typo, 0.56 MRR at mid-pack speed.
- **fuzzy**: substring-only and order-sensitive; 0.10 on reversed phrases, 0.11 on the accent family, no ranges (0.43 MRR).
- **fast-fuzzy**: the heaviest build (~290 ms at 100k) and slowest queries on these corpora, and 0.12 or less on reversed phrases (0.72 MRR); its trie rewards shared-prefix data, which natural-language corpora don't provide.
