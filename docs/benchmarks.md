# Match quality and speed benchmarks

Full data behind the README's summary: what each library calls a match, where it ranks the right answer, and how long a query takes.
Every measured table below is generated, and `pnpm vpr bench --all` regenerates all of them: it measures, writes [`bench/results.json`](../bench/results.json), rewrites each table in place, and redraws the Pareto charts.
No measured cell in this document is typed by hand.

- `pnpm vpr bench` alone times ekrina's own rows once and writes nothing.
- `pnpm vpr bench --docs` re-emits the tables from the committed `results.json` without measuring anything.
- `pnpm vpr bench --check` exits nonzero if any table here disagrees with `results.json`.
- `pnpm vpr bench --speed`, `pnpm vpr bench --quality` and `pnpm vpr bench --memory` run one stage of the measurement, over ekrina's own rows and printed unless `--all` is added; `--runs=N` sets the fresh processes per cold cell (default 1).
- `pnpm vpr bench --scope=native-10k` scopes a dev run to one corpus (`native`) or one corpus at one size (`native-10k`).
  A scoped run measures a partial matrix, so it prints and stops: neither `results.json` nor this document is touched.

The pre-filter funnel ([`bench/funnel.test.ts`](../bench/funnel.test.ts)) is a diagnostic rather than a published table; `pnpm vpr bench:test` runs it.
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

Size and type, Ekrina first, then by bundle size ascending.

<!-- bench:libraries -->
| Library          | Gzip     | Deps | Type                 |
|------------------|----------|------|----------------------|
| **Ekrina**       | ~8.6 kB  | 0    | subsequence (tiered) |
| fuzzy            | ~0.8 kB  | 0    | substring            |
| @nozbe/microfuzz | ~1.7 kB  | 0    | subsequence          |
| match-sorter     | ~3.6 kB  | 2    | subsequence (tiered) |
| fuzzysort        | ~3.7 kB  | 0    | subsequence          |
| uFuzzy           | ~4.3 kB  | 0    | subsequence          |
| Fuse.js          | ~9.6 kB  | 0    | typo-tolerant        |
| fast-fuzzy       | ~11.1 kB | 1    | typo-tolerant        |
<!-- bench:end -->

The scorecard, speed and memory tables below show each library at its best-scoring configuration, plus every Ekrina configuration; the family tables leave out Ekrina (indexed), and the build, garbage and typing tables name their own rows.
That configuration is picked by running every one a library has against the same query families it is then ranked on, so each headline row is the library tuned to this bench, the most favourable reading of it the bench can produce.
Each library's base row is what installing it gives you, and for two of them it scores lower: uFuzzy <!-- bench:{{ cell("library-ufuzzy-scorecard-native", "uFuzzy", "MRR") }} -->0.21<!-- bench:end --> MRR rather than <!-- bench:{{ cell("scorecard-native", "uFuzzy (all opts)", "MRR") }} -->0.66<!-- bench:end -->, and Fuse.js <!-- bench:{{ cell("library-fuse-scorecard-native", "Fuse.js", "MRR") }} -->0.72<!-- bench:end --> rather than <!-- bench:{{ cell("scorecard-native", "Fuse.js (tuned)", "MRR") }} -->0.76<!-- bench:end -->.<!-- bench:{{ assert(lt(n("library-ufuzzy-scorecard-native", "uFuzzy", "MRR"), n("scorecard-native", "uFuzzy (all opts)", "MRR")), "uFuzzy's base row scores lower than its headline row") }} --><!-- bench:end -->
Ekrina's older constants, `TYPO_PENALTY`, the density floor and the rescue cutoff, were set from measurements on the bench's earlier, synthetic corpora; the second pass's scoring of sparse matches was tuned on these, checked against held-out queries ([performance.md](./performance.md)).
The query families were fixed, weights included, before any library was measured on these corpora, and [`bench/held-out.test.ts`](../bench/held-out.test.ts) scores Ekrina again on items and seeds the published families never drew from.
Every other configuration is on its library's own page, against the rest of that library's: [Ekrina](./libraries/ekrina.md), [Fuse.js](./libraries/fuse.md), [uFuzzy](./libraries/ufuzzy.md), [fast-fuzzy](./libraries/fast-fuzzy.md), [@nozbe/microfuzz](./libraries/microfuzz.md) and [fuzzy](./libraries/fuzzy.md).
An "(all opts)" row shares its base library's size, deps, and type.
Ekrina's opt-in row is named after the option it switches on: **(acronym)** for `acronym: true` on its field spec.
**Ekrina (indexed)** is the defaults with `buildIndex()` called up front, so its results are Ekrina's and only its timings differ.
The specific opt-ins the "(all opts)" rows switch on, and where output formats differ:

- `Ekrina`: Typos 🟢 is the always-on typo rescue, reported as the `corrected` tier: up to two edits in a word, sparse words such as `hget` for "Huguette", a stray or missing space, a held key such as `twaaain`, and a four-letter swap such as `tahn` for "Than"
- `uFuzzy`: folds diacritics via `latinize()`, matches multi-word via `outOfOrder`, and runs its one-typo `SingleError` mode with all four edits, its closest config to Ekrina's typo rescue
- `Fuse.js`: returns `ranges` via `includeMatches`, folds diacritics via `ignoreDiacritics`, and matches multi-word via `useExtendedSearch`, which turns space-separated terms into an AND of fuzzy patterns in any order, the same result set Ekrina's multi-word tier returns.
  Fuse's other multi-word switch, `useTokenSearch`, defaults to OR (`tokenMatch: "any"`) and only reaches these semantics at `tokenMatch: "all"`
- `fast-fuzzy`: its `ranges` are one span (`index` + `length`), not per-character, and its default normalisation doesn't strip accents
- `fuzzy`: its "ranges" are a pre-wrapped string, not numeric indices
- `@nozbe/microfuzz`: `strategy: "aggressive"` keeps every in-order letter match, where the default `"smart"` drops the poor ones

Every configuration is defined once, in [`bench/configs.ts`](../bench/configs.ts), so a row timed in the speed tables is the same row ranked in the scorecard.
A base row is the library's own defaults.
For Fuse.js that means `threshold` 0.6 and a score that decays with a match's distance from index 0, which return the widest result sets in the field: <!-- bench:{{ probeCount("native", "gensler", "fuse.js") }} -->971<!-- bench:end --> rows for the exact long word `gensler` on native, where Ekrina returns <!-- bench:{{ probeCount("native", "gensler", "ekrina") }} -->1<!-- bench:end --> ([`bench/results.json`](../bench/results.json)).
A "(tuned)" row is an "(all opts)" row with its settings chosen by a sweep against an earlier version of this bench, and Fuse.js has the only one: at `threshold` <!-- bench:{{ constant("0.45") }} -->0.45<!-- bench:end --> it scores <!-- bench:{{ cell("scorecard-native", "Fuse.js (tuned)", "MRR") }} -->0.76<!-- bench:end --> on both Wikidata corpora against the default's <!-- bench:{{ cell("library-fuse-scorecard-native", "Fuse.js", "MRR") }} -->0.72<!-- bench:end --><!-- bench:{{ assert(within(n("scorecard-native", "Fuse.js (tuned)", "MRR"), n("scorecard-en", "Fuse.js (tuned)", "MRR"), 0), "Fuse.js (tuned) scores the same on both Wikidata corpora") }} --><!-- bench:end -->, and returns <!-- bench:{{ probeCount("native", "gensler", "fuse.js (tuned)") }} -->73<!-- bench:end --> rows for `gensler` ([Fuse.js](./libraries/fuse.md)).

## How to read these numbers

### One measurement model

Every time cell in this document comes from [`bench/run.ts`](../bench/run.ts): a _fresh node process per sample_, so the JIT, every per-searcher cache, and every process-wide cache (fuzzysort's prepare pool) start empty by construction, nothing is reconstructed by arithmetic, and no harness state can leak between cells.
Each child times:

- **index** = the constructor call, whatever the configuration builds there (uFuzzy (all opts) running `latinize()` over the haystack included; fuzzysort has no constructor at all, so its prepare-all pass lands in its first query, which is where a real user meets it).
- **cold query** = the first answer to one representative query, before any lazy work has run: Ekrina's raw-gate scan and rescue mask build, fuzzysort's prepare-all.
  Six of the probe kinds are timed this way (short word, phrase, substitution, prefix, acronym, garbage), one path through a matcher each.
- **batch** = one process answering a warmup match on a short word no probe uses (`alien` on en and native, `busts` on emoji: a guaranteed literal hit that absorbs the JIT and the first full scan) and then every representative query, once each: the realistic session.
  The process warms up only by answering distinct real queries, no query is ever repeated, anywhere in the harness.
  The batch reports four parts: **build**, the constructor; **first answer**, the warm-up; **per query**, the mean of the 24 queries after it; and **session total**, all of them from the constructor to the last answer.
  Each query's own post-warm-up time is kept in `results.json`.
- **one-shot** = constructor + first answer, summed inside one child's consecutive windows: the whole of "given a list, get an answer".

The JIT is included deliberately.
A cold first call runs unoptimised code, and that is exactly what a user's first call runs; by the twentieth distinct query the engine is as warm as a real session ever makes it.
The previous harness sampled hundreds of repeats of one query, which tiered the JIT far past anything realistic and hid every first call inside an untimed calibration probe, [docs/measurement.md](./measurement.md) records the move.

Which column matters depends on workload: search-as-you-type → **per query** (and the typing table below for the keystroke chain); a page that builds a searcher and answers a handful of queries → **session total**; a backend one-shot over fresh data → **one-shot**; a first-keystroke latency budget over a prebuilt index → **cold query**.

### What each number includes

Each number starts its clock at a different point, so each leaves different setup out.

| Number | Constructor | First-contact setup (the JIT, fuzzysort's prepare-all, Ekrina preparing what it matches) | Ekrina's whole-list mask build | Earlier queries in the same process |
|---|---|---|---|---|
| **index**, **build** | yes | no | Ekrina (indexed) only | none |
| **cold query** | no | yes | yes, when the query needs it | none |
| **one-shot** | yes | yes | yes, when the query needs it | none |
| **first answer** | no | yes | no: the warm-up is a literal hit | none |
| **per query** | no | no | lazy Ekrina: yes, on the first query that needs it | the warm-up and every query before it, each one different |
| **session total** | yes | yes | yes | it is the whole session |
| **typing** (`hinton`) | no | no | no: built before the clock starts | five other queries, then each keystroke extends the last |

Speed ranks on **per query**, the cost a user feels on every keystroke.
It leaves every constructor and the first answer out, so each batch table keeps **build**, **first answer** and **session total** beside it: the setup a design moves off that clock stays in view, and **one-shot** covers a single answer from a fresh list.

### Where this bench leans

The scorecard measures what Ekrina is built to do.
Its query families and their weights ("The corpora and the query families") are the mistakes Ekrina was designed to forgive, chosen by its author.
Every library is scored by the same rules, each at its best-scoring configuration, but which mistakes count is a statement of what Ekrina is for: if your users make different ones, read the families one by one ("Match quality, by query family") rather than the headline.

The timings lean both ways:

- **per query** leaves every constructor out and lets the warm-up absorb first-contact setup, which suits libraries that index up front, and fuzzysort, whose prepare-all lands in the warm-up.
  Lazy Ekrina's mask build stays inside it, which is why Ekrina takes <!-- bench:{{ cell("batch-native", "Ekrina", "per query") }} -->1.96 ms<!-- bench:end --> per query on native at 100k against Ekrina (indexed)'s <!-- bench:{{ cell("batch-native", "Ekrina (indexed)", "per query") }} -->1.43 ms<!-- bench:end --><!-- bench:{{ assert(gt(n("batch-native", "Ekrina", "per query"), n("batch-native", "Ekrina (indexed)", "per query")), "lazy Ekrina is slower per query than Ekrina (indexed)") }} --><!-- bench:end -->.
- **session total** charges each design for its setup wherever it pays it; read it beside per query when a searcher answers only a handful of queries.
- **cold query** includes Ekrina's mask build whenever the query needs one; Ekrina (indexed) shows the same work moved into its constructor.
- **typing** shows Ekrina's survivor cache, the design choice that makes each keystroke cheaper than the last: Ekrina's time per keystroke falls <!-- bench:{{ times(div(sessionMs("ekrina", "hin"), sessionMs("ekrina", "hinto")), 1) }} -->16.0×<!-- bench:end --> across `hinton`.

### Timing method

Timing noise is one-sided (GC, scheduler, and thermal interruptions only ever _add_ time), so the median across processes rejects spikes; the per-cell minimum, the noise-free floor, stays in [`bench/results.json`](../bench/results.json) but is never the headline, because best-of-N flatters.
Every published cold cell is the median of three fresh processes (`pnpm vpr bench --all --runs=3`).
One process per cell is the default, and `--runs=N` raises it: every number is milliseconds-scale under this model, and the small timed set keeps a one-process `--all` run near four minutes, which is what makes rerunning on a quiet machine quick.
A single cell is ~<!-- bench:{{ unsourced("15%", "single-process spread across interleaved runs") }} -->15%<!-- bench:end --> noisy at one process; the guards below look at sums for that reason.

The guards:

- Result counts must be identical across a cell's processes (a variant whose answer drifts is not timing comparable work).
- Variant order rotates per repetition so thermal and load drift land evenly instead of on whichever library ran last.
- Ekrina measuring more than <!-- bench:{{ constant("10%") }} -->10%<!-- bench:end --> slower than Ekrina (acronym), which runs strictly more code, summed over every cell but the acronym query's, fails the run outright (more code cannot be faster, a violated invariant means absorbed load, and the artifact is not written).
  The acronym query is left out because there the acronym tier matches it literally, so Ekrina (acronym) never builds the whole-list index that base Ekrina builds for it.
- The first cell is re-timed after the last as a drift canary.

Numbers are expected to vary per machine: swapping between a Mac ARM host and an AMD x64 showed subtly different relative results.

### The corpora and the query families

Three corpora, benched separately, each a frozen JSON snapshot committed next to the bench, so runs do no generation work and the data cannot drift:

- **en**: the English labels of the best-known Wikidata entities, 100,000 items in a fixed mix of <!-- bench:{{ constant("35%") }} -->35%<!-- bench:end --> people, <!-- bench:{{ constant("20%") }} -->20%<!-- bench:end --> places, <!-- bench:{{ constant("20%") }} -->20%<!-- bench:end --> creative works, <!-- bench:{{ constant("15%") }} -->15%<!-- bench:end --> organisations and <!-- bench:{{ constant("10%") }} -->10%<!-- bench:end --> products and brands ("Pedro López", "Hinton St George", "Two for the Seesaw").
  <!-- bench:{{ unsourced("8.9%", "bench/corpus-en.json") }} -->8.9%<!-- bench:end --> of items carry a non-ASCII letter.
- **native**: the same items under the native name Wikidata records for them where it has one ("Москва", "孟晚舟", "Sånger från andra våningen"), and the English label otherwise: <!-- bench:{{ unsourced("20%", "bench/corpus-native.json") }} -->20%<!-- bench:end --> of items are non-ASCII and <!-- bench:{{ unsourced("10%", "bench/corpus-native.json") }} -->10%<!-- bench:end --> are in a non-Latin script.
- **emoji**: every emoji [emojibase-data](https://github.com/milesj/emojibase) names and tags, bar the regional indicators, written as a picker searches it, the label then the tags the label doesn't already say ("pretzel — convoluted, twisted"): 1,923 items, too few for the 10k and 100k timing cells, so it is ranked on quality only and timed, unranked, at its own length ("emoji corpus, unranked").

The categories are interleaved in a fixed pattern, so any prefix keeps the mix and the 10k list is the first 10,000 items of the 100k.
Wikidata is CC0; regenerating the two Wikidata corpora ([`bench/corpus-wikidata-gen.test.ts`](../bench/corpus-wikidata-gen.test.ts), `GEN_WIKIDATA=1`) redraws items as well as queries, since Wikidata changes daily, and so changes every rank table here.
The emoji corpus regenerates from a pinned emojibase-data release checked against its SHA-256 ([`bench/corpus-emoji-gen.test.ts`](../bench/corpus-emoji-gen.test.ts), `GEN_EMOJI=1`).

Each query runs against the same 10,000 items in every library (the whole 1,923 for emoji), and for each library the bench records:

- **Where it ranks a right answer.**
  A query's right answers are every item it could have meant ("Match quality, by query family" says how they are decided), and the score is the rank of the first one.
  In most cases, a deep rank is effectively a miss, particularly in a UI, so a rank outside the top 10 counts as a miss.
  Scoring uses the mean reciprocal rank (average of `1/rank`), **MRR** from here on, a bounded score ranging from 0 to 1.
  A rank 1 match gets a score of 1, rank 2 gets 0.5, rank 5 gets 0.2 and rank 10 gets 0.1; a rank outside the top 10, like a miss, gets 0.
- **Whether it answers queries nothing answers.**
  The **junk** rate is the share of queries with no right answer anywhere in the list that a library returns anything for.
  It counts a query, not its rows, so a library that caps its result list gains nothing from the cap.
  The row counts behind it stay in [`bench/results.json`](../bench/results.json) as a diagnostic.
- **The duration taken to run the query.**
  Times spread more than two orders of magnitude<!-- bench:{{ assert(gt(div(slowestBatchQuery("en", 100000, "lopez pexro"), fastestBatchQuery("en", 100000, "lopez pexro")), 100), "times on `lopez pexro` spread more than two orders of magnitude") }} --><!-- bench:end --> on the same query (<!-- bench:{{ fixed(fastestBatchQuery("en", 100000, "lopez pexro"), 2) }} -->0.49<!-- bench:end --> ms to <!-- bench:{{ fixed(slowestBatchQuery("en", 100000, "lopez pexro"), 0) }} -->187<!-- bench:end --> ms for `lopez pexro` in the en 100k batch, [`bench/results.json`](../bench/results.json)), and search-as-you-type multiplies the spread: one query per keystroke, where half a millisecond is invisible and <!-- bench:{{ fixed(slowestBatchQuery("en", 100000, "lopez pexro"), 0) }} -->187<!-- bench:end --> ms blows the frame budget.

The rules that picked the query families ([`bench/catalogue.ts`](../bench/catalogue.ts)):

- **Every query comes from how people mistype, not from any library's tiers.**
  Each family is a fixed rule for turning an item into a query, capped at a strength people actually reach: one or two edits in a word, a sound-alike spelling, a word half typed, two words reversed, a stray space.
  The real-misspelling family takes its misspellings from Wikipedia's list of common English misspellings, at a pinned revision ([`bench/misspellings.json`](../bench/misspellings.json), CC BY-SA 4.0).
  The phonetic rules are written for English, so on names they fire only where a name happens to hold the pattern.
- **Each family samples ten queries** from a fixed shuffle of the whole list, so sources come from every position rather than the head, where a list-order tie-break would favour them.
  A query is kept only if at most three items could answer it: when dozens of items hold a word, any library that matches at all fills its top ten with right answers, and the query measures matching, not ranking.
  A corrupted query that is itself a corpus word is skipped, since it would be a correct query.
- **The headline weights were fixed before measuring**: typos <!-- bench:{{ constant("0.35") }} -->0.35<!-- bench:end -->, phonetic <!-- bench:{{ constant("0.25") }} -->0.25<!-- bench:end -->, partial words <!-- bench:{{ constant("0.15") }} -->0.15<!-- bench:end -->, query shape <!-- bench:{{ constant("0.15") }} -->0.15<!-- bench:end --> and noise <!-- bench:{{ constant("0.10") }} -->0.10<!-- bench:end -->.
  A library's MRR is the weighted mean of its group means, and the families tables below stay unweighted.
  Acronyms and plurals are reported but carry no weight, since both are behaviours one library was built around.
- **Queries nothing answers are probed at several distances**, so no library's edit budget decides where "unanswerable" starts: corpus words pushed three, four and five edits from every word in the list, random letters four edits from everything, and pairs of words each three edits away, twenty of each.

Separately from the sampled families, each corpus derives one representative query per probe kind, the query the speed tables time and the batch answers.
Each kind takes the first item, from a fixed start, that can carry it: two plain words, a long enough word, a word at most two items hold ([`bench/corpus.ts`](../bench/corpus.ts)).
On the native corpus they are:

| #     | probe                         | query                         | isolates                                              |
| ----- | ----------------------------- | ----------------------------- | ----------------------------------------------------- |
| 1     | long single word              | `gensler`                     | baseline agreement                                    |
| 2     | short single word             | `hinton`                      | low-signal input, fewer chars for gates and chunking  |
| 3     | two-word phrase               | `pedro alonso`                | tokenisation (in corpus order: any engine can pass)   |
| 4     | two words, reversed           | `alonso pedro`                | true order-independence                               |
| 5     | reversed, second half-typed   | `alo pedro`                   | a phrase mid-keystroke: word starts, not whole words  |
| 6     | two words, space forgotten    | `pedroalonso`                 | a phrase typed as one word                            |
| 7     | two words plus one absent     | `pedro alonso gensler`        | AND vs OR over query words (0 rows is correct)        |
| 8     | two words, first mistyped     | `pexro alonso`                | a typo inside a phrase; word-level rescue             |
| 9     | two words, second mistyped    | `pedro aloxso`                | the rescue must find the failing word                 |
| 10    | reversed phrase, one mistyped | `alonso pexro`                | the correction must survive order-independence        |
| 11    | two words, both mistyped      | `pexro aloxso`                | a typo in each word; the rescue must fix both         |
| 12    | prefix / partial word         | `ameri`                       | a word not yet finished                               |
| 13    | mid-word infix                | `ntiag`                       | contains-anywhere vs start-anchored ranking           |
| 14    | plural typed, singular stored | `abrashis`                    | a trailing `-s` the corpus lacks, one deletion        |
| 15    | four-character typo           | `fexg`                        | corrected only when nothing matches as typed          |
| 16–18 | typo gradient (light → heavy) | `gumuova` `guusva` `gmsv`     | each engine's effective fuzzy limit                   |
| 19    | transposition typo            | `gumsuova`                    | adjacent-swap handling, rescue tier vs edit distance  |
| 20    | insertion typo                | `gumussova`                   | a doubled keystroke, one character too many           |
| 21    | substitution typo             | `gumuxova`                    | one wrong character, absent from the source entirely  |
| 22    | acronym                       | `tfts`                        | deliberate acronym support vs accidental subsequences |
| 23    | accent-stripped               | `lopez`                       | diacritic folding                                     |
| 24    | garbage                       | `qxzwkv`                      | the reject path, verifying no impossible matches      |

The en and emoji corpora derive the same kinds from their own items (`pedro lopez` and `slightly smiling` for the phrases); each query's rank and row count per library is in [`bench/results.json`](../bench/results.json).
MRR covers 33 scored families and 330 queries on every corpus; with ten queries a family, a single family's MRR can swing by 0.3 between draws while the weighted headline moves by a few hundredths, so read headline differences of ±<!-- bench:{{ constant("0.02") }} -->0.02<!-- bench:end --> as ties and treat single family cells as indicative.

## Build time

<!-- bench:build -->
| build |  Ekrina | Ekrina (indexed) | @nozbe/microfuzz | fast-fuzzy | Fuse.js | uFuzzy (all opts) |
|-------|--------:|-----------------:|-----------------:|-----------:|--------:|------------------:|
| 10k   | 0.17 ms |          2.13 ms |          4.50 ms |   27.86 ms | 1.09 ms |           4.33 ms |
| 100k  | 0.23 ms |          8.53 ms |         51.83 ms |  323.48 ms | 5.51 ms |           8.43 ms |
<!-- bench:end -->

Measured on the native corpus (process-cold constructor timings; build time barely differs between corpora).
Fuse.js's build is minimal because its "index" is trivial, and the work it defers to query time is why its queries are slow.
fast-fuzzy's trie is the heaviest build in the set<!-- bench:{{ assert(gt(n("build", "100k", "fast-fuzzy"), highest("build", "100k", "Ekrina+Ekrina (indexed)+@nozbe/microfuzz+Fuse.js+uFuzzy (all opts)")), "fast-fuzzy has the heaviest 100k build") }} --><!-- bench:end --><!-- bench:{{ assert(gt(n("build", "10k", "fast-fuzzy"), highest("build", "10k", "Ekrina+Ekrina (indexed)+@nozbe/microfuzz+Fuse.js+uFuzzy (all opts)")), "fast-fuzzy has the heaviest 10k build") }} --><!-- bench:end -->, and its subtree pruning needs it.
fuzzysort has no constructor at all, so it has no column here, its lazy prepare-all pass lands in its first query's cold cell, where stock usage actually meets it.
uFuzzy's base construction only shows up process-cold, because `new uFuzzy()` compiles the engine's regex machinery on first construction, and it never touches the list.
The (all opts) column shown here also runs `latinize()` over the haystack, which is why it grows with the corpus (<!-- bench:{{ fixed(n("build", "10k", "uFuzzy (all opts)"), 2) }} -->4.33<!-- bench:end --> → <!-- bench:{{ cell("build", "100k", "uFuzzy (all opts)") }} -->8.43 ms<!-- bench:end -->).<!-- bench:{{ assert(gt(n("build", "100k", "uFuzzy (all opts)"), n("build", "10k", "uFuzzy (all opts)")), "uFuzzy (all opts)'s build grows with the corpus") }} --><!-- bench:end -->
microfuzz's column is its whole index: the constructor normalises every item and builds its word sets up front, so its first query adds only <!-- bench:{{ fixed(div(sub(raw("memory", "native", "@nozbe/microfuzz", "match", "totalBytes"), raw("memory", "native", "@nozbe/microfuzz", "built", "totalBytes")), 1048576), 2) }} -->0.06<!-- bench:end --> MB to the memory table below.
Ekrina's constructor only allocates - field text is trimmed, normalised and masked the first time an item survives a gate - so a 100k list swap takes under half a millisecond (<!-- bench:{{ cell("build", "100k", "Ekrina") }} -->0.23 ms<!-- bench:end -->)<!-- bench:{{ assert(lt(n("build", "100k", "Ekrina"), 0.5), "a 100k Ekrina list swap takes under half a millisecond") }} --><!-- bench:end -->, and the first query then carries what construction deferred (its cold cells).
Ekrina (indexed), the same searcher with its mask index built up front, moves the larger part of that deferred work into its constructor: <!-- bench:{{ cell("build", "10k", "Ekrina (indexed)") }} -->2.13 ms<!-- bench:end --> at 10k and <!-- bench:{{ cell("build", "100k", "Ekrina (indexed)") }} -->8.53 ms<!-- bench:end --> at 100k.

## Memory

<!-- bench:memory -->
| Library           | built MB | + `hinton` | + `qxzwkv` | + `gensler` | dropped MB |
|-------------------|---------:|-----------:|-----------:|------------:|-----------:|
| Ekrina            |     1.18 |       2.58 |       3.86 |        4.21 |       0.45 |
| Ekrina (acronym)  |     1.18 |       2.58 |       3.86 |        4.23 |       0.47 |
| Ekrina (indexed)  |     2.07 |       3.76 |       4.18 |        4.45 |       0.46 |
| @nozbe/microfuzz  |    45.94 |      46.00 |      46.00 |       46.00 |       0.12 |
| fast-fuzzy        |   189.72 |     191.69 |     191.69 |      191.70 |       0.18 |
| Fuse.js (tuned)   |     6.92 |       7.04 |       7.12 |        7.07 |       0.18 |
| fuzzy             |     0.02 |       0.05 |       0.05 |        0.05 |       0.05 |
| fuzzysort         |     0.02 |      43.17 |      43.18 |       43.23 |      43.23 |
| match-sorter      |     0.02 |       0.10 |       0.13 |        0.14 |       0.13 |
| uFuzzy (all opts) |     1.15 |       1.22 |       1.22 |        1.23 |       0.10 |
<!-- bench:end -->

What each configuration retains at 100k on the native corpus: `heapUsed + external` over a baseline taken with the list already in memory, so typed arrays count and the caller's own strings don't.
Each row is one fresh process ([`bench/memory.ts`](../bench/memory.ts)): the searcher is built, then answers `hinton`, `qxzwkv` and `gensler` warm in that order, so each column includes every query before it.
**dropped MB** is what is still retained once the searcher is unreachable and collected.
Ekrina allocates its per-item caches empty at construction; `hinton` allocates a match slot per item and prepares the items it matches (~<!-- bench:{{ fixed(div(sub(raw("memory", "native", "ekrina", "match", "totalBytes"), raw("memory", "native", "ekrina", "built", "totalBytes")), 1048576), 1) }} -->1.4<!-- bench:end --> MB), and `qxzwkv`, the first query to reach the typo rescue, adds ~<!-- bench:{{ fixed(div(sub(raw("memory", "native", "ekrina", "miss", "totalBytes"), raw("memory", "native", "ekrina", "match", "totalBytes")), 1048576), 1) }} -->1.3<!-- bench:end --> MB, the mask index's bigram arrays (~<!-- bench:{{ fixed(div(sub(raw("memory", "native", "ekrina (indexed)", "built", "totalBytes"), raw("memory", "native", "ekrina", "built", "totalBytes")), 1048576), 1) }} -->0.9<!-- bench:end --> MB) among it.
Ekrina (indexed) builds that index at construction instead (<!-- bench:{{ cell("memory", "Ekrina (indexed)", "built MB") }} -->2.07<!-- bench:end --> MB built), so `qxzwkv` adds <!-- bench:{{ fixed(div(sub(raw("memory", "native", "ekrina (indexed)", "miss", "totalBytes"), raw("memory", "native", "ekrina (indexed)", "match", "totalBytes")), 1048576), 2) }} -->0.42<!-- bench:end --> MB, the part of that ~<!-- bench:{{ fixed(div(sub(raw("memory", "native", "ekrina", "miss", "totalBytes"), raw("memory", "native", "ekrina", "match", "totalBytes")), 1048576), 1) }} -->1.3<!-- bench:end --> MB that is not the index.
Ekrina's searcher is collected (`collected` in [`bench/results.json`](../bench/results.json)), but <!-- bench:{{ span(div(min(raw("memory", "native", "ekrina", "residueBytes"), raw("memory", "native", "ekrina (acronym)", "residueBytes"), raw("memory", "native", "ekrina (indexed)", "residueBytes"), raw("memory", "en", "ekrina", "residueBytes"), raw("memory", "en", "ekrina (acronym)", "residueBytes"), raw("memory", "en", "ekrina (indexed)", "residueBytes")), 1048576), div(max(raw("memory", "native", "ekrina", "residueBytes"), raw("memory", "native", "ekrina (acronym)", "residueBytes"), raw("memory", "native", "ekrina (indexed)", "residueBytes"), raw("memory", "en", "ekrina", "residueBytes"), raw("memory", "en", "ekrina (acronym)", "residueBytes"), raw("memory", "en", "ekrina (indexed)", "residueBytes")), 1048576), 2) }} -->0.41–0.47<!-- bench:end --> MB stays behind on the two corpora.
Most of it is V8's compiled code for Ekrina's own functions, which lives as long as the module is loaded ([performance.md](./performance.md#what-a-dropped-searcher-leaves-behind)).
fuzzysort retains nothing until its first `go()` fills its `prepare()` cache, which is process-wide and unevicted, so its **dropped** column equals its footprint<!-- bench:{{ assert(within(n("memory", "fuzzysort", "dropped MB"), n("memory", "fuzzysort", "+ `gensler`"), 0), "fuzzysort's dropped footprint equals its retained one") }} --><!-- bench:end --> until you call `cleanup()`.
Every other library gives its index back, leaving under <!-- bench:{{ constant("0.2") }} -->0.2<!-- bench:end --> MB.<!-- bench:{{ assert(lt(highest("memory", "@nozbe/microfuzz+fast-fuzzy+Fuse.js (tuned)+fuzzy+match-sorter+uFuzzy (all opts)", "dropped MB"), 0.2), "every library but Ekrina and fuzzysort leaves under 0.2 MB once dropped") }} --><!-- bench:end -->
The en cells, in [`bench/results.json`](../bench/results.json), tell the same story.

## Match quality, by query family

Each library has its own definition of a match, so raw outputs aren't directly comparable.
Every family below is ten queries sampled from across the list with a fixed seed ([`bench/catalogue.ts`](../bench/catalogue.ts)), each one that at most three items could answer, and each scored by the rank of its first relevant result.
A result is relevant when it holds what the query was typed for: every intended word as a word, in any order, for the phrases; the uncorrupted word for the typos and misspellings; the typed prefix for the half-typed words; the same initials for the acronyms.
Relevance is judged on the bench's own accent folding and word split, never on a library's.
So any item a person could have meant counts, and no library is credited for breaking a tie in favour of one particular item.
Ties that list order breaks are found by re-running each query over the reversed list, and a tie mixing relevant and irrelevant items scores its expected first-relevant rank.
Each cell is MRR@10 over the family's ten queries; the scorecard's MRR weights the group means ("The corpora and the query families").

**native corpus:**

<!-- bench:families-native -->
| Group         | Family                        | Ekrina | Ekrina (acronym) | fast-fuzzy | Fuse.js (tuned) | uFuzzy (all opts) | fuzzysort | @nozbe/microfuzz | match-sorter | fuzzy |
|---------------|-------------------------------|-------:|-----------------:|-----------:|----------------:|------------------:|----------:|-----------------:|-------------:|------:|
| typos         | neighbouring key              |   1.00 |             1.00 |       1.00 |            0.76 |              1.00 |      0.00 |             0.00 |         0.00 |  0.00 |
| typos         | two neighbouring keys         |   0.97 |             0.97 |       1.00 |            0.87 |              0.00 |      0.00 |             0.00 |         0.00 |  0.00 |
| typos         | random letter                 |   0.95 |             0.95 |       0.93 |            0.83 |              0.88 |      0.00 |             0.00 |         0.00 |  0.00 |
| typos         | dropped letter                |   0.97 |             0.97 |       0.63 |            0.71 |              0.80 |      0.90 |             0.77 |         0.93 |  0.62 |
| typos         | two dropped letters           |   1.00 |             1.00 |       0.43 |            0.34 |              0.00 |      0.93 |             0.89 |         1.00 |  0.94 |
| typos         | inserted neighbouring key     |   1.00 |             1.00 |       1.00 |            0.92 |              1.00 |      0.10 |             0.05 |         0.10 |  0.10 |
| typos         | swapped neighbours            |   0.80 |             0.80 |       0.79 |            0.48 |              0.79 |      0.08 |             0.04 |         0.06 |  0.06 |
| typos         | stuck key                     |   1.00 |             1.00 |       1.00 |            0.66 |              0.00 |      0.00 |             0.00 |         0.00 |  0.00 |
| typos         | first letter wrong            |   0.90 |             0.90 |       0.85 |            0.71 |              0.00 |      0.10 |             0.10 |         0.10 |  0.10 |
| typos         | typo in each of two words     |   1.00 |             1.00 |       1.00 |            1.00 |              1.00 |      0.00 |             0.00 |         0.00 |  0.00 |
| typos         | typo then a half-typed word   |   1.00 |             1.00 |       1.00 |            1.00 |              1.00 |      0.00 |             0.00 |         0.00 |  0.00 |
| typos         | two words joined, with a typo |   0.97 |             0.97 |       0.97 |            0.97 |              0.00 |      0.00 |             0.00 |         0.00 |  0.00 |
| phonetic      | consonant spelt another way   |   1.00 |             1.00 |       0.93 |            0.78 |              0.65 |      0.10 |             0.10 |         0.10 |  0.10 |
| phonetic      | letter doubled or singled     |   0.92 |             0.92 |       0.82 |            0.80 |              1.00 |      0.20 |             0.20 |         0.20 |  0.20 |
| phonetic      | silent letters dropped        |   0.61 |             0.61 |       0.60 |            0.47 |              0.53 |      0.70 |             0.56 |         0.56 |  0.62 |
| phonetic      | vowel sound spelt another way |   0.95 |             0.95 |       0.95 |            0.57 |              0.95 |      0.00 |             0.00 |         0.00 |  0.00 |
| partial words | prefix of 3                   |   1.00 |             1.00 |       0.90 |            1.00 |              1.00 |      1.00 |             1.00 |         1.00 |  0.66 |
| partial words | prefix of 5                   |   1.00 |             1.00 |       1.00 |            0.95 |              1.00 |      1.00 |             1.00 |         1.00 |  0.99 |
| partial words | infix of 5                    |   1.00 |             1.00 |       1.00 |            0.93 |              1.00 |      1.00 |             1.00 |         1.00 |  1.00 |
| partial words | two words half typed          |   1.00 |             1.00 |       0.14 |            1.00 |              1.00 |      1.00 |             1.00 |         0.95 |  0.80 |
| partial words | a vowel dropped               |   0.97 |             0.97 |       0.71 |            0.70 |              0.71 |      0.87 |             0.87 |         1.00 |  0.88 |
| partial words | 2 vowels dropped              |   0.90 |             0.90 |       0.37 |            0.43 |              0.03 |      0.90 |             0.80 |         0.95 |  0.76 |
| query shape   | two words                     |   1.00 |             1.00 |       1.00 |            1.00 |              1.00 |      1.00 |             0.88 |         0.90 |  0.68 |
| query shape   | two words reversed            |   1.00 |             1.00 |       0.07 |            1.00 |              0.95 |      1.00 |             0.90 |         0.00 |  0.00 |
| query shape   | two words joined              |   1.00 |             1.00 |       1.00 |            0.90 |              0.00 |      1.00 |             1.00 |         1.00 |  0.90 |
| query shape   | an absent word added          |   0.00 |             0.00 |       0.80 |            0.00 |              0.00 |      0.00 |             0.00 |         0.00 |  0.00 |
| noise         | space inside a word           |   1.00 |             1.00 |       0.91 |            1.00 |              0.90 |      1.00 |             0.00 |         0.00 |  0.00 |
| noise         | punctuation inside a word     |   1.00 |             1.00 |       0.95 |            0.83 |              1.00 |      0.00 |             0.00 |         0.00 |  0.00 |
| noise         | accents stripped              |   1.00 |             1.00 |       0.62 |            0.88 |              0.90 |      0.85 |             0.96 |         0.90 |  0.10 |
| noise         | accents added                 |   1.00 |             1.00 |       0.93 |            1.00 |              1.00 |      1.00 |             0.96 |         1.00 |  0.00 |
| reported only | acronym                       |   0.37 |             0.90 |       0.00 |            0.00 |              0.00 |      0.50 |             0.44 |         0.70 |  0.15 |
| reported only | plural for a singular         |   1.00 |             1.00 |       1.00 |            0.88 |              1.00 |      0.20 |             0.20 |         0.20 |  0.20 |
| phonetic      | real misspelling              |   0.78 |             0.78 |       0.74 |            0.58 |              0.64 |      0.40 |             0.30 |         0.30 |  0.30 |
<!-- bench:end -->

**en corpus:**

<!-- bench:families-en -->
| Group         | Family                        | Ekrina | Ekrina (acronym) | fast-fuzzy | Fuse.js (tuned) | uFuzzy (all opts) | fuzzysort | @nozbe/microfuzz | match-sorter | fuzzy |
|---------------|-------------------------------|-------:|-----------------:|-----------:|----------------:|------------------:|----------:|-----------------:|-------------:|------:|
| typos         | neighbouring key              |   1.00 |             1.00 |       1.00 |            0.90 |              1.00 |      0.00 |             0.00 |         0.00 |  0.00 |
| typos         | two neighbouring keys         |   1.00 |             1.00 |       1.00 |            0.95 |              0.00 |      0.00 |             0.00 |         0.00 |  0.00 |
| typos         | random letter                 |   0.95 |             0.95 |       0.93 |            0.81 |              0.88 |      0.00 |             0.00 |         0.00 |  0.00 |
| typos         | dropped letter                |   0.95 |             0.95 |       0.64 |            0.73 |              0.83 |      0.90 |             0.77 |         0.91 |  0.68 |
| typos         | two dropped letters           |   1.00 |             1.00 |       0.46 |            0.41 |              0.00 |      1.00 |             1.00 |         1.00 |  0.97 |
| typos         | inserted neighbouring key     |   1.00 |             1.00 |       1.00 |            0.85 |              1.00 |      0.00 |             0.00 |         0.00 |  0.00 |
| typos         | swapped neighbours            |   0.79 |             0.79 |       0.78 |            0.48 |              0.78 |      0.07 |             0.04 |         0.04 |  0.05 |
| typos         | stuck key                     |   1.00 |             1.00 |       1.00 |            0.68 |              0.00 |      0.00 |             0.00 |         0.00 |  0.00 |
| typos         | first letter wrong            |   0.95 |             0.95 |       0.90 |            0.80 |              0.00 |      0.10 |             0.10 |         0.10 |  0.10 |
| typos         | typo in each of two words     |   1.00 |             1.00 |       1.00 |            1.00 |              1.00 |      0.00 |             0.00 |         0.00 |  0.00 |
| typos         | typo then a half-typed word   |   1.00 |             1.00 |       1.00 |            1.00 |              1.00 |      0.00 |             0.00 |         0.00 |  0.00 |
| typos         | two words joined, with a typo |   0.97 |             0.97 |       0.97 |            0.97 |              0.00 |      0.00 |             0.00 |         0.00 |  0.00 |
| phonetic      | consonant spelt another way   |   1.00 |             1.00 |       0.93 |            0.65 |              0.65 |      0.10 |             0.10 |         0.10 |  0.10 |
| phonetic      | letter doubled or singled     |   1.00 |             1.00 |       0.93 |            0.83 |              1.00 |      0.20 |             0.20 |         0.20 |  0.20 |
| phonetic      | silent letters dropped        |   0.60 |             0.60 |       0.53 |            0.48 |              0.58 |      0.66 |             0.54 |         0.51 |  0.58 |
| phonetic      | vowel sound spelt another way |   0.95 |             0.95 |       0.81 |            0.44 |              0.80 |      0.00 |             0.00 |         0.00 |  0.00 |
| partial words | prefix of 3                   |   1.00 |             1.00 |       0.90 |            1.00 |              1.00 |      1.00 |             1.00 |         1.00 |  0.57 |
| partial words | prefix of 5                   |   1.00 |             1.00 |       1.00 |            1.00 |              1.00 |      1.00 |             1.00 |         1.00 |  0.97 |
| partial words | infix of 5                    |   1.00 |             1.00 |       1.00 |            0.92 |              1.00 |      0.95 |             1.00 |         1.00 |  0.94 |
| partial words | two words half typed          |   1.00 |             1.00 |       0.14 |            1.00 |              1.00 |      1.00 |             1.00 |         0.95 |  0.85 |
| partial words | a vowel dropped               |   0.97 |             0.97 |       0.76 |            0.76 |              0.76 |      0.87 |             0.85 |         0.95 |  0.84 |
| partial words | 2 vowels dropped              |   0.93 |             0.93 |       0.28 |            0.35 |              0.02 |      0.93 |             0.80 |         0.93 |  0.81 |
| query shape   | two words                     |   1.00 |             1.00 |       1.00 |            1.00 |              1.00 |      1.00 |             0.88 |         0.90 |  0.68 |
| query shape   | two words reversed            |   1.00 |             1.00 |       0.07 |            1.00 |              1.00 |      1.00 |             0.90 |         0.00 |  0.00 |
| query shape   | two words joined              |   1.00 |             1.00 |       1.00 |            1.00 |              0.00 |      1.00 |             1.00 |         1.00 |  0.80 |
| query shape   | an absent word added          |   0.00 |             0.00 |       0.80 |            0.00 |              0.00 |      0.00 |             0.00 |         0.00 |  0.00 |
| noise         | space inside a word           |   1.00 |             1.00 |       0.91 |            1.00 |              0.90 |      1.00 |             0.00 |         0.00 |  0.00 |
| noise         | punctuation inside a word     |   1.00 |             1.00 |       0.95 |            0.82 |              1.00 |      0.00 |             0.00 |         0.00 |  0.00 |
| noise         | accents stripped              |   1.00 |             1.00 |       0.65 |            0.85 |              1.00 |      0.93 |             0.96 |         1.00 |  0.13 |
| noise         | accents added                 |   1.00 |             1.00 |       0.93 |            0.97 |              1.00 |      1.00 |             0.95 |         1.00 |  0.00 |
| reported only | acronym                       |   0.64 |             0.88 |       0.05 |            0.00 |              0.00 |      0.78 |             0.47 |         0.73 |  0.03 |
| reported only | plural for a singular         |   1.00 |             1.00 |       1.00 |            0.71 |              1.00 |      0.30 |             0.30 |         0.25 |  0.30 |
| phonetic      | real misspelling              |   0.78 |             0.78 |       0.57 |            0.57 |              0.58 |      0.33 |             0.20 |         0.17 |  0.15 |
<!-- bench:end -->

**emoji corpus:**

<!-- bench:families-emoji -->
| Group         | Family                        | Ekrina | Ekrina (acronym) | fast-fuzzy | Fuse.js (tuned) | uFuzzy (all opts) | fuzzysort | @nozbe/microfuzz | match-sorter | fuzzy |
|---------------|-------------------------------|-------:|-----------------:|-----------:|----------------:|------------------:|----------:|-----------------:|-------------:|------:|
| typos         | neighbouring key              |   1.00 |             1.00 |       1.00 |            0.76 |              1.00 |      0.20 |             0.13 |         0.15 |  0.14 |
| typos         | two neighbouring keys         |   1.00 |             1.00 |       1.00 |            0.58 |              0.00 |      0.00 |             0.00 |         0.00 |  0.00 |
| typos         | random letter                 |   0.88 |             0.88 |       0.95 |            0.79 |              0.95 |      0.23 |             0.20 |         0.23 |  0.20 |
| typos         | dropped letter                |   1.00 |             1.00 |       0.75 |            0.46 |              0.52 |      0.80 |             0.78 |         0.92 |  0.66 |
| typos         | two dropped letters           |   1.00 |             1.00 |       0.74 |            0.49 |              0.00 |      0.83 |             0.68 |         0.82 |  0.69 |
| typos         | inserted neighbouring key     |   0.95 |             0.95 |       1.00 |            0.87 |              1.00 |      0.20 |             0.20 |         0.20 |  0.20 |
| typos         | swapped neighbours            |   1.00 |             1.00 |       1.00 |            0.44 |              1.00 |      0.38 |             0.29 |         0.24 |  0.38 |
| typos         | stuck key                     |   1.00 |             1.00 |       0.88 |            0.81 |              0.00 |      0.23 |             0.23 |         0.22 |  0.30 |
| typos         | first letter wrong            |   0.82 |             0.82 |       0.90 |            0.78 |              0.00 |      0.33 |             0.35 |         0.31 |  0.33 |
| typos         | typo in each of two words     |   1.00 |             1.00 |       1.00 |            1.00 |              1.00 |      0.05 |             0.00 |         0.00 |  0.00 |
| typos         | typo then a half-typed word   |   1.00 |             1.00 |       0.95 |            0.95 |              1.00 |      0.05 |             0.10 |         0.01 |  0.10 |
| typos         | two words joined, with a typo |   1.00 |             1.00 |       0.85 |            0.81 |              0.00 |      0.05 |             0.05 |         0.03 |  0.07 |
| phonetic      | consonant spelt another way   |   1.00 |             1.00 |       1.00 |            0.85 |              0.60 |      0.00 |             0.00 |         0.00 |  0.00 |
| phonetic      | letter doubled or singled     |   0.87 |             0.87 |       0.83 |            0.70 |              0.77 |      0.60 |             0.55 |         0.60 |  0.55 |
| phonetic      | silent letters dropped        |   0.60 |             0.60 |       0.56 |            0.27 |              0.50 |      0.50 |             0.60 |         0.60 |  0.50 |
| phonetic      | vowel sound spelt another way |   0.90 |             0.90 |       0.95 |            0.45 |              0.85 |      0.43 |             0.28 |         0.33 |  0.36 |
| partial words | prefix of 3                   |   1.00 |             1.00 |       0.65 |            0.67 |              1.00 |      0.95 |             1.00 |         1.00 |  0.61 |
| partial words | prefix of 5                   |   1.00 |             1.00 |       1.00 |            0.90 |              1.00 |      1.00 |             1.00 |         1.00 |  0.98 |
| partial words | infix of 5                    |   1.00 |             1.00 |       1.00 |            0.66 |              1.00 |      0.95 |             1.00 |         1.00 |  0.90 |
| partial words | two words half typed          |   1.00 |             1.00 |       0.13 |            0.95 |              1.00 |      1.00 |             1.00 |         0.90 |  0.91 |
| partial words | a vowel dropped               |   1.00 |             1.00 |       0.80 |            0.72 |              0.88 |      0.87 |             0.97 |         0.90 |  0.97 |
| partial words | 2 vowels dropped              |   0.95 |             0.95 |       0.49 |            0.50 |              0.10 |      0.90 |             0.77 |         0.82 |  0.75 |
| query shape   | two words                     |   1.00 |             1.00 |       1.00 |            1.00 |              1.00 |      1.00 |             1.00 |         1.00 |  1.00 |
| query shape   | two words reversed            |   1.00 |             1.00 |       0.23 |            1.00 |              0.92 |      1.00 |             0.70 |         0.12 |  0.10 |
| query shape   | two words joined              |   1.00 |             1.00 |       0.88 |            0.95 |              0.00 |      1.00 |             1.00 |         1.00 |  1.00 |
| query shape   | an absent word added          |   0.00 |             0.00 |       1.00 |            0.00 |              0.00 |      0.00 |             0.00 |         0.00 |  0.00 |
| noise         | space inside a word           |   1.00 |             1.00 |       1.00 |            1.00 |              1.00 |      1.00 |             0.10 |         0.10 |  0.10 |
| noise         | punctuation inside a word     |   1.00 |             1.00 |       1.00 |            1.00 |              1.00 |      0.10 |             0.10 |         0.10 |  0.10 |
| noise         | accents stripped              |   0.95 |             0.95 |       0.80 |            0.74 |              0.70 |      1.00 |             0.95 |         0.95 |  0.04 |
| noise         | accents added                 |   1.00 |             1.00 |       0.97 |            1.00 |              1.00 |      1.00 |             1.00 |         1.00 |  0.00 |
| reported only | acronym                       |   0.40 |             0.90 |       0.02 |            0.00 |              0.00 |      0.78 |             0.62 |         0.23 |  0.04 |
| reported only | plural for a singular         |   1.00 |             1.00 |       1.00 |            0.87 |              1.00 |      0.70 |             0.70 |         0.51 |  0.70 |
| phonetic      | real misspelling              |   0.90 |             0.90 |       0.70 |            0.60 |              0.68 |      0.22 |             0.23 |         0.12 |  0.23 |
<!-- bench:end -->

Queries nothing answers have no rank to score, so each cell is the share of that kind's twenty queries a library answered at all, where 0 is correct.

**native corpus:**

<!-- bench:refusals-native -->
| Query nothing answers                   | Ekrina | Ekrina (acronym) | fast-fuzzy | Fuse.js (tuned) | uFuzzy (all opts) | fuzzysort | @nozbe/microfuzz | match-sorter | fuzzy |
|-----------------------------------------|-------:|-----------------:|-----------:|----------------:|------------------:|----------:|-----------------:|-------------:|------:|
| a word 3 edits from every word          |   0.00 |             0.00 |       0.65 |            1.00 |              0.00 |      0.25 |             0.25 |         0.25 |  0.25 |
| a word 4 edits from every word          |   0.00 |             0.00 |       0.40 |            0.55 |              0.00 |      0.05 |             0.05 |         0.05 |  0.05 |
| a word 5 edits from every word          |   0.00 |             0.00 |       0.10 |            0.20 |              0.00 |      0.00 |             0.00 |         0.00 |  0.00 |
| random letters, 4 edits from every word |   0.00 |             0.00 |       0.05 |            0.60 |              0.00 |      0.05 |             0.05 |         0.05 |  0.05 |
| two words, each 3 edits from every word |   0.00 |             0.00 |       0.00 |            0.00 |              0.00 |      0.00 |             0.00 |         0.00 |  0.00 |
<!-- bench:end -->

**en corpus:**

<!-- bench:refusals-en -->
| Query nothing answers                   | Ekrina | Ekrina (acronym) | fast-fuzzy | Fuse.js (tuned) | uFuzzy (all opts) | fuzzysort | @nozbe/microfuzz | match-sorter | fuzzy |
|-----------------------------------------|-------:|-----------------:|-----------:|----------------:|------------------:|----------:|-----------------:|-------------:|------:|
| a word 3 edits from every word          |   0.00 |             0.00 |       0.80 |            1.00 |              0.00 |      0.10 |             0.10 |         0.10 |  0.10 |
| a word 4 edits from every word          |   0.00 |             0.00 |       0.35 |            0.55 |              0.00 |      0.00 |             0.00 |         0.00 |  0.00 |
| a word 5 edits from every word          |   0.00 |             0.00 |       0.10 |            0.10 |              0.00 |      0.00 |             0.00 |         0.00 |  0.00 |
| random letters, 4 edits from every word |   0.00 |             0.00 |       0.05 |            0.65 |              0.00 |      0.05 |             0.05 |         0.05 |  0.05 |
| two words, each 3 edits from every word |   0.00 |             0.00 |       0.00 |            0.00 |              0.00 |      0.00 |             0.00 |         0.00 |  0.00 |
<!-- bench:end -->

**emoji corpus:**

<!-- bench:refusals-emoji -->
| Query nothing answers                   | Ekrina | Ekrina (acronym) | fast-fuzzy | Fuse.js (tuned) | uFuzzy (all opts) | fuzzysort | @nozbe/microfuzz | match-sorter | fuzzy |
|-----------------------------------------|-------:|-----------------:|-----------:|----------------:|------------------:|----------:|-----------------:|-------------:|------:|
| a word 3 edits from every word          |   0.00 |             0.00 |       0.75 |            0.95 |              0.00 |      0.55 |             0.55 |         0.55 |  0.55 |
| a word 4 edits from every word          |   0.00 |             0.00 |       0.40 |            0.40 |              0.00 |      0.20 |             0.20 |         0.20 |  0.20 |
| a word 5 edits from every word          |   0.00 |             0.00 |       0.10 |            0.00 |              0.00 |      0.10 |             0.10 |         0.10 |  0.10 |
| random letters, 4 edits from every word |   0.00 |             0.00 |       0.00 |            0.30 |              0.00 |      0.35 |             0.35 |         0.35 |  0.35 |
| two words, each 3 edits from every word |   0.00 |             0.00 |       0.05 |            0.10 |              0.00 |      0.05 |             0.00 |         0.00 |  0.00 |
<!-- bench:end -->

### Family by family

MRR reads native / en, and the ten scored queries per family are in [`bench/results.json`](../bench/results.json).

**Typos**

- **One edit** (neighbouring key, random letter, inserted key, swapped neighbours, first letter wrong): Ekrina scores <!-- bench:{{ span(lowest("families-native+families-en", "neighbouring key+random letter+inserted neighbouring key+swapped neighbours+first letter wrong", "Ekrina"), highest("families-native+families-en", "neighbouring key+random letter+inserted neighbouring key+swapped neighbours+first letter wrong", "Ekrina"), 2) }} -->0.79–1.00<!-- bench:end -->, fast-fuzzy <!-- bench:{{ span(lowest("families-native+families-en", "neighbouring key+random letter+inserted neighbouring key+swapped neighbours+first letter wrong", "fast-fuzzy"), highest("families-native+families-en", "neighbouring key+random letter+inserted neighbouring key+swapped neighbours+first letter wrong", "fast-fuzzy"), 2) }} -->0.78–1.00<!-- bench:end --> and uFuzzy (all opts) <!-- bench:{{ span(lowest("families-native+families-en", "neighbouring key+random letter+inserted neighbouring key+swapped neighbours", "uFuzzy (all opts)"), highest("families-native+families-en", "neighbouring key+random letter+inserted neighbouring key+swapped neighbours", "uFuzzy (all opts)"), 2) }} -->0.78–1.00<!-- bench:end --> bar the first letter, where it scores <!-- bench:{{ highest("families-native+families-en", "first letter wrong", "uFuzzy (all opts)") }} -->0<!-- bench:end -->; Fuse.js (tuned) scores <!-- bench:{{ span(lowest("families-native+families-en", "neighbouring key+random letter+inserted neighbouring key+swapped neighbours+first letter wrong", "Fuse.js (tuned)"), highest("families-native+families-en", "neighbouring key+random letter+inserted neighbouring key+swapped neighbours+first letter wrong", "Fuse.js (tuned)"), 2) }} -->0.48–0.92<!-- bench:end -->, and the chain engines <!-- bench:{{ fixed(highest("families-native+families-en", "neighbouring key+random letter+inserted neighbouring key+swapped neighbours+first letter wrong", "fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), 2) }} -->0.10<!-- bench:end --> or less.
- **Dropped letter**: still a subsequence, so the chain engines score <!-- bench:{{ span(lowest("families-native+families-en", "dropped letter", "fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), highest("families-native+families-en", "dropped letter", "fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), 2) }} -->0.62–0.93<!-- bench:end -->; Ekrina scores <!-- bench:{{ labelCell("families-native", "dropped letter", "Ekrina") }} -->0.97<!-- bench:end --> / <!-- bench:{{ labelCell("families-en", "dropped letter", "Ekrina") }} -->0.95<!-- bench:end -->.
- **Two edits in one word or phrase** (two neighbouring keys, two dropped letters, stuck key, a typo in each of two words, two words joined with a typo): Ekrina scores <!-- bench:{{ span(lowest("families-native+families-en", "two neighbouring keys+two dropped letters+stuck key+typo in each of two words+two words joined, with a typo", "Ekrina"), highest("families-native+families-en", "two neighbouring keys+two dropped letters+stuck key+typo in each of two words+two words joined, with a typo", "Ekrina"), 2) }} -->0.97–1.00<!-- bench:end -->, fast-fuzzy <!-- bench:{{ span(lowest("families-native+families-en", "two neighbouring keys+two dropped letters+stuck key+typo in each of two words+two words joined, with a typo", "fast-fuzzy"), highest("families-native+families-en", "two neighbouring keys+two dropped letters+stuck key+typo in each of two words+two words joined, with a typo", "fast-fuzzy"), 2) }} -->0.43–1.00<!-- bench:end --> and Fuse.js (tuned) <!-- bench:{{ span(lowest("families-native+families-en", "two neighbouring keys+two dropped letters+stuck key+typo in each of two words+two words joined, with a typo", "Fuse.js (tuned)"), highest("families-native+families-en", "two neighbouring keys+two dropped letters+stuck key+typo in each of two words+two words joined, with a typo", "Fuse.js (tuned)"), 2) }} -->0.34–1.00<!-- bench:end -->.
  Two dropped letters stay a subsequence, which is why the chain engines still reach <!-- bench:{{ span(lowest("families-native+families-en", "two dropped letters", "fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), highest("families-native+families-en", "two dropped letters", "fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), 2) }} -->0.89–1.00<!-- bench:end --> there.

**Phonetic**

- **Consonants and vowels spelt another way** (`kortex`, `marilin`): Ekrina scores <!-- bench:{{ span(lowest("families-native+families-en", "consonant spelt another way+vowel sound spelt another way", "Ekrina"), highest("families-native+families-en", "consonant spelt another way+vowel sound spelt another way", "Ekrina"), 2) }} -->0.95–1.00<!-- bench:end --> and fast-fuzzy <!-- bench:{{ span(lowest("families-native+families-en", "consonant spelt another way+vowel sound spelt another way", "fast-fuzzy"), highest("families-native+families-en", "consonant spelt another way+vowel sound spelt another way", "fast-fuzzy"), 2) }} -->0.81–0.95<!-- bench:end -->; Fuse.js (tuned) falls to <!-- bench:{{ span(lowest("families-native+families-en", "consonant spelt another way+vowel sound spelt another way", "Fuse.js (tuned)"), highest("families-native+families-en", "consonant spelt another way+vowel sound spelt another way", "Fuse.js (tuned)"), 2) }} -->0.44–0.78<!-- bench:end -->.
- **Silent letters dropped** (`rong`, `were`): <!-- bench:{{ span(lowest("families-native+families-en", "silent letters dropped", "Ekrina+Ekrina (acronym)+fast-fuzzy+Fuse.js (tuned)+uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), highest("families-native+families-en", "silent letters dropped", "Ekrina+Ekrina (acronym)+fast-fuzzy+Fuse.js (tuned)+uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), 2) }} -->0.47–0.70<!-- bench:end --> for every library, with fuzzysort highest at <!-- bench:{{ labelCell("families-native", "silent letters dropped", "fuzzysort") }} -->0.70<!-- bench:end --> / <!-- bench:{{ labelCell("families-en", "silent letters dropped", "fuzzysort") }} -->0.66<!-- bench:end --><!-- bench:{{ assert(within(highest("families-en", "silent letters dropped", "Ekrina+Ekrina (acronym)+fast-fuzzy+Fuse.js (tuned)+uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), highest("families-en", "silent letters dropped", "fuzzysort"), 0), "fuzzysort scores highest on en silent letters") }} --><!-- bench:end --><!-- bench:{{ assert(within(highest("families-native", "silent letters dropped", "Ekrina+Ekrina (acronym)+fast-fuzzy+Fuse.js (tuned)+uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), highest("families-native", "silent letters dropped", "fuzzysort"), 0), "fuzzysort scores highest on native silent letters") }} --><!-- bench:end --> and Ekrina at <!-- bench:{{ labelCell("families-native", "silent letters dropped", "Ekrina") }} -->0.61<!-- bench:end --> / <!-- bench:{{ labelCell("families-en", "silent letters dropped", "Ekrina") }} -->0.60<!-- bench:end -->.
- **Real misspellings** (`tahn`, `rela`): Ekrina scores <!-- bench:{{ labelCell("families-native", "real misspelling", "Ekrina") }} -->0.78<!-- bench:end --> on both corpora<!-- bench:{{ assert(within(lowest("families-native+families-en", "real misspelling", "Ekrina"), highest("families-native+families-en", "real misspelling", "Ekrina"), 0), "Ekrina scores the same on real misspellings on both corpora") }} --><!-- bench:end --> and fast-fuzzy <!-- bench:{{ labelCell("families-native", "real misspelling", "fast-fuzzy") }} -->0.74<!-- bench:end --> / <!-- bench:{{ labelCell("families-en", "real misspelling", "fast-fuzzy") }} -->0.57<!-- bench:end -->.

**Partial words**

- **Prefixes and infixes**: <!-- bench:{{ span(lowest("families-native+families-en", "prefix of 3+prefix of 5+infix of 5", "Ekrina+Ekrina (acronym)+fast-fuzzy+Fuse.js (tuned)+uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz+match-sorter"), highest("families-native+families-en", "prefix of 3+prefix of 5+infix of 5", "Ekrina+Ekrina (acronym)+fast-fuzzy+Fuse.js (tuned)+uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz+match-sorter"), 2) }} -->0.90–1.00<!-- bench:end --> for every library but fuzzy, which falls to <!-- bench:{{ span(lowest("families-native+families-en", "prefix of 3", "fuzzy"), highest("families-native+families-en", "prefix of 3", "fuzzy"), 2) }} -->0.57–0.66<!-- bench:end --> on three-letter prefixes.
- **Two words half typed** (`ana fra`): <!-- bench:{{ span(lowest("families-native+families-en", "two words half typed", "Ekrina+Ekrina (acronym)+Fuse.js (tuned)+uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), highest("families-native+families-en", "two words half typed", "Ekrina+Ekrina (acronym)+Fuse.js (tuned)+uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), 2) }} -->0.80–1.00<!-- bench:end --> everywhere except fast-fuzzy, at <!-- bench:{{ span(lowest("families-native+families-en", "two words half typed", "fast-fuzzy"), highest("families-native+families-en", "two words half typed", "fast-fuzzy"), 2) }} -->0.14<!-- bench:end -->.
- **Vowels dropped**: one vowel is <!-- bench:{{ span(lowest("families-native+families-en", "a vowel dropped", "Ekrina+Ekrina (acronym)+fast-fuzzy+Fuse.js (tuned)+uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), highest("families-native+families-en", "a vowel dropped", "Ekrina+Ekrina (acronym)+fast-fuzzy+Fuse.js (tuned)+uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), 2) }} -->0.70–1.00<!-- bench:end --> everywhere; with two, Ekrina and the chain engines keep <!-- bench:{{ span(lowest("families-native+families-en", "2 vowels dropped", "Ekrina+fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), highest("families-native+families-en", "2 vowels dropped", "Ekrina+fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), 2) }} -->0.76–0.95<!-- bench:end -->, while fast-fuzzy, Fuse.js (tuned) and uFuzzy (all opts) fall to <!-- bench:{{ span(lowest("families-native+families-en", "2 vowels dropped", "fast-fuzzy+Fuse.js (tuned)+uFuzzy (all opts)"), highest("families-native+families-en", "2 vowels dropped", "fast-fuzzy+Fuse.js (tuned)+uFuzzy (all opts)"), 2) }} -->0.02–0.43<!-- bench:end -->.

**Query shape**

- **Two words reversed**: the order-independent engines score <!-- bench:{{ span(lowest("families-native+families-en", "two words reversed", "Ekrina+Ekrina (acronym)+Fuse.js (tuned)+uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz"), highest("families-native+families-en", "two words reversed", "Ekrina+Ekrina (acronym)+Fuse.js (tuned)+uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz"), 2) }} -->0.90–1.00<!-- bench:end -->; fast-fuzzy scores <!-- bench:{{ span(lowest("families-native+families-en", "two words reversed", "fast-fuzzy"), highest("families-native+families-en", "two words reversed", "fast-fuzzy"), 2) }} -->0.07<!-- bench:end -->, match-sorter and fuzzy <!-- bench:{{ highest("families-native+families-en", "two words reversed", "match-sorter+fuzzy") }} -->0<!-- bench:end -->.
- **Two words joined**: uFuzzy (all opts) scores <!-- bench:{{ highest("families-native+families-en", "two words joined", "uFuzzy (all opts)") }} -->0<!-- bench:end -->, since it allows no gap inside a term; everything else <!-- bench:{{ span(lowest("families-native+families-en", "two words joined", "Ekrina+Ekrina (acronym)+fast-fuzzy+Fuse.js (tuned)+fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), highest("families-native+families-en", "two words joined", "Ekrina+Ekrina (acronym)+fast-fuzzy+Fuse.js (tuned)+fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), 2) }} -->0.80–1.00<!-- bench:end -->.
- **An absent word added** (`roman lob qboawk`): only fast-fuzzy answers (<!-- bench:{{ span(lowest("families-native+families-en", "an absent word added", "fast-fuzzy"), highest("families-native+families-en", "an absent word added", "fast-fuzzy"), 2) }} -->0.80<!-- bench:end -->)<!-- bench:{{ assert(lt(highest("families-native+families-en", "an absent word added", "Ekrina+Ekrina (acronym)+Fuse.js (tuned)+uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), 0.005), "only fast-fuzzy answers a query with an absent word") }} --><!-- bench:end -->, since every other engine requires every query word and Ekrina does by design.

**Noise**

- **A space or punctuation inside a word** (`web ster`, `proa-ctiva`): Ekrina scores <!-- bench:{{ span(lowest("families-native+families-en", "space inside a word+punctuation inside a word", "Ekrina"), highest("families-native+families-en", "space inside a word+punctuation inside a word", "Ekrina"), 2) }} -->1.00<!-- bench:end -->, beside fast-fuzzy's <!-- bench:{{ span(lowest("families-native+families-en", "space inside a word+punctuation inside a word", "fast-fuzzy"), highest("families-native+families-en", "space inside a word+punctuation inside a word", "fast-fuzzy"), 2) }} -->0.91–0.95<!-- bench:end -->, Fuse.js (tuned)'s <!-- bench:{{ span(lowest("families-native+families-en", "space inside a word+punctuation inside a word", "Fuse.js (tuned)"), highest("families-native+families-en", "space inside a word+punctuation inside a word", "Fuse.js (tuned)"), 2) }} -->0.82–1.00<!-- bench:end --> and uFuzzy (all opts)'s <!-- bench:{{ span(lowest("families-native+families-en", "space inside a word+punctuation inside a word", "uFuzzy (all opts)"), highest("families-native+families-en", "space inside a word+punctuation inside a word", "uFuzzy (all opts)"), 2) }} -->0.90–1.00<!-- bench:end -->.
- **Accents stripped and added**: the folding engines score <!-- bench:{{ span(lowest("families-native+families-en", "accents stripped+accents added", "Ekrina+Ekrina (acronym)+Fuse.js (tuned)+uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz+match-sorter"), highest("families-native+families-en", "accents stripped+accents added", "Ekrina+Ekrina (acronym)+Fuse.js (tuned)+uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz+match-sorter"), 2) }} -->0.85–1.00<!-- bench:end -->, fast-fuzzy <!-- bench:{{ span(lowest("families-native+families-en", "accents stripped+accents added", "fast-fuzzy"), highest("families-native+families-en", "accents stripped+accents added", "fast-fuzzy"), 2) }} -->0.62–0.93<!-- bench:end --> through edit distance rather than folding, and fuzzy <!-- bench:{{ span(lowest("families-native+families-en", "accents stripped+accents added", "fuzzy"), highest("families-native+families-en", "accents stripped+accents added", "fuzzy"), 2) }} -->0.00–0.13<!-- bench:end --> with no folding at all.

**Reported only**

- **Acronym** (`fno`): Ekrina scores <!-- bench:{{ labelCell("families-native", "acronym", "Ekrina") }} -->0.37<!-- bench:end --> / <!-- bench:{{ labelCell("families-en", "acronym", "Ekrina") }} -->0.64<!-- bench:end --> and Ekrina (acronym) <!-- bench:{{ labelCell("families-native", "acronym", "Ekrina (acronym)") }} -->0.90<!-- bench:end --> / <!-- bench:{{ labelCell("families-en", "acronym", "Ekrina (acronym)") }} -->0.88<!-- bench:end -->; match-sorter (<!-- bench:{{ labelCell("families-native", "acronym", "match-sorter") }} -->0.70<!-- bench:end --> / <!-- bench:{{ labelCell("families-en", "acronym", "match-sorter") }} -->0.73<!-- bench:end -->) and fuzzysort (<!-- bench:{{ labelCell("families-native", "acronym", "fuzzysort") }} -->0.50<!-- bench:end --> / <!-- bench:{{ labelCell("families-en", "acronym", "fuzzysort") }} -->0.78<!-- bench:end -->) reach the initials as subsequence chains; Fuse.js and fast-fuzzy score <!-- bench:{{ fixed(highest("families-native+families-en", "acronym", "Fuse.js (tuned)+fast-fuzzy"), 2) }} -->0.05<!-- bench:end --> or less.
- **Plural for a singular** (`kozarcis`): Ekrina, uFuzzy (all opts) and fast-fuzzy score <!-- bench:{{ span(lowest("families-native+families-en", "plural for a singular", "Ekrina+uFuzzy (all opts)+fast-fuzzy"), highest("families-native+families-en", "plural for a singular", "Ekrina+uFuzzy (all opts)+fast-fuzzy"), 2) }} -->1.00<!-- bench:end -->, the chain engines <!-- bench:{{ span(lowest("families-native+families-en", "plural for a singular", "fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), highest("families-native+families-en", "plural for a singular", "fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), 2) }} -->0.20–0.30<!-- bench:end -->.

**Emoji**

Labels and tags are short and share words heavily ("face", "hand", "flag: …"), and the ranking holds there: Ekrina scores <!-- bench:{{ cell("scorecard-emoji", "Ekrina", "MRR") }} -->0.91<!-- bench:end -->, fast-fuzzy <!-- bench:{{ cell("scorecard-emoji", "fast-fuzzy", "MRR") }} -->0.84<!-- bench:end --> and Fuse.js (tuned) <!-- bench:{{ cell("scorecard-emoji", "Fuse.js (tuned)", "MRR") }} -->0.71<!-- bench:end -->.<!-- bench:{{ assert(gt(min(sub(n("scorecard-emoji", "Ekrina", "MRR"), n("scorecard-emoji", "fast-fuzzy", "MRR")), sub(n("scorecard-emoji", "fast-fuzzy", "MRR"), n("scorecard-emoji", "Fuse.js (tuned)", "MRR"))), 0), "the emoji ranking holds: Ekrina, then fast-fuzzy, then Fuse.js (tuned)") }} --><!-- bench:end -->
fast-fuzzy's lead families on the Wikidata corpora carry over (an absent word added, <!-- bench:{{ labelCell("families-emoji", "an absent word added", "fast-fuzzy") }} -->1.00<!-- bench:end -->), and so do its losses (two words half typed, <!-- bench:{{ labelCell("families-emoji", "two words half typed", "fast-fuzzy") }} -->0.13<!-- bench:end -->; reversed, <!-- bench:{{ labelCell("families-emoji", "two words reversed", "fast-fuzzy") }} -->0.23<!-- bench:end -->).

**Queries nothing answers**

Every Ekrina configuration and uFuzzy (all opts) answer none of them on any corpus.<!-- bench:{{ assert(lt(highest("refusals-native+refusals-en+refusals-emoji", "a word 3 edits from every word+a word 4 edits from every word+a word 5 edits from every word+random letters, 4 edits from every word+two words, each 3 edits from every word", "Ekrina+Ekrina (acronym)+uFuzzy (all opts)"), 0.005), "Ekrina and uFuzzy (all opts) answer no query nothing answers") }} --><!-- bench:end -->
On the Wikidata corpora fast-fuzzy answers <!-- bench:{{ span(mul(lowest("refusals-native+refusals-en", "a word 3 edits from every word", "fast-fuzzy"), 100), mul(highest("refusals-native+refusals-en", "a word 3 edits from every word", "fast-fuzzy"), 100), 0, "%") }} -->65–80%<!-- bench:end --> of the words three edits from everything and <!-- bench:{{ span(mul(lowest("refusals-native+refusals-en", "a word 4 edits from every word", "fast-fuzzy"), 100), mul(highest("refusals-native+refusals-en", "a word 4 edits from every word", "fast-fuzzy"), 100), 0, "%") }} -->35–40%<!-- bench:end --> of those four edits away; Fuse.js (tuned) answers all of the three-edit words<!-- bench:{{ assert(gt(lowest("refusals-native+refusals-en", "a word 3 edits from every word", "Fuse.js (tuned)"), 0.995), "Fuse.js (tuned) answers every three-edit word") }} --><!-- bench:end -->, <!-- bench:{{ span(mul(lowest("refusals-native+refusals-en", "a word 4 edits from every word", "Fuse.js (tuned)"), 100), mul(highest("refusals-native+refusals-en", "a word 4 edits from every word", "Fuse.js (tuned)"), 100), 0, "%") }} -->55%<!-- bench:end --> of the four-edit ones and <!-- bench:{{ span(mul(lowest("refusals-native+refusals-en", "random letters, 4 edits from every word", "Fuse.js (tuned)"), 100), mul(highest("refusals-native+refusals-en", "random letters, 4 edits from every word", "Fuse.js (tuned)"), 100), 0, "%") }} -->60–65%<!-- bench:end --> of the random strings, and Fuse.js's defaults answer nearly every query of every kind<!-- bench:{{ assert(gt(lowest("library-fuse-scorecard-native+library-fuse-scorecard-en", "Fuse.js", "Junk"), 90), "Fuse.js's defaults answer nearly every query nothing answers") }} --><!-- bench:end -->.
The chain engines answer <!-- bench:{{ span(mul(lowest("refusals-native+refusals-en", "a word 3 edits from every word", "fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), 100), mul(highest("refusals-native+refusals-en", "a word 3 edits from every word", "fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), 100), 0, "%") }} -->10–25%<!-- bench:end --> of the three-edit words there, and <!-- bench:{{ span(mul(lowest("refusals-emoji", "a word 3 edits from every word", "fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), 100), mul(highest("refusals-emoji", "a word 3 edits from every word", "fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy"), 100), 0, "%") }} -->55%<!-- bench:end --> on emoji.

### garbage (`qxzwkv`)

<!-- bench:probe-miss -->
| Library           | matches | cold ms | vs `hinton` |
|-------------------|--------:|--------:|------------:|
| Ekrina            |       0 |   2.752 |         60% |
| fast-fuzzy        |       0 |  12.408 |         79% |
| Fuse.js (tuned)   |       0 |  13.411 |         83% |
| uFuzzy (all opts) |       0 |   0.999 |         67% |
| fuzzysort         |       0 |   6.418 |         93% |
| @nozbe/microfuzz  |       0 |   2.767 |         86% |
| match-sorter      |       0 |   3.629 |         50% |
| fuzzy             |       0 |   1.686 |         83% |
<!-- bench:end -->

No rank column: every library correctly returns nothing.
What separates them is how long that answer takes, shown against each library's own time for the short-word query `hinton` (one that does match), so the column reads as "what fraction of a real query does a hopeless one take".
A hopeless six-character query is _rescuable_, so before saying "no results" Ekrina tries harder: the literal pass comes up empty, and rather than fail it builds the union and bigram masks and attempts the corrections of the query, the same rescue that scores <!-- bench:{{ span(lowest("families-native+families-en", "neighbouring key+random letter+inserted neighbouring key+swapped neighbours+first letter wrong", "Ekrina"), highest("families-native+families-en", "neighbouring key+random letter+inserted neighbouring key+swapped neighbours+first letter wrong", "Ekrina"), 2) }} -->0.79–1.00<!-- bench:end --> on the one-edit typo families above.
That is why its miss takes <!-- bench:{{ fixed(n("probe-miss", "Ekrina", "cold ms"), 1) }} -->2.8<!-- bench:end --> ms cold at 10k, where uFuzzy (all opts) and fuzzy, whose empty result covers only the query as typed, take <!-- bench:{{ span(min(n("probe-miss", "uFuzzy (all opts)", "cold ms"), n("probe-miss", "fuzzy", "cold ms")), max(n("probe-miss", "uFuzzy (all opts)", "cold ms"), n("probe-miss", "fuzzy", "cold ms")), 1) }} -->1.0–1.7<!-- bench:end --> ms.
The work also happens once per searcher: the masks the garbage query builds are the ones every later rescue reuses, which is why the batch column absorbs it, a session's first query that needs the masks builds them and every later one reuses them.

## Scorecard

One line per configuration: MRR and junk from [`bench/hits.test.ts`](../bench/hits.test.ts) (ranks are deterministic, measured once, untimed), times from the process-cold matrix ("Timing method"; `pnpm vpr bench --all --runs=N` sets the processes per cell).
**MRR** = the group-weighted mean of the 33 scored families' MRR@10 ("The corpora and the query families"): ten queries each, scored by the rank of the first relevant result, misses and ranks outside the top 10 scoring 0.
**junk** = the share of the 100 queries nothing answers that the library answered anyway, averaged over the five kinds.
**index ms** = the constructor call (from the batch cell's fresh processes).
**cold ms** = the mean first-answer time across the six timed queries, each in its own fresh process.
**session ms** = the constructor plus one fresh process answering a warm-up match and then every representative query once: the realistic session, setup included wherever the library pays it.
**per query** = the mean of the 24 queries after the warm-up: how long a query takes once the searcher has answered real queries.
Which column matters depends on workload: search-as-you-type → **per query**; a handful of queries on a fresh searcher → **session ms**; backend one-shot → index + cold ("One measurement model"'s one-shot); a first-keystroke budget → **cold**.

**native corpus:**

<!-- bench:scorecard-native -->
| Library           |  MRR | Junk | index ms | cold ms | session ms | per query |
|-------------------|-----:|-----:|---------:|--------:|-----------:|----------:|
| Ekrina            | 0.91 |   0% |     0.17 |    3.35 |      14.01 |      0.32 |
| Ekrina (indexed)  | 0.91 |   0% |     2.13 |    1.76 |      13.34 |      0.31 |
| Ekrina (acronym)  | 0.91 |   0% |     0.19 |    3.02 |      14.30 |      0.32 |
| fast-fuzzy        | 0.81 |  24% |    27.86 |   14.06 |     148.57 |      4.41 |
| Fuse.js (tuned)   | 0.76 |  47% |     1.11 |   14.98 |     278.14 |     10.92 |
| uFuzzy (all opts) | 0.66 |   0% |     4.33 |    1.47 |      20.85 |      0.63 |
| fuzzysort         | 0.46 |   7% |     0.03 |    6.72 |      12.98 |      0.24 |
| @nozbe/microfuzz  | 0.41 |   7% |     4.50 |    2.97 |      39.55 |      1.33 |
| match-sorter      | 0.39 |   7% |     0.03 |    5.51 |      58.09 |      2.11 |
| fuzzy             | 0.30 |   7% |     0.03 |    1.83 |      37.96 |      1.50 |
<!-- bench:end -->

**en corpus:**

<!-- bench:scorecard-en -->
| Library           |  MRR | Junk | index ms | cold ms | session ms | per query |
|-------------------|-----:|-----:|---------:|--------:|-----------:|----------:|
| Ekrina            | 0.92 |   0% |     0.16 |    2.99 |      12.75 |      0.29 |
| Ekrina (indexed)  | 0.92 |   0% |     1.47 |    1.81 |      11.46 |      0.24 |
| Ekrina (acronym)  | 0.92 |   0% |     0.18 |    2.73 |      12.86 |      0.28 |
| fast-fuzzy        | 0.80 |  26% |    24.00 |   18.78 |     143.55 |      4.13 |
| Fuse.js (tuned)   | 0.76 |  46% |     1.06 |   13.59 |     239.56 |      9.36 |
| uFuzzy (all opts) | 0.66 |   0% |     4.35 |    1.42 |      19.42 |      0.56 |
| fuzzysort         | 0.45 |   3% |     0.03 |    6.42 |      12.67 |      0.24 |
| @nozbe/microfuzz  | 0.40 |   3% |     4.21 |    2.86 |      37.36 |      1.25 |
| match-sorter      | 0.38 |   3% |     0.03 |    5.13 |      51.50 |      1.85 |
| fuzzy             | 0.29 |   3% |     0.03 |    1.67 |      34.52 |      1.36 |
<!-- bench:end -->

**emoji corpus** (quality only here; its timing is listed, unranked, under "Size, speed & search type"):

<!-- bench:scorecard-emoji -->
| Library           |  MRR | Junk | index ms | cold ms | session ms | per query |
|-------------------|-----:|-----:|---------:|--------:|-----------:|----------:|
| Ekrina            | 0.91 |   0% |        — |       — |          — |         — |
| Ekrina (indexed)  | 0.91 |   0% |        — |       — |          — |         — |
| Ekrina (acronym)  | 0.91 |   0% |        — |       — |          — |         — |
| fast-fuzzy        | 0.84 |  26% |        — |       — |          — |         — |
| Fuse.js (tuned)   | 0.71 |  35% |        — |       — |          — |         — |
| uFuzzy (all opts) | 0.65 |   0% |        — |       — |          — |         — |
| fuzzysort         | 0.52 |  25% |        — |       — |          — |         — |
| @nozbe/microfuzz  | 0.47 |  24% |        — |       — |          — |         — |
| match-sorter      | 0.45 |  24% |        — |       — |          — |         — |
| fuzzy             | 0.39 |  24% |        — |       — |          — |         — |
<!-- bench:end -->

_Ekrina tops all three corpora_<!-- bench:{{ assert(gt(lowest("scorecard-native+scorecard-en+scorecard-emoji", "Ekrina", "MRR"), highest("scorecard-native+scorecard-en+scorecard-emoji", "fast-fuzzy+Fuse.js (tuned)+uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy", "MRR")), "Ekrina scores the highest MRR on every corpus") }} --><!-- bench:end --> at <!-- bench:{{ span(lowest("scorecard-native+scorecard-en+scorecard-emoji", "Ekrina", "MRR"), highest("scorecard-native+scorecard-en+scorecard-emoji", "Ekrina", "MRR"), 2) }} -->0.91–0.92<!-- bench:end -->, with no junk<!-- bench:{{ assert(lt(highest("scorecard-native+scorecard-en+scorecard-emoji", "Ekrina+Ekrina (acronym)+Ekrina (indexed)", "Junk"), 0.5), "no Ekrina row answers a query nothing answers") }} --><!-- bench:end -->; the nearest rows are fast-fuzzy at <!-- bench:{{ span(lowest("scorecard-native+scorecard-en+scorecard-emoji", "fast-fuzzy", "MRR"), highest("scorecard-native+scorecard-en+scorecard-emoji", "fast-fuzzy", "MRR"), 2) }} -->0.80–0.84<!-- bench:end -->, answering <!-- bench:{{ fraction(div(mean(n("scorecard-native", "fast-fuzzy", "Junk"), n("scorecard-en", "fast-fuzzy", "Junk"), n("scorecard-emoji", "fast-fuzzy", "Junk")), 100)) }} -->a quarter<!-- bench:end --> of the queries nothing answers, and Fuse.js (tuned) at <!-- bench:{{ span(lowest("scorecard-native+scorecard-en+scorecard-emoji", "Fuse.js (tuned)", "MRR"), highest("scorecard-native+scorecard-en+scorecard-emoji", "Fuse.js (tuned)", "MRR"), 2) }} -->0.71–0.76<!-- bench:end -->, answering <!-- bench:{{ span(mul(div(lowest("scorecard-native+scorecard-en+scorecard-emoji", "Fuse.js (tuned)", "Junk"), 100), 100), mul(div(highest("scorecard-native+scorecard-en+scorecard-emoji", "Fuse.js (tuned)", "Junk"), 100), 100), 0, "%") }} -->35–47%<!-- bench:end --> of them.
Read across the family tables, Ekrina's lead comes from covering the edit families without giving up the shape ones:

- **Typos and noise**: Ekrina scores <!-- bench:{{ span(lowest("families-native+families-en+families-emoji", "typos+space inside a word+punctuation inside a word", "Ekrina"), highest("families-native+families-en+families-emoji", "typos+space inside a word+punctuation inside a word", "Ekrina"), 2) }} -->0.79–1.00<!-- bench:end --> on every typo family and on a space or punctuation inside a word, where fast-fuzzy and Fuse.js (tuned) also do well (<!-- bench:{{ span(lowest("families-native+families-en+families-emoji", "typos+space inside a word+punctuation inside a word", "fast-fuzzy"), highest("families-native+families-en+families-emoji", "typos+space inside a word+punctuation inside a word", "fast-fuzzy"), 2) }} -->0.43–1.00<!-- bench:end --> and <!-- bench:{{ span(lowest("families-native+families-en+families-emoji", "typos+space inside a word+punctuation inside a word", "Fuse.js (tuned)"), highest("families-native+families-en+families-emoji", "typos+space inside a word+punctuation inside a word", "Fuse.js (tuned)"), 2) }} -->0.34–1.00<!-- bench:end -->).
- **Phrases in any order, half-typed or reversed**: Ekrina scores <!-- bench:{{ span(lowest("families-native+families-en+families-emoji", "two words+two words reversed+two words half typed", "Ekrina"), highest("families-native+families-en+families-emoji", "two words+two words reversed+two words half typed", "Ekrina"), 2) }} -->1.00<!-- bench:end --> on all of them, where fast-fuzzy scores <!-- bench:{{ span(lowest("families-native+families-en+families-emoji", "two words reversed", "fast-fuzzy"), highest("families-native+families-en+families-emoji", "two words reversed", "fast-fuzzy"), 2) }} -->0.07–0.23<!-- bench:end --> on reversed phrases and <!-- bench:{{ span(lowest("families-native+families-en+families-emoji", "two words half typed", "fast-fuzzy"), highest("families-native+families-en+families-emoji", "two words half typed", "fast-fuzzy"), 2) }} -->0.13–0.14<!-- bench:end --> on half-typed ones.
- **Refusal**: Ekrina answers none of the queries nothing answers, at any distance, on any corpus.<!-- bench:{{ assert(lt(highest("refusals-native+refusals-en+refusals-emoji", "a word 3 edits from every word+a word 4 edits from every word+a word 5 edits from every word+random letters, 4 edits from every word+two words, each 3 edits from every word", "Ekrina+Ekrina (acronym)+uFuzzy (all opts)"), 0.005), "Ekrina and uFuzzy (all opts) answer no query nothing answers") }} --><!-- bench:end -->

The families where Ekrina trails:

- **An absent word added**: <!-- bench:{{ highest("families-native+families-en+families-emoji", "an absent word added", "Ekrina") }} -->0<!-- bench:end -->, where fast-fuzzy scores <!-- bench:{{ span(lowest("families-native+families-en+families-emoji", "an absent word added", "fast-fuzzy"), highest("families-native+families-en+families-emoji", "an absent word added", "fast-fuzzy"), 2) }} -->0.80–1.00<!-- bench:end -->, since Ekrina requires every query word.
- **Silent letters dropped**: <!-- bench:{{ span(lowest("families-native+families-en", "silent letters dropped", "Ekrina"), highest("families-native+families-en", "silent letters dropped", "Ekrina"), 2) }} -->0.60–0.61<!-- bench:end -->, behind fuzzysort's <!-- bench:{{ span(lowest("families-native+families-en", "silent letters dropped", "fuzzysort"), highest("families-native+families-en", "silent letters dropped", "fuzzysort"), 2) }} -->0.66–0.70<!-- bench:end --> on the Wikidata corpora.<!-- bench:{{ assert(lt(highest("families-native+families-en", "silent letters dropped", "Ekrina"), lowest("families-native+families-en", "silent letters dropped", "fuzzysort")), "Ekrina trails fuzzysort on silent letters on both Wikidata corpora") }} --><!-- bench:end -->
- **A few typo and phonetic families on emoji** (random letter, inserted neighbouring key, first letter wrong, vowel sound spelt another way): <!-- bench:{{ span(lowest("families-emoji", "random letter+inserted neighbouring key+first letter wrong+vowel sound spelt another way", "Ekrina"), highest("families-emoji", "random letter+inserted neighbouring key+first letter wrong+vowel sound spelt another way", "Ekrina"), 2) }} -->0.82–0.95<!-- bench:end -->, where fast-fuzzy scores <!-- bench:{{ span(lowest("families-emoji", "random letter+inserted neighbouring key+first letter wrong+vowel sound spelt another way", "fast-fuzzy"), highest("families-emoji", "random letter+inserted neighbouring key+first letter wrong+vowel sound spelt another way", "fast-fuzzy"), 2) }} -->0.90–1.00<!-- bench:end -->.<!-- bench:{{ assert(lt(max(sub(lowest("families-emoji", "random letter", "Ekrina"), lowest("families-emoji", "random letter", "fast-fuzzy")), sub(lowest("families-emoji", "inserted neighbouring key", "Ekrina"), lowest("families-emoji", "inserted neighbouring key", "fast-fuzzy")), sub(lowest("families-emoji", "first letter wrong", "Ekrina"), lowest("families-emoji", "first letter wrong", "fast-fuzzy")), sub(lowest("families-emoji", "vowel sound spelt another way", "Ekrina"), lowest("families-emoji", "vowel sound spelt another way", "fast-fuzzy"))), 0), "Ekrina trails fast-fuzzy on each of these emoji families") }} --><!-- bench:end -->

Two libraries score higher with their options on, so for those the options decide the comparison: uFuzzy scores <!-- bench:{{ cell("scorecard-native", "uFuzzy (all opts)", "MRR") }} -->0.66<!-- bench:end --> with them against <!-- bench:{{ cell("library-ufuzzy-scorecard-native", "uFuzzy", "MRR") }} -->0.21<!-- bench:end --> on its defaults ([uFuzzy](./libraries/ufuzzy.md)), and Fuse.js <!-- bench:{{ cell("scorecard-native", "Fuse.js (tuned)", "MRR") }} -->0.76<!-- bench:end --> against <!-- bench:{{ cell("library-fuse-scorecard-native", "Fuse.js", "MRR") }} -->0.72<!-- bench:end --> ([Fuse.js](./libraries/fuse.md)).<!-- bench:{{ assert(lt(n("library-fuse-scorecard-native", "Fuse.js", "MRR"), n("scorecard-native", "Fuse.js (tuned)", "MRR")), "Fuse.js scores higher tuned than on its defaults") }} --><!-- bench:end -->

The scorecard's timing columns are exactly what the Pareto charts draw, one per workload; both draw the native 10k scorecard.

**Frontend workload** (one searcher answers every keystroke, so its index, built at load or by the first query that needs it, is paid once per session):

<!-- bench:pareto-query-picture -->
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./pareto-query-dark.svg">
  <img alt="Scatter plot of eight JavaScript fuzzy search libraries, each at its best-scoring configuration and Ekrina in three, comparing MRR (how highly each ranks the queried item) against mean milliseconds per query across one searcher's 24-query session, after a warm-up that takes each library's one-time setup except lazy Ekrina's index build, on a log scale, on the native 10k corpus over 33 query families. The Pareto frontier runs fuzzysort (0.46 MRR at 0.24 ms) to Ekrina (indexed) (0.91 MRR at 0.31 ms). Ekrina owns the accurate end of the frontier; its faster end is markedly less accurate, and every other configuration, including Fuse.js, is dominated." src="./pareto-query-light.svg">
</picture>
<!-- bench:end -->

Its x-axis is the batch's per-query time, the mean of the 24 queries after the warm-up, and its frontier runs fuzzysort → Ekrina (indexed).
fuzzysort owns the fast end, <!-- bench:{{ cell("scorecard-native", "fuzzysort", "MRR") }} -->0.46<!-- bench:end --> MRR at <!-- bench:{{ cell("scorecard-native", "fuzzysort", "per query") }} -->0.24<!-- bench:end --> ms with bare output<!-- bench:{{ assert(lt(n("scorecard-native", "fuzzysort", "per query"), lowest("scorecard-native", "Ekrina+Ekrina (acronym)+Ekrina (indexed)+fast-fuzzy+Fuse.js (tuned)+uFuzzy (all opts)+@nozbe/microfuzz+match-sorter+fuzzy", "per query")), "fuzzysort answers fastest per query") }} --><!-- bench:end -->, and Ekrina (indexed) reaches <!-- bench:{{ cell("scorecard-native", "Ekrina (indexed)", "MRR") }} -->0.91<!-- bench:end --> at <!-- bench:{{ cell("scorecard-native", "Ekrina (indexed)", "per query") }} -->0.31<!-- bench:end --> ms; uFuzzy (all opts), at <!-- bench:{{ cell("scorecard-native", "uFuzzy (all opts)", "MRR") }} -->0.66<!-- bench:end --> MRR and <!-- bench:{{ cell("scorecard-native", "uFuzzy (all opts)", "per query") }} -->0.63<!-- bench:end --> ms, is slower than every Ekrina row<!-- bench:{{ assert(gt(n("scorecard-native", "uFuzzy (all opts)", "per query"), highest("scorecard-native", "Ekrina+Ekrina (acronym)+Ekrina (indexed)", "per query")), "uFuzzy (all opts) is slower per query than every Ekrina row") }} --><!-- bench:end --> and below them on quality.<!-- bench:{{ assert(lt(n("scorecard-native", "uFuzzy (all opts)", "MRR"), lowest("scorecard-native", "Ekrina+Ekrina (acronym)+Ekrina (indexed)", "MRR")), "uFuzzy (all opts) scores below every Ekrina row") }} --><!-- bench:end -->
Ekrina (acronym) scores the same <!-- bench:{{ cell("scorecard-native", "Ekrina (acronym)", "MRR") }} -->0.91<!-- bench:end --><!-- bench:{{ assert(within(n("scorecard-native", "Ekrina (acronym)", "MRR"), n("scorecard-native", "Ekrina (indexed)", "MRR"), 0), "Ekrina (acronym) scores the same MRR as Ekrina (indexed)") }} --><!-- bench:end --> at <!-- bench:{{ cell("scorecard-native", "Ekrina (acronym)", "per query") }} -->0.32<!-- bench:end --> ms, within <!-- bench:{{ constant("15%") }} -->15%<!-- bench:end --> of Ekrina (indexed)<!-- bench:{{ assert(within(raw("coldMatrix", "native", "batch", "10000", "ekrina (acronym)", "restMs"), raw("coldMatrix", "native", "batch", "10000", "ekrina (indexed)", "restMs"), 0.15), "Ekrina (acronym) is inside the tie band of Ekrina (indexed) per query") }} --><!-- bench:end -->, and Ekrina at <!-- bench:{{ cell("scorecard-native", "Ekrina", "per query") }} -->0.32<!-- bench:end --> ms, <!-- bench:{{ pct(sub(div(raw("coldMatrix", "native", "batch", "10000", "ekrina", "restMs"), raw("coldMatrix", "native", "batch", "10000", "ekrina (indexed)", "restMs")), 1)) }} -->6%<!-- bench:end --> behind it and also inside the tie band<!-- bench:{{ assert(within(raw("coldMatrix", "native", "batch", "10000", "ekrina", "restMs"), raw("coldMatrix", "native", "batch", "10000", "ekrina (indexed)", "restMs"), 0.15), "Ekrina is inside the tie band of Ekrina (indexed) per query") }} --><!-- bench:end -->; both sit just off the frontier.
fast-fuzzy and Fuse.js (tuned), the next rows on quality<!-- bench:{{ assert(lt(highest("scorecard-native", "uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy", "MRR"), lowest("scorecard-native", "fast-fuzzy+Fuse.js (tuned)", "MRR")), "fast-fuzzy and Fuse.js (tuned) are the next rows on quality after Ekrina") }} --><!-- bench:end -->, take <!-- bench:{{ cell("scorecard-native", "fast-fuzzy", "per query") }} -->4.41<!-- bench:end --> ms and <!-- bench:{{ cell("scorecard-native", "Fuse.js (tuned)", "per query") }} -->10.92<!-- bench:end --> ms per query.

**Backend one-shot workload** (a fresh process runs constructor + first answer): the chart is in [the comparison](./compare.md), which shows it deliberately, since it is the less flattering of the two Pareto charts.
Its frontier runs `fuzzy` → Ekrina (acronym): a no-index substring scan at <!-- bench:{{ cell("scorecard-native", "fuzzy", "MRR") }} -->0.30<!-- bench:end --> MRR owns the fast end<!-- bench:{{ assert(lt(oneShot("native", 10000, "fuzzy"), min(oneShot("native", 10000, "ekrina"), oneShot("native", 10000, "ekrina (acronym)"), oneShot("native", 10000, "ekrina (indexed)"), oneShot("native", 10000, "fast-fuzzy"), oneShot("native", 10000, "fuse.js (tuned)"), oneShot("native", 10000, "uFuzzy (all opts)"), oneShot("native", 10000, "fuzzysort"), oneShot("native", 10000, "@nozbe/microfuzz"), oneShot("native", 10000, "match-sorter"))), "fuzzy has the fastest native 10k one-shot") }} --><!-- bench:end --> (<!-- bench:{{ fixed(oneShot("native", 10000, "fuzzy"), 2) }} -->1.86<!-- bench:end --> ms), and Ekrina (acronym) reaches <!-- bench:{{ cell("scorecard-native", "Ekrina (acronym)", "MRR") }} -->0.91<!-- bench:end --> at <!-- bench:{{ fixed(oneShot("native", 10000, "ekrina (acronym)"), 2) }} -->3.20<!-- bench:end --> ms, with Ekrina <!-- bench:{{ pct(sub(div(oneShot("native", 10000, "ekrina"), oneShot("native", 10000, "ekrina (acronym)")), 1)) }} -->10%<!-- bench:end --> behind it at <!-- bench:{{ fixed(oneShot("native", 10000, "ekrina"), 2) }} -->3.52<!-- bench:end --> ms and Ekrina (indexed) <!-- bench:{{ pct(sub(div(oneShot("native", 10000, "ekrina (indexed)"), oneShot("native", 10000, "ekrina (acronym)")), 1)) }} -->22%<!-- bench:end --> behind at <!-- bench:{{ fixed(oneShot("native", 10000, "ekrina (indexed)"), 2) }} -->3.90<!-- bench:end --> ms.<!-- bench:{{ assert(lt(oneShot("native", 10000, "ekrina (acronym)"), min(oneShot("native", 10000, "ekrina"), oneShot("native", 10000, "ekrina (indexed)"))), "Ekrina (acronym) has the fastest one-shot of the Ekrina rows") }} --><!-- bench:end -->
This is where Ekrina's lazy preparation shows up, against a <!-- bench:{{ cell("scorecard-native", "Ekrina", "index ms") }} -->0.17<!-- bench:end --> ms constructor.
A fresh searcher's first answer prepares the text of every item it matches, and a single-word query finds them with a scan of the raw strings.
The per-item mask index is built only on the first query that needs it: one with a second word, one that goes to the typo rescue (five or more characters with fewer than ten literal matches, or four that match nothing at all), one the second pass reads over the whole list because nothing matches it literally, or one holding a character outside Latin letters and digits, which the raw scan cannot fold.
For Ekrina the acronym query `tfts` is the third case, since only fuzzy chains match it; Ekrina (acronym)'s acronym tier matches it literally, so its second pass reads only the literal pass's survivors and the index is never built.
That one query is Ekrina (acronym)'s whole lead on this chart: <!-- bench:{{ fixed(raw("coldMatrix", "native", "acronym", "10000", "ekrina (acronym)", "oneShotMs"), 2) }} -->2.28<!-- bench:end --> ms one-shot against Ekrina's <!-- bench:{{ fixed(raw("coldMatrix", "native", "acronym", "10000", "ekrina", "oneShotMs"), 2) }} -->4.65<!-- bench:end -->, where over the other five timed queries the two are level<!-- bench:{{ assert(within(oneShotWithout("native", 10000, "ekrina (acronym)", "acronym"), oneShotWithout("native", 10000, "ekrina", "acronym"), 0.15), "Ekrina and Ekrina (acronym) are level one-shot without the acronym query") }} --><!-- bench:end -->, Ekrina (acronym) averaging <!-- bench:{{ fixed(oneShotWithout("native", 10000, "ekrina (acronym)", "acronym"), 2) }} -->3.38<!-- bench:end --> ms to Ekrina's <!-- bench:{{ fixed(oneShotWithout("native", 10000, "ekrina", "acronym"), 2) }} -->3.29<!-- bench:end -->.
The per-query cells are in [`bench/results.json`](../bench/results.json).

_Both charts read the scorecard above out of [`bench/results.json`](../bench/results.json) ([`pareto.ts`](./pareto.ts)), so they cannot disagree with it; `pnpm vpr bench --all` redraws them._

## Size, speed & search type

**Gzip** = esbuild `--bundle --minify`, tree-shaken to each lib's primary API, gzipped by Node's zlib, measured by `pnpm vpr bench --size --all` (the size table is in [Libraries](#libraries)).
Every cell is process-cold ("One measurement model"), and each corpus gets two tables.
The scale table measures the one-shot workload: **index** = the constructor, **cold query** = mean first answer across the six timed queries (each in its own fresh process), **total** = the mean of constructor + first answer, summed inside each query's own child, **total rel** = that total relative to Ekrina (<!-- bench:{{ constant("100%") }} -->100%<!-- bench:end --> = same, lower = faster).
The batch table reads cold to warm and ends on what it ranks by: **build** = the constructor, **first answer** = the warm-up, **session total** = all of them together, **per query** = the mean of the 24 queries after the warm-up, **per query rel** = that relative to Ekrina.
The aggregate row is a **geometric mean**: per-library times span orders of magnitude, so an arithmetic mean would only describe the slowest library; the geomean is the standard aggregate for multiplicative spreads, and the rel cells are equally the geomean of each rel column (a geomean of ratios is the ratio of geomeans).
These tables publish the 100k size, and emoji's its whole 1,923 items; the 10k matrix and the scorecard carry the fine-grained view, and every cell of both sits in [`bench/results.json`](../bench/results.json).
The three corpora are described in "The corpora and the query families"; they're benched separately.
The native table only lists configurations that fold diacritics, i.e. actually do that corpus's task (cross-checked per query by [`bench/hits.test.ts`](../bench/hits.test.ts)); a fast non-folding row would be fast at a different, easier job, so those are omitted and named below the table.
The **_all libraries_** row is the corpus-wide view: the geometric mean of every shown configuration at that size.
**(all opts)** rows switch on every opt-in the library has: diacritic folding, multi-word, highlight/ranges output, and typo modes; base rows are stock defaults, and [Libraries](#libraries) itemises which opt-in is which.
Typo modes are included because Ekrina's typo matching is always on and cannot be disabled, so holding another engine's typo mode off would time two engines doing different jobs.
Only uFuzzy is affected in practice.
Fuse.js (Bitap) and fast-fuzzy (edit distance) are typo-tolerant in every configuration here.
Every child consumes its result counts, the runner asserts they are identical across a cell's processes, and [`bench/hits.test.ts`](../bench/hits.test.ts) records per-library match counts for every query, so the timings above are known to be timing comparable work.
Per-cell minimums and heap footprints are in [`bench/results.json`](../bench/results.json).
Ekrina leads its own table; the rest are alphabetical, so nothing is ordered by how well it did.

### en corpus

<!-- bench:speed-en -->
| Library                   |     index | cold query |     total | total rel |
|---------------------------|----------:|-----------:|----------:|----------:|
| **Ekrina**                |   0.23 ms |    8.10 ms |   8.34 ms |  **100%** |
| Ekrina (acronym)          |   0.26 ms |    7.65 ms |   7.90 ms |       95% |
| Ekrina (indexed)          |   6.63 ms |    3.35 ms |  10.02 ms |      120% |
| @nozbe/microfuzz          |  48.59 ms |   16.54 ms |  65.41 ms |      784% |
| fast-fuzzy                | 218.34 ms |   75.56 ms | 294.08 ms |     3525% |
| Fuse.js (tuned)           |   4.93 ms |  100.15 ms | 105.01 ms |     1259% |
| fuzzy                     |   0.03 ms |   13.57 ms |  13.60 ms |      163% |
| fuzzysort                 |   0.03 ms |   57.14 ms |  57.17 ms |      685% |
| match-sorter              |   0.03 ms |   24.54 ms |  24.57 ms |      295% |
| uFuzzy (all opts)         |   8.03 ms |    3.16 ms |  11.19 ms |      134% |
| _all libraries (geomean)_ |   1.17 ms |   16.57 ms |  27.90 ms |      334% |
<!-- bench:end -->

**The session batch** (one process: a warmup match, then every representative query once):

<!-- bench:batch-en -->
| Library                   |     build | first answer | session total | per query | per query rel |
|---------------------------|----------:|-------------:|--------------:|----------:|--------------:|
| **Ekrina**                |   0.23 ms |      8.55 ms |      48.14 ms |   1.64 ms |      **100%** |
| Ekrina (acronym)          |   0.26 ms |     10.24 ms |      49.60 ms |   1.63 ms |           99% |
| Ekrina (indexed)          |   6.63 ms |      4.47 ms |      40.84 ms |   1.24 ms |           76% |
| @nozbe/microfuzz          |  48.59 ms |     21.25 ms |     337.63 ms |  11.16 ms |          679% |
| fast-fuzzy                | 218.34 ms |     85.54 ms |    1199.20 ms |  37.30 ms |         2271% |
| Fuse.js (tuned)           |   4.93 ms |    102.14 ms |    2417.26 ms |  96.18 ms |         5856% |
| fuzzy                     |   0.03 ms |     15.72 ms |     329.25 ms |  13.06 ms |          795% |
| fuzzysort                 |   0.03 ms |     59.78 ms |     113.97 ms |   2.26 ms |          137% |
| match-sorter              |   0.03 ms |     31.19 ms |     465.11 ms |  18.08 ms |         1101% |
| uFuzzy (all opts)         |   8.03 ms |      4.38 ms |      62.46 ms |   2.09 ms |          127% |
| _all libraries (geomean)_ |   1.17 ms |     19.82 ms |     200.32 ms |   6.56 ms |          399% |
<!-- bench:end -->

### native corpus

<!-- bench:speed-native -->
| Library                   |    index | cold query |     total | total rel |
|---------------------------|---------:|-----------:|----------:|----------:|
| **Ekrina**                |  0.23 ms |    9.94 ms |  10.19 ms |  **100%** |
| Ekrina (acronym)          |  0.25 ms |    9.36 ms |   9.63 ms |       94% |
| Ekrina (indexed)          |  8.53 ms |    3.66 ms |  12.35 ms |      121% |
| @nozbe/microfuzz          | 51.83 ms |   18.51 ms |  70.90 ms |      696% |
| Fuse.js (tuned)           |  5.38 ms |  113.15 ms | 118.45 ms |     1163% |
| fuzzysort                 |  0.03 ms |   59.02 ms |  59.05 ms |      580% |
| match-sorter              |  0.03 ms |   28.07 ms |  28.10 ms |      276% |
| uFuzzy (all opts)         |  8.43 ms |    3.37 ms |  11.81 ms |      116% |
| _all libraries (geomean)_ |  1.02 ms |   15.85 ms |  25.85 ms |      254% |
<!-- bench:end -->

**The session batch** (one process: a warmup match, then every representative query once):

<!-- bench:batch-native -->
| Library                   |    build | first answer | session total | per query | per query rel |
|---------------------------|---------:|-------------:|--------------:|----------:|--------------:|
| **Ekrina**                |  0.23 ms |      9.75 ms |      56.79 ms |   1.96 ms |      **100%** |
| Ekrina (acronym)          |  0.25 ms |     11.84 ms |      59.27 ms |   1.97 ms |          101% |
| Ekrina (indexed)          |  8.53 ms |      4.98 ms |      47.88 ms |   1.43 ms |           73% |
| @nozbe/microfuzz          | 51.83 ms |     21.46 ms |     363.84 ms |  12.11 ms |          619% |
| Fuse.js (tuned)           |  5.38 ms |    114.78 ms |    2788.46 ms | 111.18 ms |         5682% |
| fuzzysort                 |  0.03 ms |     62.81 ms |     122.74 ms |   2.50 ms |          128% |
| match-sorter              |  0.03 ms |     33.01 ms |     527.89 ms |  20.62 ms |         1054% |
| uFuzzy (all opts)         |  8.43 ms |      4.45 ms |      68.28 ms |   2.31 ms |          118% |
| _all libraries (geomean)_ |  1.02 ms |     18.39 ms |     170.77 ms |   5.54 ms |          283% |
<!-- bench:end -->

Ekrina (acronym) runs strictly _more_ code per query than Ekrina on every timed query but the acronym probe `tfts`, so wherever its cells come in under Ekrina's on the others, the gap is load swing rather than speed.
`tfts` is the exception because Ekrina (acronym) matches it literally and never builds the whole-list mask index for it, where Ekrina does (the third case under the backend one-shot chart).
At 100k that query takes <!-- bench:{{ fixed(raw("coldMatrix", "native", "acronym", "100000", "ekrina (acronym)", "oneShotMs"), 2) }} -->9.48<!-- bench:end --> ms one-shot against Ekrina's <!-- bench:{{ fixed(raw("coldMatrix", "native", "acronym", "100000", "ekrina", "oneShotMs"), 2) }} -->15.74<!-- bench:end --> on native and <!-- bench:{{ fixed(raw("coldMatrix", "en", "acronym", "100000", "ekrina (acronym)", "oneShotMs"), 2) }} -->8.52<!-- bench:end --> against <!-- bench:{{ fixed(raw("coldMatrix", "en", "acronym", "100000", "ekrina", "oneShotMs"), 2) }} -->13.14<!-- bench:end --> on en, which is all of Ekrina (acronym)'s lead in the cold query and total columns<!-- bench:{{ assert(gt(oneShotWithout("en", 100000, "ekrina (acronym)", "acronym"), oneShotWithout("en", 100000, "ekrina", "acronym")), "without the acronym query Ekrina (acronym) has no en one-shot lead") }} --><!-- bench:end --><!-- bench:{{ assert(gt(oneShotWithout("native", 100000, "ekrina (acronym)", "acronym"), oneShotWithout("native", 100000, "ekrina", "acronym")), "without the acronym query Ekrina (acronym) has no native one-shot lead") }} --><!-- bench:end --><!-- bench:{{ assert(lt(n("speed-en", "Ekrina (acronym)", "total rel"), 100), "Ekrina (acronym) leads Ekrina's en one-shot") }} --><!-- bench:end --><!-- bench:{{ assert(lt(n("speed-native", "Ekrina (acronym)", "total rel"), 100), "Ekrina (acronym) leads Ekrina's native one-shot") }} --><!-- bench:end -->: over the other five queries it averages <!-- bench:{{ fixed(oneShotWithout("native", 100000, "ekrina (acronym)", "acronym"), 2) }} -->9.65<!-- bench:end --> ms to Ekrina's <!-- bench:{{ fixed(oneShotWithout("native", 100000, "ekrina", "acronym"), 2) }} -->9.08<!-- bench:end --> on native and <!-- bench:{{ fixed(oneShotWithout("en", 100000, "ekrina (acronym)", "acronym"), 2) }} -->7.78<!-- bench:end --> to <!-- bench:{{ fixed(oneShotWithout("en", 100000, "ekrina", "acronym"), 2) }} -->7.38<!-- bench:end --> on en.
Over the session the two are level (<!-- bench:{{ span(mul(min(div(n("batch-native", "Ekrina (acronym)", "session total"), n("batch-native", "Ekrina", "session total")), div(n("batch-en", "Ekrina (acronym)", "session total"), n("batch-en", "Ekrina", "session total"))), 100), mul(max(div(n("batch-native", "Ekrina (acronym)", "session total"), n("batch-native", "Ekrina", "session total")), div(n("batch-en", "Ekrina (acronym)", "session total"), n("batch-en", "Ekrina", "session total"))), 100), 0, "%") }} -->103–104%<!-- bench:end -->)<!-- bench:{{ assert(lt(mul(max(div(n("batch-native", "Ekrina (acronym)", "session total"), n("batch-native", "Ekrina", "session total")), div(n("batch-en", "Ekrina (acronym)", "session total"), n("batch-en", "Ekrina", "session total"))), 100), 114.99999999999999), "Ekrina (acronym)'s session is inside the tie band of Ekrina's") }} --><!-- bench:end -->, since an earlier query has built the index by the time `tfts` runs.
Read sub-<!-- bench:{{ constant("15%") }} -->15%<!-- bench:end --> differences as statistical ties, the tie band from here on, and larger ones as real.

Configurations that can't fold diacritics are omitted rather than flagged.
A non-folding row on this corpus is timing a different, easier task (it silently misses accented matches), and we already _know_ it fails: on the accent probe `lopez` (from "Pedro Alonso López") at 10k, base uFuzzy finds _<!-- bench:{{ probeCount("native", "lopez", "uFuzzy") }} -->0<!-- bench:end -->_ matches where its folding (all opts) config finds <!-- bench:{{ probeCount("native", "lopez", "uFuzzy (all opts)") }} -->6<!-- bench:end --> and Ekrina <!-- bench:{{ probeCount("native", "lopez", "ekrina") }} -->7<!-- bench:end --> ([`bench/hits.test.ts`](../bench/hits.test.ts)).
Omitted: fast-fuzzy and fuzzy, which have no folding option at all, and the base rows of uFuzzy and Fuse.js.

### emoji corpus, unranked

The whole 1,923-item list, timed the same way as the other two corpora but at its own length.
That is too short to rank speed on, so these rows have no geomean and stay out of the scorecard, the Pareto charts and the library pages.

<!-- bench:speed-emoji -->
| Library           |    index | cold query |    total | total rel |
|-------------------|---------:|-----------:|---------:|----------:|
| **Ekrina**        |  0.17 ms |    3.41 ms |  3.57 ms |  **100%** |
| Ekrina (acronym)  |  0.18 ms |    4.03 ms |  4.21 ms |      118% |
| Ekrina (indexed)  |  1.28 ms |    2.22 ms |  3.52 ms |       98% |
| @nozbe/microfuzz  |  2.00 ms |    0.85 ms |  2.86 ms |       80% |
| fast-fuzzy        | 12.31 ms |   11.19 ms | 23.49 ms |      658% |
| Fuse.js (tuned)   |  0.74 ms |    5.56 ms |  6.32 ms |      177% |
| fuzzy             |  0.03 ms |    1.22 ms |  1.25 ms |       35% |
| fuzzysort         |  0.03 ms |    3.06 ms |  3.09 ms |       87% |
| match-sorter      |  0.03 ms |    5.13 ms |  5.16 ms |      145% |
| uFuzzy (all opts) |  4.11 ms |    1.18 ms |  5.28 ms |      148% |
<!-- bench:end -->

**The session batch** (one process: a warmup match, then every representative query once):

<!-- bench:batch-emoji -->
| Library           |    build | first answer | session total | per query | per query rel |
|-------------------|---------:|-------------:|--------------:|----------:|--------------:|
| **Ekrina**        |  0.17 ms |      5.02 ms |      18.76 ms |   0.57 ms |      **100%** |
| Ekrina (acronym)  |  0.18 ms |      6.33 ms |      20.46 ms |   0.58 ms |          103% |
| Ekrina (indexed)  |  1.28 ms |      3.59 ms |      18.20 ms |   0.55 ms |           98% |
| @nozbe/microfuzz  |  2.00 ms |      0.80 ms |      15.75 ms |   0.54 ms |           95% |
| fast-fuzzy        | 12.31 ms |     10.53 ms |     116.51 ms |   3.90 ms |          689% |
| Fuse.js (tuned)   |  0.74 ms |      6.15 ms |      93.30 ms |   3.60 ms |          637% |
| fuzzy             |  0.03 ms |      1.29 ms |      18.78 ms |   0.73 ms |          129% |
| fuzzysort         |  0.03 ms |      3.33 ms |       8.67 ms |   0.22 ms |           39% |
| match-sorter      |  0.03 ms |      6.33 ms |      48.46 ms |   1.75 ms |          310% |
| uFuzzy (all opts) |  4.11 ms |      1.13 ms |      20.27 ms |   0.63 ms |          111% |
<!-- bench:end -->

At this length Ekrina is not the fastest<!-- bench:{{ assert(lt(raw("coldMatrix", "emoji", "batch", "1923", "fuzzysort", "restMs"), raw("coldMatrix", "emoji", "batch", "1923", "ekrina", "restMs")), "fuzzysort answers emoji queries faster than Ekrina") }} --><!-- bench:end -->: per query, fuzzysort answers in <!-- bench:{{ cell("batch-emoji", "fuzzysort", "per query") }} -->0.22 ms<!-- bench:end --> against Ekrina's <!-- bench:{{ fixed(n("batch-emoji", "Ekrina", "per query"), 2) }} -->0.57<!-- bench:end -->, @nozbe/microfuzz (<!-- bench:{{ cell("batch-emoji", "@nozbe/microfuzz", "per query") }} -->0.54 ms<!-- bench:end -->) and uFuzzy (all opts) (<!-- bench:{{ cell("batch-emoji", "uFuzzy (all opts)", "per query") }} -->0.63 ms<!-- bench:end -->) are level with it inside the tie band<!-- bench:{{ assert(within(raw("coldMatrix", "emoji", "batch", "1923", "@nozbe/microfuzz", "restMs"), raw("coldMatrix", "emoji", "batch", "1923", "ekrina", "restMs"), 0.15), "@nozbe/microfuzz is level with Ekrina per emoji query") }} --><!-- bench:end --><!-- bench:{{ assert(within(raw("coldMatrix", "emoji", "batch", "1923", "uFuzzy (all opts)", "restMs"), raw("coldMatrix", "emoji", "batch", "1923", "ekrina", "restMs"), 0.15), "uFuzzy (all opts) is level with Ekrina per emoji query") }} --><!-- bench:end -->, and fast-fuzzy (<!-- bench:{{ cell("batch-emoji", "fast-fuzzy", "per query") }} -->3.90 ms<!-- bench:end -->) and Fuse.js (tuned) (<!-- bench:{{ cell("batch-emoji", "Fuse.js (tuned)", "per query") }} -->3.60 ms<!-- bench:end -->) take <!-- bench:{{ times(div(raw("coldMatrix", "emoji", "batch", "1923", "fast-fuzzy", "restMs"), raw("coldMatrix", "emoji", "batch", "1923", "ekrina", "restMs")), 1) }} -->6.9×<!-- bench:end --> and <!-- bench:{{ times(div(raw("coldMatrix", "emoji", "batch", "1923", "fuse.js (tuned)", "restMs"), raw("coldMatrix", "emoji", "batch", "1923", "ekrina", "restMs")), 1) }} -->6.4×<!-- bench:end --> as long.
Over the whole session, constructor and warm-up included, fuzzysort, @nozbe/microfuzz and uFuzzy (all opts) take <!-- bench:{{ pct(div(n("batch-emoji", "fuzzysort", "session total"), n("batch-emoji", "Ekrina", "session total"))) }} -->46%<!-- bench:end -->, <!-- bench:{{ pct(div(n("batch-emoji", "@nozbe/microfuzz", "session total"), n("batch-emoji", "Ekrina", "session total"))) }} -->84%<!-- bench:end --> and <!-- bench:{{ pct(div(n("batch-emoji", "uFuzzy (all opts)", "session total"), n("batch-emoji", "Ekrina", "session total"))) }} -->108%<!-- bench:end --> of Ekrina's, and for one answer from a fresh list bare `fuzzy` takes <!-- bench:{{ cell("speed-emoji", "fuzzy", "total rel") }} -->35%<!-- bench:end --> of Ekrina's one-shot (<!-- bench:{{ cell("speed-emoji", "fuzzy", "total") }} -->1.25 ms<!-- bench:end --> against <!-- bench:{{ fixed(n("speed-emoji", "Ekrina", "total"), 2) }} -->3.57<!-- bench:end -->).

### Reading the speed numbers

Every cell is process-cold, so read the columns as three different workloads.
The **batch** column is the headline: one process, 24 distinct queries, so it shows whether the amortisation each design promises actually happens.
Ekrina's batch is carried by its architecture, a staged reject path (a per-item union of char-class bitmasks, then a gate chosen by query type, an `indexOf` subsequence scan for one word and a presence regex for several) cuts most items before any tier is tried, and the lazy preparation happens once per session: each item's text the first time it matches, and the mask index on the first multi-word query or the first that reaches the rescue.
_Ekrina (indexed) runs the fastest session at 100k among the configurations above 0.5 MRR_<!-- bench:{{ assert(gt(lowest("scorecard-native+scorecard-en", "Ekrina+Ekrina (acronym)+fast-fuzzy+Fuse.js (tuned)+uFuzzy (all opts)", "MRR"), 0.5), "the rows compared score above 0.5 MRR") }} --><!-- bench:end --><!-- bench:{{ assert(lt(highest("scorecard-native+scorecard-en", "@nozbe/microfuzz+fuzzysort+match-sorter+fuzzy", "MRR"), 0.5), "the rows left out score under 0.5 MRR") }} --><!-- bench:end --><!-- bench:{{ assert(lt(n("batch-en", "Ekrina (indexed)", "session total"), lowest("batch-en", "Ekrina+Ekrina (acronym)+fast-fuzzy+Fuse.js (tuned)+uFuzzy (all opts)", "session total")), "Ekrina (indexed) runs the fastest en session above 0.5 MRR") }} --><!-- bench:end --><!-- bench:{{ assert(lt(n("batch-native", "Ekrina (indexed)", "session total"), lowest("batch-native", "Ekrina+Ekrina (acronym)+Fuse.js (tuned)+uFuzzy (all opts)", "session total")), "Ekrina (indexed) runs the fastest native session above 0.5 MRR") }} --><!-- bench:end -->: <!-- bench:{{ pct(div(n("batch-en", "Ekrina (indexed)", "session total"), n("batch-en", "Ekrina", "session total"))) }} -->85%<!-- bench:end --> of Ekrina's time on en and <!-- bench:{{ pct(div(n("batch-native", "Ekrina (indexed)", "session total"), n("batch-native", "Ekrina", "session total"))) }} -->84%<!-- bench:end --> on native.
Folding uFuzzy, at <!-- bench:{{ span(lowest("scorecard-native+scorecard-en", "uFuzzy (all opts)", "MRR"), highest("scorecard-native+scorecard-en", "uFuzzy (all opts)", "MRR"), 2) }} -->0.66<!-- bench:end --> MRR to Ekrina's <!-- bench:{{ span(lowest("scorecard-native+scorecard-en", "Ekrina", "MRR"), highest("scorecard-native+scorecard-en", "Ekrina", "MRR"), 2) }} -->0.91–0.92<!-- bench:end -->, takes longer than Ekrina over the session once its constructor counts<!-- bench:{{ assert(gt(mul(min(div(n("batch-native", "uFuzzy (all opts)", "session total"), n("batch-native", "Ekrina", "session total")), div(n("batch-en", "uFuzzy (all opts)", "session total"), n("batch-en", "Ekrina", "session total"))), 100), 115), "folding uFuzzy's session is outside the tie band of Ekrina's") }} --><!-- bench:end -->, at <!-- bench:{{ pct(div(n("batch-en", "uFuzzy (all opts)", "session total"), n("batch-en", "Ekrina", "session total"))) }} -->130%<!-- bench:end --> of its time on en and <!-- bench:{{ pct(div(n("batch-native", "uFuzzy (all opts)", "session total"), n("batch-native", "Ekrina", "session total"))) }} -->120%<!-- bench:end --> on native.
Bare uFuzzy, which can't fold and so is shown on en only, takes <!-- bench:{{ pct(div(n("library-ufuzzy-batch-en", "uFuzzy", "session total"), n("library-ufuzzy-batch-en", "Ekrina", "session total"))) }} -->89%<!-- bench:end --> of Ekrina's time (on [its page](./libraries/ufuzzy.md#speed-at-100k)), level with Ekrina (indexed)<!-- bench:{{ assert(within(raw("coldMatrix", "en", "batch", "100000", "uFuzzy", "queryMs"), raw("coldMatrix", "en", "batch", "100000", "ekrina (indexed)", "queryMs"), 0.15), "bare uFuzzy's en batch is level with Ekrina (indexed)'s") }} --><!-- bench:end -->, at <!-- bench:{{ cell("library-ufuzzy-scorecard-en", "uFuzzy", "MRR") }} -->0.21<!-- bench:end --> MRR.
Ekrina's batch runs ~<!-- bench:{{ span(min(div(raw("coldMatrix", "native", "batch", "100000", "@nozbe/microfuzz", "queryMs"), raw("coldMatrix", "native", "batch", "100000", "ekrina", "queryMs")), div(raw("coldMatrix", "en", "batch", "100000", "@nozbe/microfuzz", "queryMs"), raw("coldMatrix", "en", "batch", "100000", "ekrina", "queryMs"))), max(div(raw("coldMatrix", "native", "batch", "100000", "@nozbe/microfuzz", "queryMs"), raw("coldMatrix", "native", "batch", "100000", "ekrina", "queryMs")), div(raw("coldMatrix", "en", "batch", "100000", "@nozbe/microfuzz", "queryMs"), raw("coldMatrix", "en", "batch", "100000", "ekrina", "queryMs"))), 1, "×") }} -->5.5–6.0×<!-- bench:end --> faster than microfuzz's, ~<!-- bench:{{ span(min(div(raw("coldMatrix", "native", "batch", "100000", "fuzzysort", "queryMs"), raw("coldMatrix", "native", "batch", "100000", "ekrina", "queryMs")), div(raw("coldMatrix", "en", "batch", "100000", "fuzzysort", "queryMs"), raw("coldMatrix", "en", "batch", "100000", "ekrina", "queryMs"))), max(div(raw("coldMatrix", "native", "batch", "100000", "fuzzysort", "queryMs"), raw("coldMatrix", "native", "batch", "100000", "ekrina", "queryMs")), div(raw("coldMatrix", "en", "batch", "100000", "fuzzysort", "queryMs"), raw("coldMatrix", "en", "batch", "100000", "ekrina", "queryMs"))), 1, "×") }} -->2.2–2.4×<!-- bench:end --> fuzzysort's, ~<!-- bench:{{ span(min(div(raw("coldMatrix", "native", "batch", "100000", "match-sorter", "queryMs"), raw("coldMatrix", "native", "batch", "100000", "ekrina", "queryMs")), div(raw("coldMatrix", "en", "batch", "100000", "match-sorter", "queryMs"), raw("coldMatrix", "en", "batch", "100000", "ekrina", "queryMs"))), max(div(raw("coldMatrix", "native", "batch", "100000", "match-sorter", "queryMs"), raw("coldMatrix", "native", "batch", "100000", "ekrina", "queryMs")), div(raw("coldMatrix", "en", "batch", "100000", "match-sorter", "queryMs"), raw("coldMatrix", "en", "batch", "100000", "ekrina", "queryMs"))), 0, "×") }} -->9–10×<!-- bench:end --> match-sorter's and ~<!-- bench:{{ span(min(div(raw("coldMatrix", "native", "batch", "100000", "fuse.js (tuned)", "queryMs"), raw("coldMatrix", "native", "batch", "100000", "ekrina", "queryMs")), div(raw("coldMatrix", "en", "batch", "100000", "fuse.js (tuned)", "queryMs"), raw("coldMatrix", "en", "batch", "100000", "ekrina", "queryMs"))), max(div(raw("coldMatrix", "native", "batch", "100000", "fuse.js (tuned)", "queryMs"), raw("coldMatrix", "native", "batch", "100000", "ekrina", "queryMs")), div(raw("coldMatrix", "en", "batch", "100000", "fuse.js (tuned)", "queryMs"), raw("coldMatrix", "en", "batch", "100000", "ekrina", "queryMs"))), 0, "×") }} -->49–50×<!-- bench:end --> Fuse.js (tuned)'s, and ~<!-- bench:{{ times(div(raw("coldMatrix", "en", "batch", "100000", "fast-fuzzy", "queryMs"), raw("coldMatrix", "en", "batch", "100000", "ekrina", "queryMs")), 0) }} -->20×<!-- bench:end --> faster than fast-fuzzy's on en, the corpus it is timed on since it can't fold.
The **cold query** column is where Ekrina's laziness shows up: <!-- bench:{{ span(lowest("speed-en+speed-native", "Ekrina", "cold query"), highest("speed-en+speed-native", "Ekrina", "cold query"), 0) }} -->8–10<!-- bench:end --> ms mean at 100k (en, native), most of it the rescue's union-and-bigram mask build (Ekrina (indexed), which builds it in its <!-- bench:{{ span(lowest("speed-en+speed-native", "Ekrina (indexed)", "index"), highest("speed-en+speed-native", "Ekrina (indexed)", "index"), 0) }} -->7–9<!-- bench:end --> ms constructor, answers first in <!-- bench:{{ span(lowest("speed-en+speed-native", "Ekrina (indexed)", "cold query"), highest("speed-en+speed-native", "Ekrina (indexed)", "cold query"), 1) }} -->3.4–3.7<!-- bench:end --> ms), done once per searcher and visible per query in the cells of [`bench/results.json`](../bench/results.json).
An eager-index engine does that work up front instead: fast-fuzzy's constructor runs for <!-- bench:{{ span(min(n("speed-en", "fast-fuzzy", "index"), n("build", "100k", "fast-fuzzy")), max(n("speed-en", "fast-fuzzy", "index"), n("build", "100k", "fast-fuzzy")), 0) }} -->218–323<!-- bench:end --> ms before its first answer.
The **index** column plus the first answer is the one-shot measurement: at 100k Ekrina takes it from uFuzzy (all opts) on both corpora<!-- bench:{{ assert(gt(lowest("speed-en+speed-native", "uFuzzy (all opts)", "total rel"), 100), "Ekrina's 100k one-shot beats uFuzzy (all opts) on both corpora") }} --><!-- bench:end -->, <!-- bench:{{ cell("speed-en", "Ekrina", "total") }} -->8.34 ms<!-- bench:end --> against <!-- bench:{{ fixed(n("speed-en", "uFuzzy (all opts)", "total"), 2) }} -->11.19<!-- bench:end --> on en and <!-- bench:{{ fixed(n("speed-native", "Ekrina", "total"), 2) }} -->10.19<!-- bench:end --> against <!-- bench:{{ fixed(n("speed-native", "uFuzzy (all opts)", "total"), 2) }} -->11.81<!-- bench:end --> on native (<!-- bench:{{ cell("speed-native", "uFuzzy (all opts)", "total rel") }} -->116%<!-- bench:end -->), even though Ekrina's first answer carries the mask build.
Cross-_type_ speed isn't apples-to-apples: **typo-tolerant** libs (Fuse.js, fast-fuzzy) do far more work per query, and non-folding configurations are omitted from the native table entirely (they would be timing a different task).
Results are identical in any script, but the mask index cannot tell non-Latin letters apart, so on non-Latin text a keystroke that scans the whole list scores every item in it, though an extending keystroke still rescans only the items the last one let through (`bench/non-latin.test.ts`, over a Cyrillic copy of the corpus).

## Typing `hinton` at 100k

While typing, each query extends the last.
Ekrina's prefix-narrowing cache rescans only the previous query's mask-gate survivors, so successive keystrokes get faster<!-- bench:{{ assert(gt(min(sub(n("session", "Ekrina", "`hin`"), n("session", "Ekrina", "`hint`")), sub(n("session", "Ekrina", "`hint`"), n("session", "Ekrina", "`hinto`"))), 0), "each Ekrina keystroke is faster than the one before") }} --><!-- bench:end -->.
Every other library scans the whole list per keystroke; fuzzysort's later keystrokes are cheaper only because its first one prepared every target.
The probe types the short-word query `hinton` from the 3-character UI gate onward (real UIs gate search behind 2–3 characters, because a 1–2 char query matches a huge fraction of the corpus and every rich-result library has to materialise it).
Each sample is a fresh process on the 100k native corpus that builds the searcher, answers five other queries so the library's code is already compiled, then types `hin`, `hint` and `hinto` once each, in order, as a user does; each step's cell is the median of seven such processes, and **session** is the sum of the three.
A keystroke runs once per process because repeating one query in a process lets V8 reuse the regexes it compiled for it, which a user's next keystroke never can.

<!-- bench:session -->
| Library            | `hin` | `hint` | `hinto` | session |
|--------------------|------:|-------:|--------:|--------:|
| Ekrina             |  4.02 |   1.28 |    0.25 |    5.55 |
| @nozbe/microfuzz   | 14.87 |  12.84 |   12.18 |   39.88 |
| fuzzysort          |  8.90 |   3.51 |    2.64 |   15.06 |
| uFuzzy (all opts)  |  5.50 |   1.86 |    2.33 |    9.70 |
| Fuse.js (all opts) | 90.14 | 119.52 |  125.13 |  334.79 |
<!-- bench:end -->

Ekrina's per-keystroke time falls _<!-- bench:{{ times(div(sessionMs("ekrina", "hin"), sessionMs("ekrina", "hinto")), 1) }} -->16.0×<!-- bench:end -->_ across the word (<!-- bench:{{ fixed(n("session", "Ekrina", "`hin`"), 2) }} -->4.02<!-- bench:end --> → <!-- bench:{{ cell("session", "Ekrina", "`hint`") }} -->1.28<!-- bench:end --> → <!-- bench:{{ cell("session", "Ekrina", "`hinto`") }} -->0.25<!-- bench:end -->) as the survivor cache narrows: the 3-character query is the widest candidate set the session ever sees, and it is the one that does the work.
Ekrina answers every keystroke faster than uFuzzy (all opts)<!-- bench:{{ assert(gt(min(sub(n("session", "uFuzzy (all opts)", "`hin`"), n("session", "Ekrina", "`hin`")), sub(n("session", "uFuzzy (all opts)", "`hint`"), n("session", "Ekrina", "`hint`")), sub(n("session", "uFuzzy (all opts)", "`hinto`"), n("session", "Ekrina", "`hinto`"))), 0), "Ekrina answers every keystroke faster than uFuzzy (all opts)") }} --><!-- bench:end -->, the wide opener included (<!-- bench:{{ fixed(n("session", "Ekrina", "`hin`"), 2) }} -->4.02<!-- bench:end --> against <!-- bench:{{ fixed(n("session", "uFuzzy (all opts)", "`hin`"), 2) }} -->5.50<!-- bench:end -->), and takes the session total by <!-- bench:{{ times(div(sessionMs("uFuzzy (all opts)", "session"), sessionMs("ekrina", "session")), 1) }} -->1.7×<!-- bench:end --> (<!-- bench:{{ fixed(n("session", "Ekrina", "session"), 2) }} -->5.55<!-- bench:end --> vs <!-- bench:{{ fixed(n("session", "uFuzzy (all opts)", "session"), 2) }} -->9.70<!-- bench:end -->), against uFuzzy (all opts) at <!-- bench:{{ cell("scorecard-native", "uFuzzy (all opts)", "MRR") }} -->0.66<!-- bench:end --> MRR to Ekrina's <!-- bench:{{ cell("scorecard-native", "Ekrina", "MRR") }} -->0.91<!-- bench:end -->.
microfuzz stays at ~<!-- bench:{{ span(lowest("session", "@nozbe/microfuzz", "`hin`+`hint`+`hinto`"), highest("session", "@nozbe/microfuzz", "`hin`+`hint`+`hinto`"), 0) }} -->12–15<!-- bench:end --> ms: same subsequence approach with no survivor cache, so nothing narrows between keystrokes.
Every row has already answered five queries before the first keystroke, so one-time work (Ekrina's mask build, fuzzysort's lazy target prep) is done by then; the cold cells above measure it.
Measured by [`bench/session.test.ts`](../bench/session.test.ts).

## Matching inside long text

Everything above matches short labels in a list; the other workload is `fuzzyMatch` over one large string, a document.
The hazard there is the fuzzy tier assembling a "match" from characters scattered across unrelated words, so the tier rejects any assembly covering less than <!-- bench:{{ constant("18%") }} -->18%<!-- bench:end --> of the span it stretches across (`DENSITY_FLOOR` in [`src/fuzzy.ts`](../src/fuzzy.ts)).
The constant was set on the bench's earlier synthetic corpora, where junk chains maxed out at 0.143 density and the sparsest genuine match measured 0.211.
On real text a few junk chains clear the floor, such as `mueller` across "**M**arc O**uelle**t Gensle**r**" and `andchat` across "**and** the **Cho**col**at**", where others are arguably real sparse matches (`khaj` on "**K**au**haj**").

The probe: the document is the native corpus joined with spaces and sliced to graded lengths; queries are 200 real corpus words verified absent from the largest slice (no substring anywhere).
A hit is then either the fuzzy tier assembling a chain (**fuzzy junk**) or the typo rescue correcting the word to a neighbouring one, such as `monster` to "Monterrey" (**corrected**), and the two are counted apart.

<!-- bench:longtext -->
| doc chars | fuzzy junk | corrected | present hits | miss ms |
|----------:|-----------:|----------:|-------------:|--------:|
|        64 |       0.0% |      0.0% |          7/7 |   0.003 |
|       128 |       0.0% |      0.0% |        14/14 |   0.003 |
|       256 |       0.5% |      0.0% |        20/20 |   0.008 |
|       512 |       1.0% |      0.5% |        20/20 |   0.019 |
|      1024 |       1.0% |      1.0% |        20/20 |   0.024 |
|      2048 |       1.0% |      0.5% |        20/20 |   0.045 |
|      4096 |       1.0% |      2.0% |        20/20 |   0.087 |
|      8192 |       1.0% |      2.5% |        20/20 |   0.176 |
|     16384 |       1.0% |      3.5% |        20/20 |   0.353 |
<!-- bench:end -->

The fuzzy tier junk-matches none of the absent words up to 128 characters<!-- bench:{{ assert(lt(highest("longtext", "64+128", "fuzzy junk"), 0.05), "no fuzzy junk up to 128 characters") }} --><!-- bench:end -->, <!-- bench:{{ cell("longtext", "256", "fuzzy junk") }} -->0.5%<!-- bench:end --> at 256 and <!-- bench:{{ pct(div(highest("longtext", "512+1024+2048+4096+8192+16384", "fuzzy junk"), 100)) }} -->1%<!-- bench:end --> from 512 up<!-- bench:{{ assert(within(lowest("longtext", "512+1024+2048+4096+8192+16384", "fuzzy junk"), highest("longtext", "512+1024+2048+4096+8192+16384", "fuzzy junk"), 0), "fuzzy junk is flat from 512 characters up") }} --><!-- bench:end -->; every genuinely present word still matches (a present word is a substring, so `contains` needs no fuzzy assembly).
Corrections rise with length<!-- bench:{{ assert(gt(n("longtext", "16384", "corrected"), n("longtext", "512", "corrected")), "corrections rise with document length") }} --><!-- bench:end --> to <!-- bench:{{ cell("longtext", "16384", "corrected") }} -->3.5%<!-- bench:end --> at 16k, since a longer document holds more words within a correction of any given query.
The rates move with the words drawn: a draw of 400 absent words, run the same way but not part of `results.json`, measured fuzzy junk at <!-- bench:{{ unsourced("0.8%", "400-word longtext draw, 2026-11-08") }} -->0.8%<!-- bench:end --> on native and <!-- bench:{{ unsourced("1.0%", "400-word longtext draw, 2026-11-08") }} -->1.0%<!-- bench:end --> on en from 512 characters up, so read the table as about <!-- bench:{{ pct(div(highest("longtext", "512+1024+2048+4096+8192+16384", "fuzzy junk"), 100)) }} -->1%<!-- bench:end -->.
Miss time includes the typo rescue (a miss must fail it too), and it is <!-- bench:{{ fixed(n("longtext", "16384", "miss ms"), 2) }} -->0.35<!-- bench:end --> ms at 16k chars.
Literal-only matching, for callers that want no fuzzy assemblies or corrections at all, is a one-line `isLiteral` filter.
[`bench/longtext.test.ts`](../bench/longtext.test.ts) keeps this table as a regression guard, failing if either rate rises above <!-- bench:{{ constant("5%") }} -->5%<!-- bench:end -->.

## The recommendation

The recommendation is to _pick Ekrina for list matching_, with two carve-outs the data supports.

- **Quality**: Ekrina tops the scorecard on all three corpora<!-- bench:{{ assert(lt(highest("scorecard-native+scorecard-en+scorecard-emoji", "fast-fuzzy+Fuse.js (tuned)+uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy", "MRR"), lowest("scorecard-native+scorecard-en+scorecard-emoji", "Ekrina", "MRR")), "Ekrina scores the highest MRR on every corpus") }} --><!-- bench:end --> (<!-- bench:{{ cell("scorecard-en", "Ekrina", "MRR") }} -->0.92<!-- bench:end --> en, <!-- bench:{{ cell("scorecard-native", "Ekrina", "MRR") }} -->0.91<!-- bench:end --> native and emoji)<!-- bench:{{ assert(within(n("scorecard-native", "Ekrina", "MRR"), n("scorecard-emoji", "Ekrina", "MRR"), 0), "Ekrina scores the same MRR on native and emoji") }} --><!-- bench:end --> and answers none of the queries nothing answers; the nearest rows, fast-fuzzy (<!-- bench:{{ span(lowest("scorecard-native+scorecard-en+scorecard-emoji", "fast-fuzzy", "MRR"), highest("scorecard-native+scorecard-en+scorecard-emoji", "fast-fuzzy", "MRR"), 2) }} -->0.80–0.84<!-- bench:end -->) and Fuse.js (tuned) (<!-- bench:{{ span(lowest("scorecard-native+scorecard-en+scorecard-emoji", "Fuse.js (tuned)", "MRR"), highest("scorecard-native+scorecard-en+scorecard-emoji", "Fuse.js (tuned)", "MRR"), 2) }} -->0.71–0.76<!-- bench:end -->), answer <!-- bench:{{ fractions(div(lowest("scorecard-native+scorecard-en+scorecard-emoji", "fast-fuzzy+Fuse.js (tuned)", "Junk"), 100), div(highest("scorecard-native+scorecard-en+scorecard-emoji", "fast-fuzzy+Fuse.js (tuned)", "Junk"), 100)) }} -->a quarter to a half<!-- bench:end --> of them.
- **Speed, measured cold**: Ekrina (indexed) runs the fastest 24-query session of the configurations at <!-- bench:{{ constant("0.70") }} -->0.70<!-- bench:end --> MRR or above<!-- bench:{{ assert(lt(highest("scorecard-native", "uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy", "MRR"), 0.7), "only Ekrina, fast-fuzzy and Fuse.js (tuned) score 0.70 MRR or above") }} --><!-- bench:end --><!-- bench:{{ assert(lt(n("scorecard-native", "Ekrina (indexed)", "session ms"), lowest("scorecard-native", "Ekrina+Ekrina (acronym)+fast-fuzzy+Fuse.js (tuned)", "session ms")), "Ekrina (indexed) runs the fastest native 10k session at 0.70 MRR or above") }} --><!-- bench:end --> (<!-- bench:{{ cell("scorecard-native", "Ekrina (indexed)", "session ms") }} -->13.34<!-- bench:end --> ms at native 10k) and the fastest per query after the warm-up<!-- bench:{{ assert(lt(raw("coldMatrix", "native", "batch", "10000", "ekrina (indexed)", "restMs"), min(raw("coldMatrix", "native", "batch", "10000", "ekrina", "restMs"), raw("coldMatrix", "native", "batch", "10000", "ekrina (acronym)", "restMs"))), "Ekrina (indexed) is the fastest Ekrina row per query") }} --><!-- bench:end --> (<!-- bench:{{ cell("scorecard-native", "Ekrina (indexed)", "per query") }} -->0.31<!-- bench:end --> ms, with Ekrina (acronym) inside the tie band<!-- bench:{{ assert(within(raw("coldMatrix", "native", "batch", "10000", "ekrina (acronym)", "restMs"), raw("coldMatrix", "native", "batch", "10000", "ekrina (indexed)", "restMs"), 0.15), "Ekrina (acronym) is inside the tie band of Ekrina (indexed) per query") }} --><!-- bench:end --> at <!-- bench:{{ cell("scorecard-native", "Ekrina (acronym)", "per query") }} -->0.32<!-- bench:end --> ms and Ekrina inside it too<!-- bench:{{ assert(within(raw("coldMatrix", "native", "batch", "10000", "ekrina", "restMs"), raw("coldMatrix", "native", "batch", "10000", "ekrina (indexed)", "restMs"), 0.15), "Ekrina is inside the tie band of Ekrina (indexed) per query") }} --><!-- bench:end --> at <!-- bench:{{ cell("scorecard-native", "Ekrina", "per query") }} -->0.32<!-- bench:end --> ms), and every Ekrina row runs that session in <!-- bench:{{ fractions(div(lowest("scorecard-native", "Ekrina+Ekrina (acronym)+Ekrina (indexed)", "session ms"), n("scorecard-native", "fast-fuzzy", "session ms")), div(highest("scorecard-native", "Ekrina+Ekrina (acronym)+Ekrina (indexed)", "session ms"), n("scorecard-native", "fast-fuzzy", "session ms"))) }} -->an eleventh to a tenth<!-- bench:end --> of fast-fuzzy's time (<!-- bench:{{ cell("scorecard-native", "fast-fuzzy", "session ms") }} -->148.57<!-- bench:end --> ms) and <!-- bench:{{ fractions(div(lowest("scorecard-native", "Ekrina+Ekrina (acronym)+Ekrina (indexed)", "session ms"), n("scorecard-native", "match-sorter", "session ms")), div(highest("scorecard-native", "Ekrina+Ekrina (acronym)+Ekrina (indexed)", "session ms"), n("scorecard-native", "match-sorter", "session ms"))) }} -->a quarter<!-- bench:end --> of match-sorter's (<!-- bench:{{ cell("scorecard-native", "match-sorter", "session ms") }} -->58.09<!-- bench:end --> ms), with a near-zero constructor, <!-- bench:ekrina-gzip -->~8.6 kB<!-- bench:end --> gzip and zero deps.
  The exception is the first call: Ekrina prepares lazily, so a fresh searcher's first answer prepares what it matches, and its first multi-word or rescue-bound query builds the mask index over the whole list (a first answer averages <!-- bench:{{ span(lowest("scorecard-native+scorecard-en", "Ekrina", "cold ms"), highest("scorecard-native+scorecard-en", "Ekrina", "cold ms"), 1) }} -->3.0–3.4<!-- bench:end --> ms at 10k and <!-- bench:{{ span(lowest("speed-en+speed-native", "Ekrina", "cold query"), highest("speed-en+speed-native", "Ekrina", "cold query"), 0) }} -->8–10<!-- bench:end --> ms at 100k across the timed queries, or <!-- bench:{{ span(lowest("scorecard-native+scorecard-en", "Ekrina (indexed)", "cold ms"), highest("scorecard-native+scorecard-en", "Ekrina (indexed)", "cold ms"), 1) }} -->1.8<!-- bench:end --> ms and <!-- bench:{{ span(lowest("speed-en+speed-native", "Ekrina (indexed)", "cold query"), highest("speed-en+speed-native", "Ekrina (indexed)", "cold query"), 1) }} -->3.4–3.7<!-- bench:end --> ms once Ekrina (indexed) has built the index up front); a workload that only ever asks one question of one searcher should read the one-shot numbers, where bare `fuzzy` is faster at 10k<!-- bench:{{ assert(gt(min(sub(oneShot("native", 10000, "ekrina"), oneShot("native", 10000, "fuzzy")), sub(oneShot("en", 10000, "ekrina"), oneShot("en", 10000, "fuzzy"))), 0), "bare fuzzy's 10k one-shot is faster than Ekrina's") }} --><!-- bench:end -->.
- **Long text**: the density floor holds `fuzzyMatch` junk to about <!-- bench:{{ pct(div(highest("longtext", "512+1024+2048+4096+8192+16384", "fuzzy junk"), 100)) }} -->1%<!-- bench:end --> at every measured document length, so the same engine covers documents as well as labels.

The carve-outs:

- **A query word the item lacks.** Ekrina requires every query word to match, so a query with an absent word returns nothing, where fast-fuzzy scores <!-- bench:{{ span(lowest("families-native+families-en+families-emoji", "an absent word added", "fast-fuzzy"), highest("families-native+families-en+families-emoji", "an absent word added", "fast-fuzzy"), 2) }} -->0.80–1.00<!-- bench:end --> on that family; an OR-style search needs a different engine or a query split.
- **Raw throughput when a bare index array is enough.** Bare uFuzzy runs the 10k en batch in <!-- bench:{{ pct(div(raw("coldMatrix", "en", "batch", "10000", "uFuzzy", "queryMs"), raw("coldMatrix", "en", "batch", "10000", "ekrina", "queryMs"))) }} -->40%<!-- bench:end --> of Ekrina's time and <!-- bench:{{ pct(div(raw("coldMatrix", "en", "batch", "10000", "uFuzzy", "queryMs"), raw("coldMatrix", "en", "batch", "10000", "ekrina (indexed)", "queryMs"))) }} -->51%<!-- bench:end --> of Ekrina (indexed)'s ([uFuzzy](./libraries/ufuzzy.md)), though at 100k it is level with Ekrina (indexed)<!-- bench:{{ assert(within(raw("coldMatrix", "en", "batch", "100000", "uFuzzy", "queryMs"), raw("coldMatrix", "en", "batch", "100000", "ekrina (indexed)", "queryMs"), 0.15), "bare uFuzzy's en 100k batch is level with Ekrina (indexed)'s") }} --><!-- bench:end --> (<!-- bench:{{ pct(div(raw("coldMatrix", "en", "batch", "100000", "uFuzzy", "queryMs"), raw("coldMatrix", "en", "batch", "100000", "ekrina (indexed)", "queryMs"))) }} -->114%<!-- bench:end -->), and folding uFuzzy is no faster than Ekrina (<!-- bench:{{ span(mul(min(div(raw("coldMatrix", "native", "batch", "10000", "uFuzzy (all opts)", "queryMs"), raw("coldMatrix", "native", "batch", "10000", "ekrina", "queryMs")), div(raw("coldMatrix", "native", "batch", "100000", "uFuzzy (all opts)", "queryMs"), raw("coldMatrix", "native", "batch", "100000", "ekrina", "queryMs")), div(raw("coldMatrix", "en", "batch", "10000", "uFuzzy (all opts)", "queryMs"), raw("coldMatrix", "en", "batch", "10000", "ekrina", "queryMs")), div(raw("coldMatrix", "en", "batch", "100000", "uFuzzy (all opts)", "queryMs"), raw("coldMatrix", "en", "batch", "100000", "ekrina", "queryMs"))), 100), mul(max(div(raw("coldMatrix", "native", "batch", "10000", "uFuzzy (all opts)", "queryMs"), raw("coldMatrix", "native", "batch", "10000", "ekrina", "queryMs")), div(raw("coldMatrix", "native", "batch", "100000", "uFuzzy (all opts)", "queryMs"), raw("coldMatrix", "native", "batch", "100000", "ekrina", "queryMs")), div(raw("coldMatrix", "en", "batch", "10000", "uFuzzy (all opts)", "queryMs"), raw("coldMatrix", "en", "batch", "10000", "ekrina", "queryMs")), div(raw("coldMatrix", "en", "batch", "100000", "uFuzzy (all opts)", "queryMs"), raw("coldMatrix", "en", "batch", "100000", "ekrina", "queryMs"))), 100), 0, "%") }} -->106–120%<!-- bench:end --> of its batch)<!-- bench:{{ assert(gt(min(div(raw("coldMatrix", "native", "batch", "10000", "uFuzzy (all opts)", "queryMs"), raw("coldMatrix", "native", "batch", "10000", "ekrina", "queryMs")), div(raw("coldMatrix", "native", "batch", "100000", "uFuzzy (all opts)", "queryMs"), raw("coldMatrix", "native", "batch", "100000", "ekrina", "queryMs")), div(raw("coldMatrix", "en", "batch", "10000", "uFuzzy (all opts)", "queryMs"), raw("coldMatrix", "en", "batch", "10000", "ekrina", "queryMs")), div(raw("coldMatrix", "en", "batch", "100000", "uFuzzy (all opts)", "queryMs"), raw("coldMatrix", "en", "batch", "100000", "ekrina", "queryMs"))), 1), "folding uFuzzy's batch is no faster than Ekrina's") }} --><!-- bench:end -->.
  Bare, it gives up most of the match quality to get there (<!-- bench:{{ cell("library-ufuzzy-scorecard-en", "uFuzzy", "MRR") }} -->0.21<!-- bench:end --> MRR against Ekrina's <!-- bench:{{ cell("scorecard-en", "Ekrina", "MRR") }} -->0.92<!-- bench:end -->); folded it scores <!-- bench:{{ cell("scorecard-en", "uFuzzy (all opts)", "MRR") }} -->0.66<!-- bench:end -->, losing the joined-phrase, first-letter and two-edit families outright, and it has no tiers or per-field config.

The rest of the field, library by library:

- **fast-fuzzy**: the strongest quality after Ekrina<!-- bench:{{ assert(gt(lowest("scorecard-native+scorecard-en+scorecard-emoji", "fast-fuzzy", "MRR"), highest("scorecard-native+scorecard-en+scorecard-emoji", "Fuse.js (tuned)+uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy", "MRR")), "fast-fuzzy scores the highest MRR after Ekrina on every corpus") }} --><!-- bench:end --> at <!-- bench:{{ span(lowest("scorecard-native+scorecard-en+scorecard-emoji", "fast-fuzzy", "MRR"), highest("scorecard-native+scorecard-en+scorecard-emoji", "fast-fuzzy", "MRR"), 2) }} -->0.80–0.84<!-- bench:end -->, but it answers <!-- bench:{{ fraction(div(mean(n("scorecard-native", "fast-fuzzy", "Junk"), n("scorecard-en", "fast-fuzzy", "Junk"), n("scorecard-emoji", "fast-fuzzy", "Junk")), 100)) }} -->a quarter<!-- bench:end --> of the queries nothing answers, scores <!-- bench:{{ span(lowest("families-native+families-en+families-emoji", "two words reversed", "fast-fuzzy"), highest("families-native+families-en+families-emoji", "two words reversed", "fast-fuzzy"), 2) }} -->0.07–0.23<!-- bench:end --> on reversed phrases and <!-- bench:{{ span(lowest("families-native+families-en+families-emoji", "two words half typed", "fast-fuzzy"), highest("families-native+families-en+families-emoji", "two words half typed", "fast-fuzzy"), 2) }} -->0.13–0.14<!-- bench:end --> on half-typed ones, and has the heaviest build (<!-- bench:{{ span(min(n("speed-en", "fast-fuzzy", "index"), n("build", "100k", "fast-fuzzy")), max(n("speed-en", "fast-fuzzy", "index"), n("build", "100k", "fast-fuzzy")), 0) }} -->218–323<!-- bench:end --> ms at 100k)<!-- bench:{{ assert(gt(n("build", "100k", "fast-fuzzy"), highest("build", "100k", "Ekrina+Ekrina (indexed)+@nozbe/microfuzz+Fuse.js+uFuzzy (all opts)")), "fast-fuzzy has the heaviest 100k build") }} --><!-- bench:end --><!-- bench:{{ assert(gt(n("build", "10k", "fast-fuzzy"), highest("build", "10k", "Ekrina+Ekrina (indexed)+@nozbe/microfuzz+Fuse.js+uFuzzy (all opts)")), "fast-fuzzy has the heaviest 10k build") }} --><!-- bench:end --> and the slowest queries after Fuse.js<!-- bench:{{ assert(lt(highest("scorecard-native", "Ekrina+Ekrina (acronym)+Ekrina (indexed)+uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy", "per query"), n("scorecard-native", "fast-fuzzy", "per query")), "fast-fuzzy is slower per query than every row but Fuse.js (tuned)") }} --><!-- bench:end --><!-- bench:{{ assert(lt(n("scorecard-native", "fast-fuzzy", "per query"), n("scorecard-native", "Fuse.js (tuned)", "per query")), "Fuse.js (tuned) is the slowest per query") }} --><!-- bench:end -->.
- **Fuse.js**: <!-- bench:{{ cell("scorecard-native", "Fuse.js (tuned)", "MRR") }} -->0.76<!-- bench:end --> tuned and <!-- bench:{{ cell("library-fuse-scorecard-native", "Fuse.js", "MRR") }} -->0.72<!-- bench:end --> on its defaults, at ~<!-- bench:{{ span(lowest("scorecard-native+scorecard-en", "Fuse.js (tuned)", "per query"), highest("scorecard-native+scorecard-en", "Fuse.js (tuned)", "per query"), 0) }} -->9–11<!-- bench:end --> ms per query, answering half of the queries nothing answers tuned<!-- bench:{{ assert(within(div(mean(n("scorecard-native", "Fuse.js (tuned)", "Junk"), n("scorecard-en", "Fuse.js (tuned)", "Junk")), 100), 0.5, 0.1), "Fuse.js (tuned) answers about half the Wikidata queries nothing answers") }} --><!-- bench:end --> and nearly all of them on its defaults<!-- bench:{{ assert(gt(lowest("library-fuse-scorecard-native+library-fuse-scorecard-en", "Fuse.js", "Junk"), 90), "Fuse.js's defaults answer nearly every query nothing answers") }} --><!-- bench:end -->.
- **@nozbe/microfuzz**: Ekrina's parent; same subsequence approach, ~<!-- bench:{{ span(min(div(raw("coldMatrix", "native", "batch", "100000", "@nozbe/microfuzz", "queryMs"), raw("coldMatrix", "native", "batch", "100000", "ekrina", "queryMs")), div(raw("coldMatrix", "en", "batch", "100000", "@nozbe/microfuzz", "queryMs"), raw("coldMatrix", "en", "batch", "100000", "ekrina", "queryMs"))), max(div(raw("coldMatrix", "native", "batch", "100000", "@nozbe/microfuzz", "queryMs"), raw("coldMatrix", "native", "batch", "100000", "ekrina", "queryMs")), div(raw("coldMatrix", "en", "batch", "100000", "@nozbe/microfuzz", "queryMs"), raw("coldMatrix", "en", "batch", "100000", "ekrina", "queryMs"))), 1, "×") }} -->5.5–6.0×<!-- bench:end --> the batch at 100k, no tier output, <!-- bench:{{ span(lowest("scorecard-native+scorecard-en+scorecard-emoji", "@nozbe/microfuzz", "MRR"), highest("scorecard-native+scorecard-en+scorecard-emoji", "@nozbe/microfuzz", "MRR"), 2) }} -->0.40–0.47<!-- bench:end --> MRR: on the Wikidata corpora it scores <!-- bench:{{ fixed(highest("families-native+families-en", "random letter+inserted neighbouring key+typo in each of two words+typo then a half-typed word+two words joined, with a typo", "@nozbe/microfuzz"), 2) }} -->0.05<!-- bench:end --> or less on the random-letter, inserted-key and two-word typo families.
- **fuzzysort**: the fastest per-query time after bare uFuzzy<!-- bench:{{ assert(lt(n("library-ufuzzy-scorecard-native", "uFuzzy", "per query"), n("scorecard-native", "fuzzysort", "per query")), "bare uFuzzy answers faster per query than fuzzysort") }} --><!-- bench:end --><!-- bench:{{ assert(lt(n("scorecard-native", "fuzzysort", "per query"), lowest("scorecard-native", "Ekrina+Ekrina (acronym)+Ekrina (indexed)+fast-fuzzy+Fuse.js (tuned)+uFuzzy (all opts)+@nozbe/microfuzz+match-sorter+fuzzy", "per query")), "fuzzysort answers fastest per query of the headline rows") }} --><!-- bench:end -->, but its prepare-all pass lands a ~<!-- bench:{{ span(lowest("scorecard-native+scorecard-en", "fuzzysort", "cold ms"), highest("scorecard-native+scorecard-en", "fuzzysort", "cold ms"), 0) }} -->6–7<!-- bench:end --> ms first call (<!-- bench:{{ span(lowest("speed-en+speed-native", "fuzzysort", "cold query"), highest("speed-en+speed-native", "fuzzysort", "cold query"), 0) }} -->57–59<!-- bench:end --> ms at 100k) that stock usage absorbs inside the first `go()`, and on the Wikidata corpora it scores <!-- bench:{{ fixed(highest("families-native+families-en", "neighbouring key+two neighbouring keys+random letter+inserted neighbouring key+swapped neighbours+stuck key+first letter wrong+typo in each of two words+typo then a half-typed word+two words joined, with a typo", "fuzzysort"), 2) }} -->0.10<!-- bench:end --> or less on every typo family but the dropped-letter ones, which stay a subsequence (<!-- bench:{{ span(lowest("scorecard-native+scorecard-en+scorecard-emoji", "fuzzysort", "MRR"), highest("scorecard-native+scorecard-en+scorecard-emoji", "fuzzysort", "MRR"), 2) }} -->0.45–0.52<!-- bench:end --> MRR).
- **match-sorter**: tiered ranking but no ranges and no multi-word; on the Wikidata corpora it reaches <!-- bench:{{ span(lowest("families-native+families-en", "acronym", "match-sorter"), highest("families-native+families-en", "acronym", "match-sorter"), 2) }} -->0.70–0.73<!-- bench:end --> on acronyms and <!-- bench:{{ span(lowest("families-native+families-en", "dropped letter+two dropped letters", "match-sorter"), highest("families-native+families-en", "dropped letter+two dropped letters", "match-sorter"), 2) }} -->0.91–1.00<!-- bench:end --> on the dropped-letter families but <!-- bench:{{ fixed(highest("families-native+families-en", "neighbouring key+two neighbouring keys+random letter+inserted neighbouring key+swapped neighbours+stuck key+first letter wrong+typo in each of two words+typo then a half-typed word+two words joined, with a typo", "match-sorter"), 2) }} -->0.10<!-- bench:end --> or less on the other typo families, <!-- bench:{{ span(lowest("scorecard-native+scorecard-en+scorecard-emoji", "match-sorter", "MRR"), highest("scorecard-native+scorecard-en+scorecard-emoji", "match-sorter", "MRR"), 2) }} -->0.38–0.45<!-- bench:end --> MRR at mid-pack speed.
- **fuzzy**: substring-only and order-sensitive; <!-- bench:{{ fixed(highest("families-native+families-en+families-emoji", "two words reversed", "fuzzy"), 2) }} -->0.10<!-- bench:end --> or less on reversed phrases, <!-- bench:{{ fixed(highest("families-native+families-en+families-emoji", "accents stripped+accents added", "fuzzy"), 2) }} -->0.13<!-- bench:end --> or less on the accent families, ranges only as a marked-up string (<!-- bench:{{ span(lowest("scorecard-native+scorecard-en+scorecard-emoji", "fuzzy", "MRR"), highest("scorecard-native+scorecard-en+scorecard-emoji", "fuzzy", "MRR"), 2) }} -->0.29–0.39<!-- bench:end --> MRR).
