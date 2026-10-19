# Benchmarks: match quality and speed

Full data behind the README's summary: what each library calls a match, where it ranks the right answer, and how long a query takes.
Every measured table below is generated, and `pnpm bench` regenerates all of them: it measures, writes [`bench/results.json`](../bench/results.json), rewrites each table in place, and redraws the Pareto charts.
No measured cell in this document is typed by hand.

- `pnpm bench --docs` re-emits the tables from the committed `results.json` without measuring anything.
- `pnpm bench --check` exits nonzero if any table here disagrees with `results.json`.
- `pnpm bench --speed`, `pnpm bench --quality` and `pnpm bench --memory` run one stage of the measurement; `--runs=N` sets the fresh processes per cold cell (default 5, publish runs use 10).
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
- **cold query** = the first answer to the probe, every lazy slice unpaid: ekrina's raw-gate scan and rescue mask build, fuzzysort's prepare-all.
- **batch** = one process answering a short-word warmup match (like `grady`: guaranteed literal hit, absorbs the JIT and the first full scan) and then all twenty probes, once each: the realistic session. Warmth here is earned only by answering distinct real queries, no query is ever repeated, anywhere in the harness. The batch reports its total, the warmup (`first`), the mean of the twenty (`batch/query`), and each probe's own post-warmup time, which the per-probe tables show as **batch ms**.
- **one-shot** = constructor + first answer, summed inside one child's consecutive windows: the whole of "given a list, get an answer".

The JIT is included deliberately.
A cold first call runs unoptimised code, and that is exactly what a user's first call runs; by the twentieth distinct query the engine is as warm as a real session ever makes it.
The previous harness sampled hundreds of repeats of one query, which tiered the JIT far past anything realistic and hid every first call inside an untimed calibration probe, [docs/measurement.md](./measurement.md) records the move.

Which column matters depends on workload: search-as-you-type → **batch/query** (and the session table below for the keystroke chain); a backend one-shot over fresh data → **one-shot**; a first-keystroke latency budget over a prebuilt index → **cold query**.

### Timing method

**Medians across fresh processes, published; minimums kept.**
Timing noise is one-sided (GC, scheduler, and thermal interruptions only ever _add_ time), so the median across processes rejects spikes; the per-cell minimum, the noise-free floor, stays in [`bench/results.json`](../bench/results.json) but is never the headline, because best-of-N flatters.
Five processes per cell is the dev default and ten the publish setting (`pnpm bench --runs=N`): every number is milliseconds-scale under this model, so a handful of process samples resolves it, the old hundreds-of-samples machinery existed only to resolve steady-state microseconds that no real user ever sees.

Four guards keep a run honest:
result counts must be identical across a cell's processes (a variant whose answer drifts is not timing comparable work);
variant order rotates per repetition so thermal and load drift land evenly instead of on whichever library ran last;
base Ekrina measuring slower than its strictly-more-code acronym configuration fails the run outright (more code cannot be faster, a violated invariant means absorbed load, and the artifact is not written);
and the first cell is re-timed after the last as a drift canary.

Numbers are expected to vary per machine: swapping between a Mac ARM host and an AMD x64 showed subtly different relative results.

### The corpus and the twenty probes

Two seeded [Faker](https://github.com/faker-js/faker) corpora, benched separately: **ascii** (en locale, effectively no diacritics) and **mixed** (mostly en with every 7th item from fr/pl generators, ~5% of items carry a diacritic, a realistic international dataset; items are ~97% unique at 10k, faker repeats a few names).
Both are frozen JSON snapshots (`bench/corpus-*.json`), so runs do no generation work and the data can't drift when faker changes between versions; regenerating them is a deliberate act ([`bench/corpus-gen.test.ts`](../bench/corpus-gen.test.ts)) that rewrites history for every rank table here.

Each query runs against the same 10,000 items in every library, and each library is scored on three things:

- **Where it ranks the queried item.**
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
  Each one is generated from the frozen snapshot by a fixed rule: the first word of the item at sample position 4, the first _near-unique_ ≥7-char word from position 1300 on (≤ 2 corpus items may contain it, so a typo probe's rank measures ranking rather than position inside a tie block of identical scores), the initials of the first 3-word item, and so on ([`bench/corpus.ts`](../bench/corpus.ts)).
  Change the corpus snapshot and every query changes with it.
  Deriving from a real item is also the only reason _rank_ is measurable at all: each query has a known right answer to look for.
- **One probe per matching behaviour, including the ones ekrina loses.**
  The set walks the capability matrix; the table below names each probe and what it isolates.
- **Graded degradation instead of a pass/fail cliff.**
  The three scatter probes mutilate _one_ source word in steps (drop one middle char, drop every third, keep every other) because a single scattered query only says who passes it; the gradient locates each engine's _effective fuzzy limit_, which is the actual design difference between the chain matchers, the typo engines, and uFuzzy's no-gaps default.
  The heavy step is deliberately past any sane threshold: an engine that still "matches" there is reporting noise tolerance, not typo tolerance.
  Three further probes from the same source word degrade along a different axis: a **transposition** (two adjacent chars swapped), an **insertion** (a doubled keystroke), and a **substitution** (one wrong character, chosen to be absent from the source so it also removes a character class). All three keep the query close to the source but break the subsequence property, so no subsequence chain can represent them: they separate the engines that model edits from the engines that model subsequences.
  The scatter-light probe is the fourth single-character edit, a **deletion**, which does stay a subsequence and so is reachable without any rescue.

The resulting probes:

| #     | probe                         | query                     | isolates                                              |
| ----- | ----------------------------- | ------------------------- | ----------------------------------------------------- |
| 1     | long single word              | `ergonomic`               | baseline agreement; rank on a common word             |
| 2     | short single word             | `grady`                   | low-signal input, fewer chars for gates and chunking  |
| 3     | two-word phrase               | `handcrafted wooden`      | tokenization (in corpus order: any engine can pass)   |
| 4     | two words, reversed           | `wooden handcrafted`      | true order-independence, substring engines get 0      |
| 5     | two words, first mistyped     | `handcxafted wooden`      | a typo inside a phrase; word-level rescue             |
| 6     | two words, second mistyped    | `handcrafted wooxen`      | the rescue must find the failing word, not assume it  |
| 7     | reversed phrase, one mistyped | `wooden handcxafted`      | the correction must survive order-independence        |
| 8     | two words, both mistyped      | `handcxafted wooxen`      | two edits: refusal beats guessing (unscored)          |
| 9     | plural typed, singular stored | `romanowskis`             | a trailing `-s` the corpus lacks, one deletion       |
| 10    | prefix / partial word         | `auxen`                   | precision at a near-unique singleton                  |
| 11    | mid-word infix                | `gonom`                   | contains-anywhere vs start-anchored ranking           |
| 12–14 | typo gradient (light → heavy) | `hugutte` `huuete` `hget` | each engine's effective fuzzy limit                   |
| 15    | transposition typo            | `hugeutte`                | adjacent-swap handling, rescue tier vs edit distance  |
| 16    | insertion typo                | `hugueette`               | a doubled keystroke, one character too many           |
| 17    | substitution typo             | `huguxtte`                | one wrong character, absent from the source entirely  |
| 18    | acronym                       | `rsaw`                    | deliberate acronym support vs accidental subsequences |
| 19    | accent-stripped               | `kepa`                    | diacritic folding                                     |
| 20    | garbage                       | `qxzwkv`                  | the reject path, verifying no impossible matches      |

Twenty queries aren't a workload: they can't estimate throughput or tail latency (the speed tables and the session probe below do that); they are chosen to make every library's matching _policy_ visible in one screen of tables, with each library given at least one probe where its specialty should win (token engines take the reversed phrase, folding engines the accent probe, edit-distance engines the three single-edit typo probes).
MRR over eighteen scored queries is correspondingly coarse: read differences of ±0.02 as ties.

## Build time

<!-- bench:build -->
| build |  Ekrina | Ekrina (indexed) | @nozbe/microfuzz | fast-fuzzy | Fuse.js | uFuzzy (all opts) |
|-------|--------:|-----------------:|-----------------:|-----------:|--------:|------------------:|
| 10k   | 0.11 ms |          1.98 ms |          3.96 ms |   27.88 ms | 1.17 ms |           4.50 ms |
| 100k  | 0.26 ms |         12.37 ms |         51.23 ms |  293.15 ms | 5.30 ms |           8.25 ms |
<!-- bench:end -->

Measured on the mixed corpus (process-cold constructor timings; build time barely differs between corpora).
Fuse.js's minimal build is the flip side of its slow queries: its "index" is trivial and the work is deferred to query time.
fast-fuzzy's trie is the opposite trade: the heaviest build in the set is what its subtree pruning needs.
fuzzysort has no constructor at all, so it has no column here, its lazy prepare-all pass lands in its first query's cold cell, where stock usage actually meets it.
uFuzzy's ~4 ms base construction is a process-cold discovery of its own: `new uFuzzy()` compiles the engine's regex machinery on first construction (a second construction takes 0.03 ms), so "keeps no index" is true per item but not per process, the base cell is near-identical at 10k and 100k, which is the proof it never touches the list; the (all opts) column shown here also latinizes the haystack, which is why it grows with the corpus (4.5 → 8.2 ms).
microfuzz's column is its whole index: the constructor normalises every item and builds its word sets up front, so nothing is left for the first search to pay (the memory table below gains 0.05 MB on its first query, and its 10k cold query, 1.64 ms, sits close to its 1.16 ms batch/query).
Ekrina's constructor only allocates - field text is trimmed, normalised and masked the first time an item survives a gate - so a 100k list swap takes about a millisecond, and the first query then carries what construction deferred (its cold cells).
Ekrina (indexed), the same searcher with its mask index built up front, moves the larger of those deferred costs into its constructor: 1.98 ms at 10k and 12.37 ms at 100k.

## Memory

<!-- bench:memory -->
| Library                     | built MB | + `grady` | + `qxzwkv` | + `ergonomic` | dropped MB |
|-----------------------------|---------:|----------:|-----------:|--------------:|-----------:|
| Ekrina                      |     1.93 |      2.45 |       3.24 |          3.37 |       0.17 |
| Ekrina (acronym)            |     1.93 |      2.45 |       3.25 |          3.37 |       0.18 |
| Ekrina (indexed)            |     2.71 |      3.32 |       3.34 |          3.44 |       0.15 |
| @nozbe/microfuzz            |    45.74 |     45.79 |      45.79 |         45.79 |       0.11 |
| @nozbe/microfuzz (all opts) |    45.74 |     45.79 |      45.79 |         45.79 |       0.11 |
| fast-fuzzy                  |   194.20 |    195.57 |     195.57 |        195.57 |       0.14 |
| fast-fuzzy (all opts)       |   194.21 |    195.58 |     195.58 |        195.58 |       0.15 |
| Fuse.js                     |     6.92 |      7.00 |       7.00 |          7.00 |       0.11 |
| Fuse.js (all opts)          |     6.92 |      7.03 |       7.11 |          7.06 |       0.17 |
| fuzzy                       |     0.02 |      0.04 |       0.04 |          0.05 |       0.05 |
| fuzzy (all opts)            |     0.02 |      0.03 |       0.03 |          0.03 |       0.03 |
| fuzzysort                   |     0.02 |     40.73 |      40.73 |         40.94 |      40.94 |
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

## Match quality, probe by probe

Each library has its own definition of a match, so raw outputs aren't directly comparable.
To surface the differences, the twenty probes run against every library; queries are from the mixed corpus at 10k.
One small table per query:

- **rank** = where the queried item placed (1 = top hit; ✗ = matched other things but lost the source;, = returned nothing)
- **matches** = how many of the 10,000 items the library returned
- **index ms** = the constructor call, in the same fresh process
- **cold ms** = the first answer to this query in a fresh process, JIT, caches and lazy slices all genuinely cold
- **total ms** = index + cold, summed inside each child's consecutive windows: the cold one-shot for this exact query
- **batch ms** = this probe's time inside the batch run, after the warmup match, mid-session, lazy work landing on whichever probe triggers them

Every cell is process-cold ("One measurement model"), so the per-probe tables show exactly which queries make each library do the work: ekrina's mask build appears on every multi-word probe and on every probe of five or more characters with fewer than ten literal matches, fuzzysort's prepare-all on every first call.
Magnitude only; the rigorous timings are the speed tables below.

Each library appears once, at its base configuration.
Its "(all opts)" row joins it only on the probes where the opt-ins moved the source's rank inside the top ten, so a table that widens is a table where switching those options on changed whether, or where, a picker would show the item.
Deep-rank wobble doesn't qualify: rank 142 and rank 145 are both invisible, and the difference between them is not a row.

Two scorecard libraries are left out of the per-query tables to keep them readable.
fuzzy behaves like a less capable microfuzz: identical ranks on the plain-word, two-word, prefix, and light-typo probes; it drifts on the deep-typo and acronym probes, returns nothing on the reversed-phrase probe (order-sensitive), and misses the accent probe outright (no folding).
match-sorter never places best on any query: some shown library always matches or beats it.
Both keep full per-query cells in [`bench/results.json`](../bench/results.json).
The garbage query `qxzwkv` gets a table of its own instead: it returns 0 everywhere, so there is no rank to report, but how long it takes to return nothing is the whole point of the probe.

### long word: `ergonomic`

<!-- bench:probe-long-word -->
| Library          | rank | matches | index ms | cold ms | total ms | batch ms |
|------------------|-----:|--------:|---------:|--------:|---------:|---------:|
| Ekrina           |    1 |      76 |     0.12 |    2.41 |     2.54 |     1.85 |
| @nozbe/microfuzz |    1 |      76 |     4.00 |    1.78 |     5.79 |     1.60 |
| fast-fuzzy       |   13 |      82 |    27.60 |   12.39 |    40.01 |     8.73 |
| Fuse.js          |    1 |      81 |     1.18 |   17.09 |    18.27 |    13.75 |
| fuzzysort        |   20 |      76 |     0.03 |    6.18 |     6.21 |     0.67 |
| uFuzzy           |   29 |      76 |     3.98 |    1.03 |     5.02 |     0.34 |
<!-- bench:end -->

The subsequence libraries agree on the set (76); the typo engines add a handful (81–82). The speed comparison is meaningful because they are returning near enough the same thing.
Rank is the differentiator: Ekrina/microfuzz put the source first; fuzzysort and uFuzzy sink it to 20th–29th.

### short word: `grady`

<!-- bench:probe-short-word -->
| Library          | rank | matches | index ms | cold ms | total ms | batch ms |
|------------------|-----:|--------:|---------:|--------:|---------:|---------:|
| Ekrina           |    1 |      19 |     0.11 |    2.12 |     2.23 |     0.52 |
| @nozbe/microfuzz |    1 |      36 |     3.98 |    1.70 |     5.69 |     1.93 |
| fast-fuzzy       |    2 |     382 |    27.79 |   12.72 |    40.47 |     8.51 |
| Fuse.js          |    1 |     375 |     1.20 |   10.59 |    11.76 |     7.62 |
| fuzzysort        |    2 |      36 |     0.03 |    6.11 |     6.13 |     0.41 |
| uFuzzy           |    2 |      19 |     3.93 |    0.98 |     4.94 |     0.21 |
<!-- bench:end -->

A second plain-word probe from elsewhere in the corpus. Ekrina ranks the source first, as on the long word, and matches uFuzzy's 19-row set, the tightest here, because the one-edit rescue stops once ten literal hits fill the page, so a query this ordinary runs no corrections.

### two words: `handcrafted wooden`

<!-- bench:probe-two-words -->
| Library          | rank | matches | index ms | cold ms | total ms | batch ms |
|------------------|-----:|--------:|---------:|--------:|---------:|---------:|
| Ekrina           |    1 |       5 |     0.11 |    3.16 |     3.27 |     2.54 |
| @nozbe/microfuzz |    1 |       5 |     3.99 |    1.85 |     5.83 |     1.32 |
| fast-fuzzy       |    1 |      95 |    28.18 |   12.88 |    41.24 |     7.47 |
| Fuse.js          |    1 |      95 |     1.15 |   34.81 |    35.95 |    30.35 |
| fuzzysort        |    1 |       5 |     0.03 |    6.16 |     6.19 |     0.47 |
| uFuzzy           |    2 |       5 |     4.01 |    0.97 |     4.96 |     0.23 |
<!-- bench:end -->

Five items contain both words; every subsequence library returns exactly those five.
The typo engines return 19× that, and Fuse.js takes ~35 ms cold to do it (its extended-search tokenization is the slowest path here).
One caveat on the agreement: the phrase is in corpus order, so it is a contiguous substring of the source: engines with no tokenization at all pass this probe for free.
The next probe removes that shortcut.

### two words, reversed: `wooden handcrafted`

<!-- bench:probe-two-words-reversed -->
| Library           | rank | matches | index ms | cold ms | total ms | batch ms |
|-------------------|-----:|--------:|---------:|--------:|---------:|---------:|
| Ekrina            |    1 |       5 |     0.11 |    3.17 |     3.28 |     0.58 |
| @nozbe/microfuzz  |    1 |       5 |     3.97 |    1.78 |     5.73 |     1.51 |
| fast-fuzzy        |    5 |      76 |    28.37 |   12.25 |    40.73 |     6.95 |
| Fuse.js           |    1 |      76 |     1.15 |   34.21 |    35.34 |    29.88 |
| fuzzysort         |    1 |       5 |     0.03 |    6.07 |     6.10 |     0.31 |
| uFuzzy            |    — |       0 |     4.02 |    0.70 |     4.72 |     0.19 |
| uFuzzy (all opts) |    2 |       5 |     4.58 |    3.43 |     8.00 |     0.76 |
<!-- bench:end -->

These are the same two words in the opposite order, so this is the probe that actually isolates tokenized matching.
The tokenizing engines keep exactly the five items at rank 1; uFuzzy's default (in-order terms), match-sorter, and fuzzy all drop to _0 matches_ on a query a user would type without thinking.
(fuzzysort passes not by tokenizing but by chaining subsequences; the same permissiveness that hurts it elsewhere happens to cover word order.)

### two words, one mistyped: `handcxafted wooden`

<!-- bench:probe-two-words-typo -->
| Library           | rank | matches | index ms | cold ms | total ms | batch ms |
|-------------------|-----:|--------:|---------:|--------:|---------:|---------:|
| Ekrina            |    1 |       5 |     0.11 |    2.86 |     2.99 |     0.22 |
| @nozbe/microfuzz  |    — |       0 |     4.00 |    1.59 |     5.63 |     1.35 |
| fast-fuzzy        |    1 |      95 |    28.02 |   12.61 |    40.55 |     6.61 |
| Fuse.js           |    1 |      95 |     1.15 |   34.58 |    35.77 |    30.02 |
| fuzzysort         |    — |       0 |     0.03 |    5.83 |     5.86 |     0.27 |
| uFuzzy            |    — |       0 |     3.95 |    0.68 |     4.64 |     0.18 |
| uFuzzy (all opts) |    2 |       5 |     4.58 |    2.96 |     7.55 |     1.82 |
<!-- bench:end -->

The same phrase with one character wrong in the first word.
This used to be the probe Ekrina did not answer, a fifteen-character query offers fifteen substitution positions to guess from, and the old restriction to single-word queries is what stopped the rescue inventing matches at that width.
The multi-word rescue reaches it without reopening that hazard by inverting the search: the words that _do_ occur literally pin the candidate fields first, and only the one failing word is corrected, over that handful of fields rather than the corpus.
The three probes after this one stress the same mechanism from each side, the typo in the other word, the phrase reversed, and both words wrong at once, where refusing is the only right answer.

### two words, second mistyped: `handcrafted wooxen`

<!-- bench:probe-two-words-typo-second -->
| Library           | rank | matches | index ms | cold ms | total ms | batch ms |
|-------------------|-----:|--------:|---------:|--------:|---------:|---------:|
| Ekrina            |    1 |       5 |     0.11 |    2.85 |     2.96 |     0.15 |
| @nozbe/microfuzz  |    — |       0 |     3.95 |    1.60 |     5.55 |     1.59 |
| fast-fuzzy        |    1 |      88 |    27.66 |   12.84 |    40.50 |     6.09 |
| Fuse.js           |    1 |      88 |     1.18 |   36.12 |    37.36 |    30.33 |
| fuzzysort         |    — |       0 |     0.03 |    5.79 |     5.82 |     0.27 |
| uFuzzy            |    — |       0 |     4.04 |    0.69 |     4.74 |     0.17 |
| uFuzzy (all opts) |    2 |       5 |     4.58 |    2.95 |     7.55 |     1.27 |
<!-- bench:end -->

The rescue cannot assume which word failed; it has to find it.
Engines that only tolerate edits near the query's start, or that anchor on the first token, drop the source here.

### reversed phrase, one mistyped: `wooden handcxafted`

<!-- bench:probe-two-words-typo-reversed -->
| Library            | rank | matches | index ms | cold ms | total ms | batch ms |
|--------------------|-----:|--------:|---------:|--------:|---------:|---------:|
| Ekrina             |    1 |       5 |     0.11 |    2.95 |     3.06 |     0.14 |
| @nozbe/microfuzz   |    — |       0 |     4.01 |    1.50 |     5.50 |     1.00 |
| fast-fuzzy         |    — |       0 |    27.71 |   10.67 |    38.43 |     5.69 |
| Fuse.js            |    — |       0 |     1.17 |   33.09 |    34.26 |    30.19 |
| Fuse.js (all opts) |    1 |       5 |     1.18 |   14.38 |    15.54 |    10.62 |
| fuzzysort          |    — |       0 |     0.03 |    5.76 |     5.79 |     0.29 |
| uFuzzy             |    — |       0 |     4.03 |    0.71 |     4.74 |     0.18 |
| uFuzzy (all opts)  |    2 |       5 |     4.56 |    3.43 |     7.98 |     0.66 |
<!-- bench:end -->

Both hard axes at once: the words are out of corpus order _and_ one of them is mistyped, so a substring engine has nothing to hold on to and an in-order typo engine loses the phrase.
The corrected phrase must still match through the order-independent multi-word tier.

### two words, both mistyped: `handcxafted wooxen`

<!-- bench:probe-two-words-double-typo -->
| Library          | rank | matches | index ms | cold ms | total ms | batch ms |
|------------------|-----:|--------:|---------:|--------:|---------:|---------:|
| Ekrina           |    — |       0 |     0.11 |    2.44 |     2.55 |     0.09 |
| @nozbe/microfuzz |    — |       0 |     4.00 |    1.59 |     5.60 |     1.03 |
| fast-fuzzy       |    ✗ |      88 |    27.71 |   12.53 |    40.25 |     5.78 |
| Fuse.js          |    ✗ |      88 |     1.17 |   35.18 |    36.32 |    30.22 |
| fuzzysort        |    — |       0 |     0.03 |    5.82 |     5.85 |     0.27 |
| uFuzzy           |    — |       0 |     4.06 |    0.69 |     4.77 |     0.16 |
<!-- bench:end -->

Two edits in one phrase, so no one-edit rescue can explain it, and like the garbage probe there is no rank column that matters: the honest answer is nothing.
Ekrina must return 0 here, anything else means the rescue guessed, while the edit-distance engines legitimately match it, at their usual candidate-set width.
[`bench/hits.test.ts`](../bench/hits.test.ts) pins the refusal as an assertion, the same way the garbage probe is pinned.

### plural typed, singular stored: `romanowskis`

<!-- bench:probe-plural-to-singular -->
| Library           | rank | matches | index ms | cold ms | total ms | batch ms |
|-------------------|-----:|--------:|---------:|--------:|---------:|---------:|
| Ekrina            |    1 |       2 |     0.11 |    5.25 |     5.36 |     0.84 |
| @nozbe/microfuzz  |    — |       0 |     3.97 |    1.64 |     5.59 |     1.10 |
| fast-fuzzy        |    1 |      53 |    27.70 |   12.22 |    39.59 |     5.29 |
| Fuse.js           |    1 |      51 |     1.16 |   19.40 |    20.54 |    15.91 |
| fuzzysort         |    — |       0 |     0.03 |    5.81 |     5.84 |     0.17 |
| uFuzzy            |    — |       0 |     3.93 |    0.67 |     4.62 |     0.16 |
| uFuzzy (all opts) |    1 |       2 |     4.51 |    2.16 |     6.69 |     1.22 |
<!-- bench:end -->

A trailing `s` the corpus does not hold, which is one deletion and therefore exactly what the one-edit rescue exists for.
The subsequence engines return _0_: a plural is not a subsequence of its singular, because the trailing character has nothing left to match.
Only edit-distance matching reaches it, and Ekrina and uFuzzy's SingleError configuration both land the source at rank 1 from two candidates, uFuzzy's own default finds nothing.
fast-fuzzy and Fuse.js also rank it first, from 53 and 51 candidates, twenty-five times the set for the same answer.
Only the `-s` plural is reachable this way: `-es`, `-ves` and `-ies` are two or three edits, and no rescue tiering closes that without a stemmer.

### prefix: `auxen`

<!-- bench:probe-prefix -->
| Library          | rank | matches | index ms | cold ms | total ms | batch ms |
|------------------|-----:|--------:|---------:|--------:|---------:|---------:|
| Ekrina           |    1 |      16 |     0.11 |    5.18 |     5.29 |     0.82 |
| @nozbe/microfuzz |    1 |       1 |     3.94 |    1.66 |     5.60 |     1.14 |
| fast-fuzzy       |    1 |     452 |    27.84 |   13.05 |    40.86 |     5.14 |
| Fuse.js          |    1 |     444 |     1.17 |   10.20 |    11.35 |     7.78 |
| fuzzysort        |    1 |       1 |     0.03 |    5.84 |     5.87 |     0.27 |
| uFuzzy           |    1 |       1 |     4.12 |    0.94 |     5.04 |     0.24 |
<!-- bench:end -->

One item matches this prefix literally, and the pure subsequence engines return exactly it.
Ekrina returns 16 because its one-edit rescue also admits the corrections of `auxen`, all scored below the literal `prefix` hit that takes rank 1. The always-on typo tolerance returns a wider set on a query that did not need it.
The typo engines are the other end of that trade, ~450 candidates for the same one true hit.

### infix: `gonom`

<!-- bench:probe-infix -->
| Library          | rank | matches | index ms | cold ms | total ms | batch ms |
|------------------|-----:|--------:|---------:|--------:|---------:|---------:|
| Ekrina           |    5 |      76 |     0.11 |    2.11 |     2.22 |     0.33 |
| @nozbe/microfuzz |    5 |      88 |     3.99 |    1.74 |     5.71 |     1.16 |
| fast-fuzzy       |   14 |     197 |    29.33 |   13.99 |    43.55 |     4.10 |
| Fuse.js          |    5 |     174 |     1.18 |   10.19 |    11.38 |     7.19 |
| fuzzysort        |   13 |      88 |     0.03 |    6.20 |     6.23 |     0.49 |
| uFuzzy           |   58 |      76 |     3.91 |    1.06 |     4.98 |     0.28 |
<!-- bench:end -->

A mid-word slice of "ergonomic", so nothing can prefix-match: this probe separates contains-anywhere ranking from start-anchored ranking.
Ekrina, microfuzz and Fuse.js agree on rank 5, four items outrank the source legitimately, while the start-anchored rankers sink it (fuzzysort 13th, uFuzzy 58th).

### the fuzzy limit: `hugutte` / `huuete` / `hget`

Three probes degrade one source word ("Huguette", near-unique in the corpus) in steps: **light** drops one middle char (`hugutte`, a sloppy keystroke), **medium** drops every third char (`huuete`), **heavy** keeps only every other char (`hget`, 1–2 char fragments).
Where a library stops surfacing the source is its effective fuzzy limit.

**light (`hugutte`):**

<!-- bench:probe-scatter-light -->
| Library           | rank | matches | index ms | cold ms | total ms | batch ms |
|-------------------|-----:|--------:|---------:|--------:|---------:|---------:|
| Ekrina            |    1 |       1 |     0.11 |    4.67 |     4.78 |     0.56 |
| @nozbe/microfuzz  |    1 |       5 |     3.98 |    1.67 |     5.66 |     0.88 |
| fast-fuzzy        |    1 |       1 |    27.59 |   12.56 |    40.15 |     3.80 |
| Fuse.js           |    1 |       1 |     1.17 |   10.61 |    11.78 |     8.01 |
| fuzzysort         |    1 |       5 |     0.03 |    6.09 |     6.12 |     0.24 |
| uFuzzy            |    — |       0 |     3.90 |    0.68 |     4.59 |     0.16 |
| uFuzzy (all opts) |    1 |       1 |     4.56 |    1.53 |     6.09 |     0.68 |
<!-- bench:end -->

**medium (`huuete`):**

<!-- bench:probe-scatter-medium -->
| Library          | rank | matches | index ms | cold ms | total ms | batch ms |
|------------------|-----:|--------:|---------:|--------:|---------:|---------:|
| Ekrina           |    1 |       1 |     0.11 |    4.83 |     4.94 |     0.53 |
| @nozbe/microfuzz |    1 |       9 |     3.99 |    1.72 |     5.71 |     0.89 |
| fast-fuzzy       |    1 |      26 |    28.14 |   13.32 |    41.15 |     3.95 |
| Fuse.js          |    3 |      26 |     1.19 |    9.78 |    10.97 |     7.53 |
| fuzzysort        |    1 |       9 |     0.03 |    6.06 |     6.09 |     0.27 |
| uFuzzy           |    — |       0 |     3.91 |    0.68 |     4.58 |     0.16 |
<!-- bench:end -->

**heavy (`hget`):**

<!-- bench:probe-scatter-heavy -->
| Library          | rank | matches | index ms | cold ms | total ms | batch ms |
|------------------|-----:|--------:|---------:|--------:|---------:|---------:|
| Ekrina           |    — |       0 |     0.11 |    1.98 |     2.08 |     0.23 |
| @nozbe/microfuzz |   21 |      67 |     4.03 |    1.72 |     5.76 |     0.89 |
| fast-fuzzy       |    ✗ |      24 |    27.40 |   11.47 |    39.10 |     3.51 |
| Fuse.js          |    ✗ |      24 |     1.17 |    7.66 |     8.82 |     4.83 |
| fuzzysort        |    1 |      67 |     0.03 |    6.05 |     6.08 |     0.28 |
| uFuzzy           |    — |       0 |     3.96 |    0.74 |     4.66 |     0.20 |
<!-- bench:end -->

The gradient locates each engine's limit.
Ekrina surfaces the source _first with exactly one row_ through light and medium, then refuses outright at the heavy grade: 1–2 char fragments fail its chunking rules, and returning nothing beats returning the 67 junk chains the chain engines assemble.
microfuzz keeps matching at every level (rank 21 in 67 rows on `hget`), the behaviour Ekrina inherited and deliberately changed to refusal; fuzzysort even ranks the source first there, by accepting the same 67-chain noise.
The typo engines hold rank 1 on light but shed precision as the signal thins: Fuse.js slips to 3rd on medium and both lose the source at heavy (✗, 24 junk rows).
uFuzzy's default tolerates no intra-word gaps at all, 0 at every level.

### the transposition: `hugeutte`

<!-- bench:probe-transposition -->
| Library           | rank | matches | index ms | cold ms | total ms | batch ms |
|-------------------|-----:|--------:|---------:|--------:|---------:|---------:|
| Ekrina            |    1 |       1 |     0.11 |    4.57 |     4.68 |     0.36 |
| @nozbe/microfuzz  |    ✗ |       2 |     3.99 |    1.75 |     5.71 |     0.87 |
| fast-fuzzy        |    1 |       6 |    27.50 |   13.49 |    40.99 |     4.19 |
| Fuse.js           |    1 |       6 |     1.18 |   14.31 |    15.47 |    10.89 |
| fuzzysort         |    ✗ |       2 |     0.03 |    6.03 |     6.06 |     0.15 |
| uFuzzy            |    — |       0 |     3.97 |    0.68 |     4.65 |     0.15 |
| uFuzzy (all opts) |    1 |       1 |     4.55 |    1.64 |     6.20 |     0.86 |
<!-- bench:end -->

The fourth typo probe degrades the same source word along a different axis: two adjacent characters swapped (`huguette` → `hugeutte`), same character count, wrong order.
Deletions leave a query that is still a subsequence of its source; a transposition does not, so no subsequence _chain_ can represent it: microfuzz and fuzzysort lose the source (✗; their two "matches" are other items the letters happen to chain through) and uFuzzy returns 0.
Ekrina does not rely on subsequence here: after every tier in the ladder misses, a dedicated rescue retries each single-edit correction of the query and accepts only real-tier hits, scored as the corrected query's tier + 2.1 (tier `corrected`).
That surfaces the source _first, with exactly one row_. The edit-distance engines also rank it first but arrive with 6 candidates.
The penalty is sized so that even the best correction sorts below the weakest literal tier (`contains`): a correction is a guess at what the user meant, a substring match is something they actually typed, so the literal hit always wins. Sizing it lower sinks infix ranking, because another item's guess then displaces the item the query literally appears in.
Multi-error edits (two or more) remain the edit-distance engines' territory, and the scorecard measures that boundary.

### the insertion: `hugueette`

<!-- bench:probe-insertion -->
| Library           | rank | matches | index ms | cold ms | total ms | batch ms |
|-------------------|-----:|--------:|---------:|--------:|---------:|---------:|
| Ekrina            |    1 |       1 |     0.11 |    4.66 |     4.77 |     0.34 |
| @nozbe/microfuzz  |    — |       0 |     3.89 |    1.40 |     5.32 |     0.92 |
| fast-fuzzy        |    1 |       1 |    28.92 |   12.83 |    41.78 |     3.98 |
| Fuse.js           |    1 |       1 |     1.20 |   15.55 |    16.76 |    11.17 |
| fuzzysort         |    — |       0 |     0.03 |    5.84 |     5.87 |     0.13 |
| uFuzzy            |    — |       0 |     3.89 |    0.67 |     4.55 |     0.15 |
| uFuzzy (all opts) |    1 |       1 |     4.52 |    1.74 |     6.26 |     0.91 |
<!-- bench:end -->

A doubled keystroke (`huguette` → `hugueette`), one character too many.
A subsequence engine cannot represent an _extra_ character at all (there is no way to skip a query character), so microfuzz, fuzzysort and uFuzzy return _0_ matches rather than ranking the source poorly.
Ekrina, fast-fuzzy and Fuse.js all return exactly the source, at rank 1.
Ekrina gets there by dropping each character of the query in turn and rerunning the ladder on the corrections (tier `inserted`), which adds a rescue pass on this query but nothing on the queries that match literally.

### the substitution: `huguxtte`

<!-- bench:probe-substitution -->
| Library           | rank | matches | index ms | cold ms | total ms | batch ms |
|-------------------|-----:|--------:|---------:|--------:|---------:|---------:|
| Ekrina            |    1 |       1 |     0.11 |    4.43 |     4.54 |     0.25 |
| @nozbe/microfuzz  |    — |       0 |     3.92 |    1.42 |     5.31 |     0.84 |
| fast-fuzzy        |    1 |       1 |    28.22 |   13.02 |    41.23 |     4.02 |
| Fuse.js           |    1 |       1 |     1.16 |   15.51 |    16.67 |    11.16 |
| fuzzysort         |    — |       0 |     0.03 |    5.75 |     5.78 |     0.11 |
| uFuzzy            |    — |       0 |     3.92 |    0.66 |     4.59 |     0.16 |
| uFuzzy (all opts) |    1 |       1 |     4.56 |    1.65 |     6.21 |     0.75 |
<!-- bench:end -->

One wrong character, and deliberately one the source does not contain anywhere (`e` → `x`).
That second property is why this is the hardest of the four edits for Ekrina specifically: the char-class bitmask gate rejects an item missing any of the query's character classes, so a single character absent from the corpus item would otherwise eliminate it before any tier runs.
Reaching it at all required the gate to tolerate exactly one missing class, the change that slowed the library most, because that gate is what rejects 90–100% of items on every other query (see "Reading the speed numbers").
The matcher itself is quick: one half of the query must survive a single substitution, so the two halves' occurrences are the only windows worth testing.
Same outcome as the insertion probe. The three subsequence engines return 0, the typo-tolerant engines and Ekrina return exactly the source.

### acronym: `rsaw`

<!-- bench:probe-acronym -->
| Library          | rank | matches | index ms | cold ms | total ms | batch ms |
|------------------|-----:|--------:|---------:|--------:|---------:|---------:|
| Ekrina           |    2 |       7 |     0.11 |    2.13 |     2.25 |     0.30 |
| Ekrina (acronym) |    1 |       8 |     0.11 |    2.30 |     2.42 |     0.32 |
| @nozbe/microfuzz |    2 |     133 |     3.97 |    1.89 |     5.86 |     1.15 |
| fast-fuzzy       |    ✗ |      28 |    27.77 |   11.74 |    39.36 |     3.82 |
| Fuse.js          |    ✗ |      28 |     1.15 |    7.86 |     9.01 |     4.99 |
| fuzzysort        |    2 |     133 |     0.03 |    6.32 |     6.35 |     0.55 |
| uFuzzy           |    — |       0 |     3.92 |    0.72 |     4.66 |     0.20 |
<!-- bench:end -->

`rsaw` is the initials of "Rath, Streich and Witting".
Ekrina's opt-in acronym tier ranks the source _first_ with a tight set of 8, while Ekrina/microfuzz/fuzzysort land it second (the chain engines by matching 133 scattered subsequences, Ekrina via single-char word-boundary chunks; Ekrina's base row shows 7: the density floor, the minimum share of the span a fuzzy assembly has to cover, drops one junk chain the acronym tier keeps as a real initials hit).
The typo engines lose the source entirely (✗); uFuzzy's defaults find nothing.
Tier semantics: apostrophes are word-internal (`People's` contributes one initial, `p`), and stopwords are not skipped (`drc` won't match "Democratic Republic of the Congo" at all: the acronym is `drotc`, and the density floor rejects the sparse `d`/`r`/`c` fuzzy chain at 0.107, under the 0.18 minimum).

### accents: `kepa`

<!-- bench:probe-accent-stripped -->
| Library           | rank | matches | index ms | cold ms | total ms | batch ms |
|-------------------|-----:|--------:|---------:|--------:|---------:|---------:|
| Ekrina            |    2 |       7 |     0.11 |    2.11 |     2.23 |     0.24 |
| @nozbe/microfuzz  |    2 |      70 |     3.93 |    1.60 |     5.54 |     0.86 |
| fast-fuzzy        |   33 |      82 |    28.29 |   12.13 |    40.29 |     3.45 |
| Fuse.js           |    1 |      74 |     1.16 |    6.69 |     7.85 |     4.81 |
| fuzzysort         |    2 |      70 |     0.03 |    6.17 |     6.20 |     0.34 |
| uFuzzy            |    — |       0 |     4.03 |    0.72 |     4.74 |     0.20 |
| uFuzzy (all opts) |    3 |       4 |     4.47 |    1.12 |     5.58 |     0.30 |
<!-- bench:end -->

`kepa` targets items containing "Kępa".
uFuzzy's 0 is the silent diacritics miss, and the one probe where its `latinize` opt-in is the difference between finding the item and not.
fast-fuzzy's matches come from edit distance rather than folding, which is why the source lands so deep.

### garbage: `qxzwkv`

<!-- bench:probe-miss -->
| Library          | matches | cold ms | vs `ergonomic` |
|------------------|--------:|--------:|---------------:|
| Ekrina           |       0 |   3.562 |           148% |
| @nozbe/microfuzz |       0 |   1.210 |            68% |
| fast-fuzzy       |       0 |  12.496 |           101% |
| Fuse.js          |       0 |   9.288 |            54% |
| fuzzysort        |       0 |   5.663 |            92% |
| uFuzzy           |       0 |   0.643 |            62% |
<!-- bench:end -->

No rank column: every library correctly returns nothing, which is the only right answer.
What separates them is how long that answer takes, shown against each library's own time for the long-word probe (a query that does match), so the column reads as "what fraction of a real query does a hopeless one take".
Process-cold, this probe inverted: Ekrina's miss takes _more_ time than its hit (148%, the only ratio clearly above 100% in the table; fast-fuzzy's 101% is a tie), and the reason is diligence, not waste.
A hopeless six-character query is _rescuable_, so before saying "no results" Ekrina tries harder: the literal pass comes up empty, and rather than fail it builds the union and bigram masks and attempts every one-edit correction of the query, the same second pass that takes every typo probe above at rank 1 with a single row.
The engines with fast misses are fast because they never tried; uFuzzy's 0.6 ms refusal and Ekrina's 3.6 ms one bring different amounts of certainty that nothing was there.
The work also happens once per searcher, not per miss: the masks the garbage query builds are the ones every later rescue reuses, which is why the batch column absorbs it, a session's first thin query does it and the other nineteen reuse it.
(The old warm harness showed the opposite ratio, 3%, because the masks were already built; both numbers are true, and the cold one is what a fresh searcher feels.)

## Scorecard

One line per configuration: MRR from [`bench/hits.test.ts`](../bench/hits.test.ts) (ranks are deterministic, measured once, untimed), times from the process-cold matrix ("Timing method"; `pnpm bench --runs=N` sets the processes per cell).
**MRR** = mean reciprocal rank of the queried item across the 18 scored queries, with the top-10 cutoff from "The corpus and the twenty probes": misses and ranks outside the top 10 score 0.
**index ms** = the constructor call (from the batch cell's fresh processes).
**cold ms** = the mean first-answer time across all twenty probes, each in its own fresh process.
**batch ms** = one fresh process answering a short-word warmup match and then all twenty probes once, the realistic session, whole.
**batch/query** = the mean of the twenty post-warmup probes: how long a query takes once the searcher has genuinely worked.
Which column matters depends on workload: search-as-you-type → **batch/query**; backend one-shot → index + cold ("One measurement model"'s one-shot); a first-keystroke budget → **cold**.

**mixed corpus** (the query set above):

<!-- bench:scorecard-mixed -->
| Library                     |  MRR | index ms | cold ms | batch ms | batch/query |
|-----------------------------|-----:|---------:|--------:|---------:|------------:|
| Ekrina (acronym)            | 0.87 |     0.12 |    3.44 |    13.64 |        0.57 |
| Ekrina                      | 0.84 |     0.11 |    3.37 |    13.08 |        0.55 |
| Ekrina (indexed)            | 0.84 |     1.98 |    1.30 |     8.39 |        0.37 |
| Fuse.js (all opts)          | 0.81 |     1.17 |   17.42 |   273.38 |       12.95 |
| Fuse.js                     | 0.75 |     1.17 |   18.64 |   315.40 |       15.25 |
| fast-fuzzy                  | 0.59 |    27.88 |   12.56 |   116.62 |        5.21 |
| fast-fuzzy (all opts)       | 0.59 |    27.73 |   12.56 |   117.64 |        5.23 |
| uFuzzy (all opts)           | 0.52 |     4.50 |    1.94 |    17.86 |        0.82 |
| @nozbe/microfuzz            | 0.46 |     3.96 |    1.64 |    24.98 |        1.16 |
| @nozbe/microfuzz (all opts) | 0.46 |     4.01 |    1.64 |    24.53 |        1.14 |
| fuzzysort                   | 0.42 |     0.03 |    5.98 |    12.07 |        0.30 |
| fuzzy                       | 0.35 |     0.03 |    1.80 |    31.77 |        1.49 |
| fuzzy (all opts)            | 0.35 |     0.03 |    1.86 |    32.54 |        1.53 |
| match-sorter                | 0.32 |     0.03 |    4.95 |    49.52 |        2.13 |
| uFuzzy                      | 0.11 |     4.02 |    0.77 |     4.87 |        0.19 |
<!-- bench:end -->

**ascii corpus** (its own query set over its own corpus, down to its own accent probe, `cote` from "Côte d'Ivoire", which the en locale emits; MRRs therefore aren't comparable across corpora):

<!-- bench:scorecard-ascii -->
| Library                     |  MRR | index ms | cold ms | batch ms | batch/query |
|-----------------------------|-----:|---------:|--------:|---------:|------------:|
| Ekrina (acronym)            | 0.82 |     0.11 |    3.52 |    16.22 |        0.73 |
| Ekrina                      | 0.79 |     0.12 |    3.43 |    16.27 |        0.73 |
| Ekrina (indexed)            | 0.79 |     2.04 |    1.56 |    12.46 |        0.57 |
| Fuse.js (all opts)          | 0.69 |     1.17 |   16.48 |   274.73 |       12.95 |
| Fuse.js                     | 0.64 |     1.14 |   17.12 |   292.05 |       14.02 |
| @nozbe/microfuzz            | 0.52 |     3.84 |    1.63 |    24.17 |        1.13 |
| @nozbe/microfuzz (all opts) | 0.52 |     3.83 |    1.64 |    24.14 |        1.13 |
| fuzzy                       | 0.39 |     0.03 |    1.65 |    32.15 |        1.51 |
| fuzzy (all opts)            | 0.39 |     0.03 |    1.71 |    33.28 |        1.57 |
| fast-fuzzy                  | 0.39 |    27.86 |   13.77 |   129.34 |        5.77 |
| fast-fuzzy (all opts)       | 0.39 |    27.60 |   13.90 |   129.61 |        5.79 |
| uFuzzy (all opts)           | 0.39 |     4.43 |    1.65 |    15.04 |        0.68 |
| match-sorter                | 0.29 |     0.03 |    4.49 |    49.76 |        2.13 |
| fuzzysort                   | 0.28 |     0.03 |    5.65 |    13.11 |        0.38 |
| uFuzzy                      | 0.08 |     3.97 |    0.78 |     5.09 |        0.20 |
<!-- bench:end -->

Result-set size is _not_ a scorecard column: in a ranked UI any result list slices to the top N, so a large return does not hurt a picker (see "The corpus and the twenty probes").
The per-query tables above keep the raw counts for the two places size does matter: filter-style UIs that show every match, and telling whether an MRR came from a selective matcher or from ranking a huge candidate set.
_Ekrina (acronym) tops both corpora outright_ (0.87 mixed / 0.82 ascii), with base Ekrina and Ekrina (indexed) (0.84 / 0.79, identical ranks) also clear of every other configuration; the nearest non-Ekrina row is Fuse.js (all opts) at 0.81 / 0.69.
The phrase-typo probes are what opened the gap: Ekrina takes all three at rank 1 with exactly the five true rows, where Fuse's base configuration loses the reversed one outright and its all-opts row arrives with ~90-row lists at ~14–36 ms cold against Ekrina's ~3.
On structured queries Ekrina returns a median of _7_ rows where Fuse ships ~90.
Base Ekrina leads its parent by 38 points on mixed (0.84 vs 0.46): the one-edit tiers take all three single-edit typo probes and all three phrase-typo probes at rank 1, where the subsequence engines return nothing at all on most of them.
Rank inside junk does not score, so refusal at the heavy scatter grade does not hurt (microfuzz's rank-21-in-67-junk-rows on `hget` earns 0 either way; see "the fuzzy limit").
uFuzzy's typo configuration is the largest spread in the table (0.52 mixed / 0.39 ascii against 0.11 / 0.08 for its defaults), so most of what separates uFuzzy from the field on these probes comes down to configuration rather than capability.

The scorecard's timing columns are exactly what the Pareto charts draw, one per workload; both draw the mixed 10k scorecard.

**Frontend workload** (the index is built once at load, so keystrokes run the query only):

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./pareto-query-dark.svg">
  <img alt="Mixed-corpus accuracy (MRR) vs. per-query cost across a twenty-query session, log scale, as a Pareto frontier. The frontier runs uFuzzy, fuzzysort, Ekrina (indexed), Ekrina (acronym): Ekrina (acronym) tops MRR at 0.87 at 0.57 ms per query, Ekrina (indexed) reaches 0.84 at 0.37 ms, and everything else above 0.5 MRR, base Ekrina and Fuse.js (all opts, 0.81 at ~13 ms) included, is dominated." src="./pareto-query-light.svg">
</picture>

Its x-axis is the batch's per-query time, how long a query takes once the searcher has answered nineteen real ones, and its frontier runs uFuzzy → fuzzysort → Ekrina (indexed) → Ekrina (acronym).
Base Ekrina sits off it because its batch pays for the mask build partway through, on the first probe that needs the rescue, work its indexed twin did at construction, so the same 0.84 MRR costs it 0.55 ms per query against 0.37.
The fast end belongs to the bare-output engines and their MRR says why (0.11 and 0.42); no non-Ekrina configuration above 0.5 MRR comes within 2× of Ekrina (indexed)'s 0.37 ms, and everything typo-tolerant is 14–42× slower.

**Backend one-shot workload** (a fresh process runs constructor + first answer): the chart lives in the README's Comparison section, deliberately the less flattering of the two there.
Its frontier runs `fuzzy` → Ekrina (indexed) → Ekrina (acronym): a no-index substring scan at 0.35 MRR owns the fast end, and every other configuration - uFuzzy included, once its constructor-and-first-call reality is measured rather than amortised - is dominated.
Base Ekrina is dominated too, by its indexed twin and only by a margin inside the tie band: 1.98 + 1.30 ms against 0.11 + 3.37 ms at the same 0.84 MRR, so building the mask index up front costs about what the first answer then saves.
This is where base Ekrina's lazy preparation shows up, in two parts against a 0.11 ms constructor.
A fresh searcher's first answer prepares the text of every item it matches, and a single-word query finds them with a scan of the raw strings (~2 ms at 10k).
The per-item mask index is built only on the first query that needs it: one with a second word, one of five or more characters that finds fewer than ten literal matches and so goes to the one-edit rescue, or one holding a character outside Latin letters and digits, which the raw scan cannot fold.
That is why a cold `two-words` answer costs ~3.2 ms at 10k against ~2.1 ms for `short-word`, and why `prefix`, a single word with too few literal matches to rule out a typo, costs ~5.2 ms.
The batch's literal warmup never needs it, so its `first` column carries only the first part; the build lands on the third probe, the first multi-word one, and the `two-words` probe table shows it as that probe's batch cost.

_Both charts read the scorecard above out of [`bench/results.json`](../bench/results.json) ([`pareto.ts`](./pareto.ts)), so they cannot disagree with it; `pnpm bench` redraws them._

## Size, speed & search type

These tables position each library rather than rank them; the method is uniform throughout.
**Gzip** = esbuild `--bundle --minify` + gzip, tree-shaken to each lib's primary API (the size table is in [Libraries](#libraries)).
Every cell is process-cold ("One measurement model"), and each corpus gets two tables.
The scale table measures the one-shot workload: **index** = the constructor, **cold query** = mean first answer across the twenty probes (each in its own fresh process), **total** = the mean of constructor + first answer, summed inside each probe's own child, **total rel** = that total relative to Ekrina (100% = same, lower = faster).
The batch table measures the session: **batch total** = one fresh process answering a short-word warmup match then all twenty probes once, **batch/query** = the mean of the twenty post-warmup probes, **batch rel** = batch total relative to Ekrina.
The aggregate row is a **geometric mean**: per-library times span orders of magnitude, so an arithmetic mean would only describe the slowest library; the geomean is the standard aggregate for multiplicative spreads, and the rel cells are equally the geomean of each rel column (a geomean of ratios is the ratio of geomeans).
These tables publish the 100k size; the full 10k matrix, scorecard and per-probe tables, carries the fine-grained view, and every cell of both sits in [`bench/results.json`](../bench/results.json).
The two corpora are described in "The corpus and the twenty probes"; they're benched separately.
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
| **Ekrina**                  |   0.28 ms |   13.60 ms |  13.86 ms |  **100%** |
| Ekrina (acronym)            |   0.27 ms |   13.81 ms |  14.08 ms |      102% |
| Ekrina (indexed)            |  11.22 ms |    3.49 ms |  14.66 ms |      106% |
| @nozbe/microfuzz            |  48.61 ms |   11.78 ms |  59.96 ms |      433% |
| @nozbe/microfuzz (all opts) |  43.28 ms |   11.68 ms |  59.70 ms |      431% |
| fast-fuzzy                  | 260.49 ms |   53.17 ms | 316.40 ms |     2283% |
| fast-fuzzy (all opts)       | 263.00 ms |   54.75 ms | 317.35 ms |     2290% |
| Fuse.js                     |   5.16 ms |  144.94 ms | 150.19 ms |     1084% |
| Fuse.js (all opts)          |   5.33 ms |  134.23 ms | 139.47 ms |     1006% |
| fuzzy                       |   0.03 ms |   14.53 ms |  14.56 ms |      105% |
| fuzzy (all opts)            |   0.03 ms |   15.33 ms |  15.36 ms |      111% |
| fuzzysort                   |   0.03 ms |   54.21 ms |  54.24 ms |      391% |
| match-sorter                |   0.03 ms |   24.38 ms |  24.41 ms |      176% |
| uFuzzy                      |   3.96 ms |    2.44 ms |   6.36 ms |       46% |
| uFuzzy (all opts)           |   7.74 ms |    3.55 ms |  11.15 ms |       80% |
| _all libraries (geomean)_   |   2.14 ms |   18.81 ms |  37.76 ms |      272% |
<!-- bench:end -->

**The session batch** (one process: a warmup match, then the twenty probes once each):

<!-- bench:batch-ascii -->
| Library                     | batch/query | batch total | batch rel |
|-----------------------------|------------:|------------:|----------:|
| **Ekrina**                  |     2.91 ms |    62.29 ms |  **100%** |
| Ekrina (acronym)            |     3.03 ms |    64.86 ms |      104% |
| Ekrina (indexed)            |     2.20 ms |    45.92 ms |       74% |
| @nozbe/microfuzz            |     9.05 ms |   189.77 ms |      305% |
| @nozbe/microfuzz (all opts) |     9.39 ms |   196.63 ms |      316% |
| fast-fuzzy                  |    42.57 ms |   900.03 ms |     1445% |
| fast-fuzzy (all opts)       |    41.70 ms |   887.15 ms |     1424% |
| Fuse.js                     |   137.11 ms |  2832.83 ms |     4548% |
| Fuse.js (all opts)          |   127.26 ms |  2661.86 ms |     4273% |
| fuzzy                       |    14.47 ms |   304.98 ms |      490% |
| fuzzy (all opts)            |    14.71 ms |   310.08 ms |      498% |
| fuzzysort                   |     3.51 ms |   124.75 ms |      200% |
| match-sorter                |    19.27 ms |   412.06 ms |      661% |
| uFuzzy                      |     1.70 ms |    37.02 ms |       59% |
| uFuzzy (all opts)           |     2.45 ms |    52.64 ms |       84% |
| _all libraries (geomean)_   |    10.78 ms |   236.10 ms |      379% |
<!-- bench:end -->

### mixed corpus

<!-- bench:speed-mixed -->
| Library                     |    index | cold query |     total | total rel |
|-----------------------------|---------:|-----------:|----------:|----------:|
| **Ekrina**                  |  0.26 ms |   13.36 ms |  13.63 ms |  **100%** |
| Ekrina (acronym)            |  0.26 ms |   13.42 ms |  13.68 ms |      100% |
| Ekrina (indexed)            | 12.37 ms |    2.62 ms |  14.75 ms |      108% |
| @nozbe/microfuzz            | 51.23 ms |   13.81 ms |  63.96 ms |      469% |
| @nozbe/microfuzz (all opts) | 51.33 ms |   13.17 ms |  62.91 ms |      462% |
| Fuse.js (all opts)          |  5.35 ms |  136.24 ms | 141.66 ms |     1039% |
| fuzzysort                   |  0.03 ms |   58.39 ms |  58.42 ms |      429% |
| match-sorter                |  0.03 ms |   29.04 ms |  29.07 ms |      213% |
| uFuzzy (all opts)           |  8.25 ms |    3.93 ms |  12.18 ms |       89% |
| _all libraries (geomean)_   |  1.63 ms |   16.22 ms |  31.71 ms |      233% |
<!-- bench:end -->

**The session batch** (one process: a warmup match, then the twenty probes once each):

<!-- bench:batch-mixed -->
| Library                     | batch/query | batch total | batch rel |
|-----------------------------|------------:|------------:|----------:|
| **Ekrina**                  |     2.49 ms |    55.16 ms |  **100%** |
| Ekrina (acronym)            |     2.56 ms |    56.77 ms |      103% |
| Ekrina (indexed)            |     1.50 ms |    32.12 ms |       58% |
| @nozbe/microfuzz            |    11.35 ms |   238.48 ms |      432% |
| @nozbe/microfuzz (all opts) |    13.44 ms |   285.37 ms |      517% |
| Fuse.js (all opts)          |   130.32 ms |  2721.85 ms |     4935% |
| fuzzysort                   |     2.82 ms |   116.15 ms |      211% |
| match-sorter                |    22.20 ms |   476.06 ms |      863% |
| uFuzzy (all opts)           |     2.72 ms |    57.81 ms |      105% |
| _all libraries (geomean)_   |     6.83 ms |   157.48 ms |      286% |
<!-- bench:end -->

The acronym configuration runs strictly _more_ code per query (an extra tier, plus the one-edit rescues on candidates that reach it); its 100–104% cells are that extra work plus load swing.
Read sub-15% differences as statistical ties, the tie band from here on, and larger ones as real.
Folding uFuzzy sits just inside the tie band on this corpus: 2.49 ms for Ekrina to uFuzzy's 2.72 (109%).

Configurations that can't fold diacritics are omitted rather than flagged. A non-folding row on this corpus is timing a different, easier task (it silently misses accented matches), and we already _know_ it fails: on the accent-probe query `kepa` (from "Kępa…") at 10k, base uFuzzy finds _0_ matches where its folding (all opts) config finds 4 and Ekrina 7 ([`bench/hits.test.ts`](../bench/hits.test.ts)).
Omitted: uFuzzy and fuse.js base configs (their (all opts) rows fold and stay), and fast-fuzzy and fuzzy entirely; they have no folding option at all.

### Reading the speed numbers

Every cell is process-cold, so read the columns as three different workloads, not three qualities of one number.
The **batch** column is the honest headline: one process, twenty distinct queries, and the amortisation each design promises either shows up or doesn't.
Ekrina's batch is carried by its architecture, a staged reject path (a per-item union of char-class bitmasks, then a native regex gate) cuts 90–100% of items before any ladder work, and the lazy preparation happens once per session: each item's text the first time it matches, and the mask index on the first multi-word query or the first that reaches the rescue.
_uFuzzy wins the raw batch at 100k on ascii_ (59% of Ekrina bare, where Ekrina (indexed) takes 74%) and its bare `batch/query` is the fastest in the set; folding, it still beats base Ekrina on ascii (84%) but trails Ekrina (indexed), on mixed it lands inside the tie band with base Ekrina (105%) and takes 1.8× Ekrina (indexed)'s batch, and its MRR (0.08–0.11 bare, 0.39–0.52 folding) is what that speed leaves you with.
Ekrina's batch beats everything else - ~4× its parent microfuzz, 2× fuzzysort, ~9× match-sorter, ~14× fast-fuzzy (ascii; it can't fold), ~49× Fuse.js on mixed - while topping both scorecards outright.
The **cold query** column is where Ekrina's laziness shows up: ~13 ms mean at 100k, most of it the rescue's union-and-bigram mask build (Ekrina (indexed), which builds it in its 11–12 ms constructor, answers first in 2.6–3.5 ms), done once per searcher and visible per probe kind in the 10k tables (it lands on the multi-word probes and on every probe of five or more characters with fewer than ten literal matches, the typos, `prefix` and the longer fuzzy-limit probes among them; the other single-word probes carry only the ~2 ms raw-gate scan).
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
| Ekrina             |  2.38 |   1.37 |    0.57 |    4.32 |
| @nozbe/microfuzz   | 19.82 |  19.66 |   18.68 |   58.15 |
| fuzzysort          |  5.18 |   2.97 |    1.80 |    9.95 |
| uFuzzy (all opts)  |  3.89 |   1.97 |    2.21 |    8.07 |
| Fuse.js (all opts) | 85.60 |  80.98 |  108.98 |  275.56 |
<!-- bench:end -->

Ekrina's per-keystroke time falls _over 4×_ across the word (2.38 → 1.37 → 0.57) as the survivor cache narrows: the 3-character query is the widest candidate set the session ever sees, and it is the one that does the work.
Ekrina takes every step of the session, the wide opener included (2.38 vs uFuzzy's 3.89), and the session total by 1.9× (4.32 vs 8.07), while returning tiers and ranges against uFuzzy's bare index array, at 0.52 MRR to Ekrina's 0.84.
microfuzz stays flat at ~19–20 ms: same subsequence approach with no survivor cache, so nothing narrows between keystrokes.
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
|      1024 |        0% |        20/20 |   0.017 |
|      2048 |        0% |        20/20 |   0.030 |
|      4096 |        0% |        20/20 |   0.056 |
|      8192 |        0% |        20/20 |   0.104 |
|     16384 |        0% |        20/20 |   0.201 |
<!-- bench:end -->

Zero junk at every length, while every genuinely present word still matches (a present word is a substring, so `contains` needs no fuzzy assembly) and label-corpus behaviour is unchanged (same MRR, same ranks, slightly tighter sets: `rsaw` 8 → 7, ascii's `sgh` 55 → 31).
Miss time includes the one-edit rescues (a miss must fail those too), which is the work a document-length miss does for the typo rescues on labels; it stays around a fifth of a millisecond at 16k chars.
Residual exposure is the adjacent-word assembly (`zebra` over "zero … branch", density 0.38), structurally identical to wanted word-start matches like `hewo` → "hello world" (0.5), so no floor separates them; they need adjacency by luck, and they rank last when they occur.
Literal-only matching, for callers that want no fuzzy assemblies at all, is a one-line `tier` filter.
[`bench/longtext.test.ts`](../bench/longtext.test.ts) keeps this table as a regression guard, asserting the junk rate is exactly zero at every length.

## The recommendation

Everything above condenses to one recommendation: _pick Ekrina for list matching_, with two carve-outs the data supports.
Three things carry the claim, each measured in its own section:

- **Quality**: Ekrina (acronym) tops the scorecard on both corpora outright (0.87 mixed / 0.82 ascii), with the smallest result sets of the subsequence engines (median 7 rows on structured queries where Fuse.js ships ~90); the phrase-typo probes are what pushed the lead past the tie band.
- **Speed, measured cold**: the fastest twenty-query session of anything above 0.5 MRR at both sizes (batch 13.1 ms at mixed 10k, ~0.5 ms per query after the first, and 8.4 ms / ~0.4 ms for Ekrina (indexed); ~4–49× under every typo-tolerant or tiered alternative), a near-zero constructor, ~5.5 kB gzip, zero deps. The honest asterisk is the first call: Ekrina prepares lazily, so a fresh searcher's first answer prepares what it matches, and its first multi-word or rescue-bound query builds the mask index over the whole list (a first answer averages ~3.4 ms at 10k and ~13 ms at 100k across the twenty probes, or ~1.3 ms and ~2.6 ms once Ekrina (indexed) has spent ~2 ms and ~12 ms building the index up front); a workload that only ever asks one question of one searcher should read the one-shot numbers, where bare `fuzzy` is faster.
- **Long text**: the density floor holds `fuzzyMatch` junk at 0% at every measured document length, phrase probes included, so the same engine covers documents, not just labels.

The carve-outs:

- **Typo tolerance beyond a single edit.** The one-edit tiers rescue every single-character typo (transposition, insertion, deletion and substitution) at rank 1 with a single row - inside phrases too, where the failing word is corrected alone - but _two or more_ edits in one query still need real edit distance, and Ekrina deliberately refuses both deep scatter ("the fuzzy limit") and the double-typo phrase.
  If user-typed queries over messy data must match through those, Fuse.js (Bitap) or fast-fuzzy (edit distance) is the right tool; the scorecard measures what that gains and loses: 0.81/0.59 MRR on mixed, ~13–19 ms per cold query, ~90–450-row result sets.
- **Raw throughput when a bare index array is enough.** uFuzzy wins the 100k ascii batch outright (59% of Ekrina bare, ahead of Ekrina (indexed)'s 74%; with folding it drops to 84%, behind Ekrina (indexed), and on mixed its folding config only ties base Ekrina) and owns the fastest bare per-query and miss cells at every size.
  It gives up most of the match quality to get there - 0.08–0.11 MRR bare, 0.39–0.52 folded, against Ekrina's 0.79–0.87 - and no ranges, tiers, or per-field config. A real trade, measured in full above.

The rest of the field is dominated on these benchmarks:

- **@nozbe/microfuzz**: Ekrina's parent; same subsequence approach, ~4× the batch at 100k, 2–17× larger result sets, no tier output. Its 0.46 mixed MRR sits 38 points under base Ekrina: it returns nothing at all on the insertion, substitution and phrase-typo probes.
- **fuzzysort**: the fastest per-query time after uFuzzy, but its prepare-all pass lands a ~6 ms first call (58 ms at 100k) that stock usage absorbs inside the first `go()`, and prefix-biased ranking sinks plain-word and infix ranks (20th on `ergonomic`, 13th on `gonom`).
- **match-sorter**: tiered ranking but no ranges and no multi-word; never places best on any probe, 0.29–0.32 MRR at mid-pack speed.
- **fuzzy**: substring-only and order-sensitive; 0 matches on the reversed phrase, no folding, no ranges.
- **fast-fuzzy**: the heaviest build (~290 ms at 100k) and slowest queries on these corpora; its trie rewards shared-prefix data, which natural-language corpora don't provide.
