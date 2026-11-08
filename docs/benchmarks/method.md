# How the benchmarks are measured

How every number in [the benchmarks](../benchmarks.md) is produced: the measurement model, the corpora and query families, the notes behind each table, and how to rerun it all.

## One measurement model

Every time cell in [the benchmarks](../benchmarks.md) comes from [`bench/run.ts`](../../bench/run.ts): a _fresh node process per sample_, so the JIT, every per-searcher cache, and every process-wide cache (fuzzysort's prepare pool) start empty by construction, nothing is reconstructed by arithmetic, and no harness state can leak between cells.
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
The previous harness sampled hundreds of repeats of one query, which tiered the JIT far past anything realistic and hid every first call inside an untimed calibration probe, [docs/measurement.md](../measurement.md) records the move.

Which column matters depends on workload: search-as-you-type → **per query** (and [the typing table](../benchmarks.md#typing-hinton-at-100k) for the keystroke chain); a page that builds a searcher and answers a handful of queries → **session total**; a backend one-shot over fresh data → **one-shot**; a first-keystroke latency budget over a prebuilt index → **cold query**.

## Timing method

Timing noise is one-sided (GC, scheduler, and thermal interruptions only ever _add_ time), so the median across processes rejects spikes; the per-cell minimum, the noise-free floor, stays in [`bench/results.json`](../../bench/results.json) but is never the headline, because best-of-N flatters.
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

## The corpora and the query families

Three corpora, benched separately, each a frozen JSON snapshot committed next to the bench, so runs do no generation work and the data cannot drift:

- **en**: the English labels of the best-known Wikidata entities, 100,000 items in a fixed mix of <!-- bench:{{ constant("35%") }} -->35%<!-- bench:end --> people, <!-- bench:{{ constant("20%") }} -->20%<!-- bench:end --> places, <!-- bench:{{ constant("20%") }} -->20%<!-- bench:end --> creative works, <!-- bench:{{ constant("15%") }} -->15%<!-- bench:end --> organisations and <!-- bench:{{ constant("10%") }} -->10%<!-- bench:end --> products and brands ("Pedro López", "Hinton St George", "Two for the Seesaw").
  <!-- bench:{{ unsourced("8.9%", "bench/corpus-en.json") }} -->8.9%<!-- bench:end --> of items carry a non-ASCII letter.
- **native**: the same items under the native name Wikidata records for them where it has one ("Москва", "孟晚舟", "Sånger från andra våningen"), and the English label otherwise: <!-- bench:{{ unsourced("20%", "bench/corpus-native.json") }} -->20%<!-- bench:end --> of items are non-ASCII and <!-- bench:{{ unsourced("10%", "bench/corpus-native.json") }} -->10%<!-- bench:end --> are in a non-Latin script.
- **emoji**: every emoji [emojibase-data](https://github.com/milesj/emojibase) names and tags, bar the regional indicators, written as a picker searches it, the label then the tags the label doesn't already say ("pretzel — convoluted, twisted"): 1,923 items, too few for the 10k and 100k timing cells, so it is ranked on quality only and timed, unranked, at its own length ([emoji corpus, unranked](../benchmarks.md#emoji-corpus-unranked)).

The categories are interleaved in a fixed pattern, so any prefix keeps the mix and the 10k list is the first 10,000 items of the 100k.
Wikidata is CC0; regenerating the two Wikidata corpora ([`bench/corpus-wikidata-gen.test.ts`](../../bench/corpus-wikidata-gen.test.ts), `GEN_WIKIDATA=1`) redraws items as well as queries, since Wikidata changes daily, and so changes every rank table here.
The emoji corpus regenerates from a pinned emojibase-data release checked against its SHA-256 ([`bench/corpus-emoji-gen.test.ts`](../../bench/corpus-emoji-gen.test.ts), `GEN_EMOJI=1`).

Each query runs against the same 10,000 items in every library (the whole 1,923 for emoji), and for each library the bench records:

- **Where it ranks a right answer.**
  A query's right answers are every item it could have meant ([Match quality, by query family](./families.md) says how they are decided), and the score is the rank of the first one.
  In most cases, a deep rank is effectively a miss, particularly in a UI, so a rank outside the top 10 counts as a miss.
  Scoring uses the mean reciprocal rank (average of `1/rank`), **MRR** from here on, a bounded score ranging from 0 to 1.
  A rank 1 match gets a score of 1, rank 2 gets 0.5, rank 5 gets 0.2 and rank 10 gets 0.1; a rank outside the top 10, like a miss, gets 0.
- **Whether it answers queries nothing answers.**
  The **junk** rate is the share of queries with no right answer anywhere in the list that a library returns anything for.
  It counts a query, not its rows, so a library that caps its result list gains nothing from the cap.
  The row counts behind it stay in [`bench/results.json`](../../bench/results.json) as a diagnostic.
- **The duration taken to run the query.**
  Times spread more than two orders of magnitude<!-- bench:{{ assert(gt(div(slowestBatchQuery("en", 100000, "lopez pexro"), fastestBatchQuery("en", 100000, "lopez pexro")), 100), "times on `lopez pexro` spread more than two orders of magnitude") }} --><!-- bench:end --> on the same query (<!-- bench:{{ fixed(fastestBatchQuery("en", 100000, "lopez pexro"), 2) }} -->0.49<!-- bench:end --> ms to <!-- bench:{{ fixed(slowestBatchQuery("en", 100000, "lopez pexro"), 0) }} -->187<!-- bench:end --> ms for `lopez pexro` in the en 100k batch, [`bench/results.json`](../../bench/results.json)), and search-as-you-type multiplies the spread: one query per keystroke, where half a millisecond is invisible and <!-- bench:{{ fixed(slowestBatchQuery("en", 100000, "lopez pexro"), 0) }} -->187<!-- bench:end --> ms blows the frame budget.

The rules that picked the query families ([`bench/catalogue.ts`](../../bench/catalogue.ts)):

- **Every query comes from how people mistype, not from any library's tiers.**
  Each family is a fixed rule for turning an item into a query, capped at a strength people actually reach: one or two edits in a word, a sound-alike spelling, a word half typed, two words reversed, a stray space.
  The real-misspelling family takes its misspellings from Wikipedia's list of common English misspellings, at a pinned revision ([`bench/misspellings.json`](../../bench/misspellings.json), CC BY-SA 4.0).
  The phonetic rules are written for English, so on names they fire only where a name happens to hold the pattern.
- **Each family samples ten queries** from a fixed shuffle of the whole list, so sources come from every position rather than the head, where a list-order tie-break would favour them.
  A query is kept only if at most three items could answer it: when dozens of items hold a word, any library that matches at all fills its top ten with right answers, and the query measures matching, not ranking.
  A corrupted query that is itself a corpus word is skipped, since it would be a correct query.
- **The headline weights were fixed before measuring**: typos <!-- bench:{{ constant("0.35") }} -->0.35<!-- bench:end -->, phonetic <!-- bench:{{ constant("0.25") }} -->0.25<!-- bench:end -->, partial words <!-- bench:{{ constant("0.15") }} -->0.15<!-- bench:end -->, query shape <!-- bench:{{ constant("0.15") }} -->0.15<!-- bench:end --> and noise <!-- bench:{{ constant("0.10") }} -->0.10<!-- bench:end -->.
  A library's MRR is the weighted mean of its group means, and the [families tables](./families.md) stay unweighted.
  Acronyms and plurals are reported but carry no weight, since both are behaviours one library was built around.
- **Queries nothing answers are probed at several distances**, so no library's edit budget decides where "unanswerable" starts: corpus words pushed three, four and five edits from every word in the list, random letters four edits from everything, and pairs of words each three edits away, twenty of each.

Separately from the sampled families, each corpus derives one representative query per probe kind, the query the speed tables time and the batch answers.
Each kind takes the first item, from a fixed start, that can carry it: two plain words, a long enough word, a word at most two items hold ([`bench/corpus.ts`](../../bench/corpus.ts)).
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

The en and emoji corpora derive the same kinds from their own items (`pedro lopez` and `slightly smiling` for the phrases); each query's rank and row count per library is in [`bench/results.json`](../../bench/results.json).
MRR covers 33 scored families and 330 queries on every corpus; with ten queries a family, a single family's MRR can swing by 0.3 between draws while the weighted headline moves by a few hundredths, so read headline differences of ±<!-- bench:{{ constant("0.02") }} -->0.02<!-- bench:end --> as ties and treat single family cells as indicative.

## Configurations

The specific opt-ins the "(all opts)" rows switch on, and where output formats differ:

- `Ekrina`: Typos 🟢 is the always-on typo rescue, reported as the `corrected` tier: up to two edits in a word, sparse words such as `hget` for "Huguette", a stray or missing space, a held key such as `twaaain`, and a four-letter swap such as `tahn` for "Than"
- `uFuzzy`: folds diacritics via `latinize()`, matches multi-word via `outOfOrder`, and runs its one-typo `SingleError` mode with all four edits, its closest config to Ekrina's typo rescue
- `Fuse.js`: returns `ranges` via `includeMatches`, folds diacritics via `ignoreDiacritics`, and matches multi-word via `useExtendedSearch`, which turns space-separated terms into an AND of fuzzy patterns in any order, the same result set Ekrina's multi-word tier returns.
  Fuse's other multi-word switch, `useTokenSearch`, defaults to OR (`tokenMatch: "any"`) and only reaches these semantics at `tokenMatch: "all"`
- `fast-fuzzy`: its `ranges` are one span (`index` + `length`), not per-character, and its default normalisation doesn't strip accents
- `fuzzy`: its "ranges" are a pre-wrapped string, not numeric indices
- `@nozbe/microfuzz`: `strategy: "aggressive"` keeps every in-order letter match, where the default `"smart"` drops the poor ones

Every configuration is defined once, in [`bench/configs.ts`](../../bench/configs.ts), so a row timed in the speed tables is the same row ranked in the scorecard.
A base row is the library's own defaults.
For Fuse.js that means `threshold` 0.6 and a score that decays with a match's distance from index 0, which return the widest result sets in the field: <!-- bench:{{ probeCount("native", "gensler", "fuse.js") }} -->971<!-- bench:end --> rows for the exact long word `gensler` on native, where Ekrina returns <!-- bench:{{ probeCount("native", "gensler", "ekrina") }} -->1<!-- bench:end --> ([`bench/results.json`](../../bench/results.json)).

Ekrina's older constants, `TYPO_PENALTY`, the density floor and the rescue cutoff, were set from measurements on the bench's earlier, synthetic corpora; the second pass's scoring of sparse matches was tuned on these, checked against held-out queries ([performance.md](../performance.md)).
The query families were fixed, weights included, before any library was measured on these corpora, and [`bench/held-out.test.ts`](../../bench/held-out.test.ts) scores Ekrina again on items and seeds the published families never drew from.

## The backend one-shot workload

**Backend one-shot workload** (a fresh process runs constructor + first answer): the chart is in [the comparison](../compare.md), which shows it deliberately, since it is the less flattering of the two Pareto charts.
Its frontier runs `fuzzy` → Ekrina (acronym): a no-index substring scan at <!-- bench:{{ cell("scorecard-native", "fuzzy", "MRR") }} -->0.30<!-- bench:end --> MRR owns the fast end<!-- bench:{{ assert(lt(oneShot("native", 10000, "fuzzy"), min(oneShot("native", 10000, "ekrina"), oneShot("native", 10000, "ekrina (acronym)"), oneShot("native", 10000, "ekrina (indexed)"), oneShot("native", 10000, "fast-fuzzy"), oneShot("native", 10000, "fuse.js (tuned)"), oneShot("native", 10000, "uFuzzy (all opts)"), oneShot("native", 10000, "fuzzysort"), oneShot("native", 10000, "@nozbe/microfuzz"), oneShot("native", 10000, "match-sorter"))), "fuzzy has the fastest native 10k one-shot") }} --><!-- bench:end --> (<!-- bench:{{ fixed(oneShot("native", 10000, "fuzzy"), 2) }} -->1.86<!-- bench:end --> ms), and Ekrina (acronym) reaches <!-- bench:{{ cell("scorecard-native", "Ekrina (acronym)", "MRR") }} -->0.91<!-- bench:end --> at <!-- bench:{{ fixed(oneShot("native", 10000, "ekrina (acronym)"), 2) }} -->3.20<!-- bench:end --> ms, with Ekrina <!-- bench:{{ pct(sub(div(oneShot("native", 10000, "ekrina"), oneShot("native", 10000, "ekrina (acronym)")), 1)) }} -->10%<!-- bench:end --> behind it at <!-- bench:{{ fixed(oneShot("native", 10000, "ekrina"), 2) }} -->3.52<!-- bench:end --> ms and Ekrina (indexed) <!-- bench:{{ pct(sub(div(oneShot("native", 10000, "ekrina (indexed)"), oneShot("native", 10000, "ekrina (acronym)")), 1)) }} -->22%<!-- bench:end --> behind at <!-- bench:{{ fixed(oneShot("native", 10000, "ekrina (indexed)"), 2) }} -->3.90<!-- bench:end --> ms.<!-- bench:{{ assert(lt(oneShot("native", 10000, "ekrina (acronym)"), min(oneShot("native", 10000, "ekrina"), oneShot("native", 10000, "ekrina (indexed)"))), "Ekrina (acronym) has the fastest one-shot of the Ekrina rows") }} --><!-- bench:end -->
This is where Ekrina's lazy preparation shows up, against a <!-- bench:{{ cell("scorecard-native", "Ekrina", "index ms") }} -->0.17<!-- bench:end --> ms constructor.
A fresh searcher's first answer prepares the text of every item it matches, and a single-word query finds them with a scan of the raw strings.
The per-item mask index is built only on the first query that needs it: one with a second word, one that goes to the typo rescue (five or more characters with fewer than ten literal matches, or four that match nothing at all), one the second pass reads over the whole list because nothing matches it literally, or one holding a character outside Latin letters and digits, which the raw scan cannot fold.
For Ekrina the acronym query `tfts` is the third case, since only fuzzy chains match it; Ekrina (acronym)'s acronym tier matches it literally, so its second pass reads only the literal pass's survivors and the index is never built.
That one query is Ekrina (acronym)'s whole lead on this chart: <!-- bench:{{ fixed(raw("coldMatrix", "native", "acronym", "10000", "ekrina (acronym)", "oneShotMs"), 2) }} -->2.28<!-- bench:end --> ms one-shot against Ekrina's <!-- bench:{{ fixed(raw("coldMatrix", "native", "acronym", "10000", "ekrina", "oneShotMs"), 2) }} -->4.65<!-- bench:end -->, where over the other five timed queries the two are level<!-- bench:{{ assert(within(oneShotWithout("native", 10000, "ekrina (acronym)", "acronym"), oneShotWithout("native", 10000, "ekrina", "acronym"), 0.15), "Ekrina and Ekrina (acronym) are level one-shot without the acronym query") }} --><!-- bench:end -->, Ekrina (acronym) averaging <!-- bench:{{ fixed(oneShotWithout("native", 10000, "ekrina (acronym)", "acronym"), 2) }} -->3.38<!-- bench:end --> ms to Ekrina's <!-- bench:{{ fixed(oneShotWithout("native", 10000, "ekrina", "acronym"), 2) }} -->3.29<!-- bench:end -->.
The per-query cells are in [`bench/results.json`](../../bench/results.json).

## The speed tables

**Gzip** = esbuild `--bundle --minify`, tree-shaken to each lib's primary API, gzipped by Node's zlib, measured by `pnpm vpr bench --size --all` (the size table is in [Libraries](../benchmarks.md#libraries)).
The aggregate row is a **geometric mean**: per-library times span orders of magnitude, so an arithmetic mean would only describe the slowest library; the geomean is the standard aggregate for multiplicative spreads, and the rel cells are equally the geomean of each rel column (a geomean of ratios is the ratio of geomeans).
Typo modes are included because Ekrina's typo matching is always on and cannot be disabled, so holding another engine's typo mode off would time two engines doing different jobs.
Only uFuzzy is affected in practice.
Fuse.js (Bitap) and fast-fuzzy (edit distance) are typo-tolerant in every configuration here.
Every child consumes its result counts, the runner asserts they are identical across a cell's processes, and [`bench/hits.test.ts`](../../bench/hits.test.ts) records per-library match counts for every query, so the [timings](../benchmarks.md#size-speed--search-type) are known to be timing comparable work.

Ekrina's batch is carried by its architecture, a staged reject path (a per-item union of char-class bitmasks, then a gate chosen by query type, an `indexOf` subsequence scan for one word and a presence regex for several) cuts most items before any tier is tried, and the lazy preparation happens once per session: each item's text the first time it matches, and the mask index on the first multi-word query or the first that reaches the rescue.

Ekrina (acronym) runs strictly _more_ code per query than Ekrina on every timed query but the acronym probe `tfts`, so wherever its cells come in under Ekrina's on the others, the gap is load swing rather than speed.
`tfts` is the exception because Ekrina (acronym) matches it literally and never builds the whole-list mask index for it, where Ekrina does (the third case under the backend one-shot chart).
At 100k that query takes <!-- bench:{{ fixed(raw("coldMatrix", "native", "acronym", "100000", "ekrina (acronym)", "oneShotMs"), 2) }} -->9.48<!-- bench:end --> ms one-shot against Ekrina's <!-- bench:{{ fixed(raw("coldMatrix", "native", "acronym", "100000", "ekrina", "oneShotMs"), 2) }} -->15.74<!-- bench:end --> on native and <!-- bench:{{ fixed(raw("coldMatrix", "en", "acronym", "100000", "ekrina (acronym)", "oneShotMs"), 2) }} -->8.52<!-- bench:end --> against <!-- bench:{{ fixed(raw("coldMatrix", "en", "acronym", "100000", "ekrina", "oneShotMs"), 2) }} -->13.14<!-- bench:end --> on en, which is all of Ekrina (acronym)'s lead in the cold query and total columns<!-- bench:{{ assert(gt(oneShotWithout("en", 100000, "ekrina (acronym)", "acronym"), oneShotWithout("en", 100000, "ekrina", "acronym")), "without the acronym query Ekrina (acronym) has no en one-shot lead") }} --><!-- bench:end --><!-- bench:{{ assert(gt(oneShotWithout("native", 100000, "ekrina (acronym)", "acronym"), oneShotWithout("native", 100000, "ekrina", "acronym")), "without the acronym query Ekrina (acronym) has no native one-shot lead") }} --><!-- bench:end --><!-- bench:{{ assert(lt(n("speed-en", "Ekrina (acronym)", "total rel"), 100), "Ekrina (acronym) leads Ekrina's en one-shot") }} --><!-- bench:end --><!-- bench:{{ assert(lt(n("speed-native", "Ekrina (acronym)", "total rel"), 100), "Ekrina (acronym) leads Ekrina's native one-shot") }} --><!-- bench:end -->: over the other five queries it averages <!-- bench:{{ fixed(oneShotWithout("native", 100000, "ekrina (acronym)", "acronym"), 2) }} -->9.65<!-- bench:end --> ms to Ekrina's <!-- bench:{{ fixed(oneShotWithout("native", 100000, "ekrina", "acronym"), 2) }} -->9.08<!-- bench:end --> on native and <!-- bench:{{ fixed(oneShotWithout("en", 100000, "ekrina (acronym)", "acronym"), 2) }} -->7.78<!-- bench:end --> to <!-- bench:{{ fixed(oneShotWithout("en", 100000, "ekrina", "acronym"), 2) }} -->7.38<!-- bench:end --> on en.
Over the session the two are level (<!-- bench:{{ span(mul(min(div(n("batch-native", "Ekrina (acronym)", "session total"), n("batch-native", "Ekrina", "session total")), div(n("batch-en", "Ekrina (acronym)", "session total"), n("batch-en", "Ekrina", "session total"))), 100), mul(max(div(n("batch-native", "Ekrina (acronym)", "session total"), n("batch-native", "Ekrina", "session total")), div(n("batch-en", "Ekrina (acronym)", "session total"), n("batch-en", "Ekrina", "session total"))), 100), 0, "%") }} -->103–104%<!-- bench:end -->)<!-- bench:{{ assert(lt(mul(max(div(n("batch-native", "Ekrina (acronym)", "session total"), n("batch-native", "Ekrina", "session total")), div(n("batch-en", "Ekrina (acronym)", "session total"), n("batch-en", "Ekrina", "session total"))), 100), 114.99999999999999), "Ekrina (acronym)'s session is inside the tie band of Ekrina's") }} --><!-- bench:end -->, since an earlier query has built the index by the time `tfts` runs.

Configurations that can't fold diacritics are omitted rather than flagged.
A non-folding row on the native corpus is timing a different, easier task (it silently misses accented matches), and we already _know_ it fails: on the accent probe `lopez` (from "Pedro Alonso López") at 10k, base uFuzzy finds _<!-- bench:{{ probeCount("native", "lopez", "uFuzzy") }} -->0<!-- bench:end -->_ matches where its folding (all opts) config finds <!-- bench:{{ probeCount("native", "lopez", "uFuzzy (all opts)") }} -->6<!-- bench:end --> and Ekrina <!-- bench:{{ probeCount("native", "lopez", "ekrina") }} -->7<!-- bench:end --> ([`bench/hits.test.ts`](../../bench/hits.test.ts)).
Omitted: fast-fuzzy and fuzzy, which have no folding option at all, and the base rows of uFuzzy and Fuse.js.

## Build time

Fuse.js's build is minimal because its "index" is trivial, and the work it defers to query time is why its queries are slow.
fuzzysort has no constructor at all, so it has no column in [the build table](../benchmarks.md#build-time), its lazy prepare-all pass lands in its first query's cold cell, where stock usage actually meets it.
uFuzzy's base construction only shows up process-cold, because `new uFuzzy()` compiles the engine's regex machinery on first construction, and it never touches the list.
The (all opts) column shown there also runs `latinize()` over the haystack, which is why it grows with the corpus (<!-- bench:{{ fixed(n("build", "10k", "uFuzzy (all opts)"), 2) }} -->4.33<!-- bench:end --> → <!-- bench:{{ cell("build", "100k", "uFuzzy (all opts)") }} -->8.43 ms<!-- bench:end -->).<!-- bench:{{ assert(gt(n("build", "100k", "uFuzzy (all opts)"), n("build", "10k", "uFuzzy (all opts)")), "uFuzzy (all opts)'s build grows with the corpus") }} --><!-- bench:end -->
microfuzz's column is its whole index: the constructor normalises every item and builds its word sets up front, so its first query adds only <!-- bench:{{ fixed(div(sub(raw("memory", "native", "@nozbe/microfuzz", "match", "totalBytes"), raw("memory", "native", "@nozbe/microfuzz", "built", "totalBytes")), 1048576), 2) }} -->0.06<!-- bench:end --> MB to [the memory table](../benchmarks.md#memory).

## Memory

Each row is one fresh process ([`bench/memory.ts`](../../bench/memory.ts)): the searcher is built, then answers `hinton`, `qxzwkv` and `gensler` warm in that order, so each column includes every query before it.
Ekrina allocates its per-item caches empty at construction; `hinton` allocates a match slot per item and prepares the items it matches (~<!-- bench:{{ fixed(div(sub(raw("memory", "native", "ekrina", "match", "totalBytes"), raw("memory", "native", "ekrina", "built", "totalBytes")), 1048576), 1) }} -->1.4<!-- bench:end --> MB), and `qxzwkv`, the first query to reach the typo rescue, adds ~<!-- bench:{{ fixed(div(sub(raw("memory", "native", "ekrina", "miss", "totalBytes"), raw("memory", "native", "ekrina", "match", "totalBytes")), 1048576), 1) }} -->1.3<!-- bench:end --> MB, the mask index's bigram arrays (~<!-- bench:{{ fixed(div(sub(raw("memory", "native", "ekrina (indexed)", "built", "totalBytes"), raw("memory", "native", "ekrina", "built", "totalBytes")), 1048576), 1) }} -->0.9<!-- bench:end --> MB) among it.
Ekrina (indexed) builds that index at construction instead (<!-- bench:{{ cell("memory", "Ekrina (indexed)", "built MB") }} -->2.07<!-- bench:end --> MB built), so `qxzwkv` adds <!-- bench:{{ fixed(div(sub(raw("memory", "native", "ekrina (indexed)", "miss", "totalBytes"), raw("memory", "native", "ekrina (indexed)", "match", "totalBytes")), 1048576), 2) }} -->0.42<!-- bench:end --> MB, the part of that ~<!-- bench:{{ fixed(div(sub(raw("memory", "native", "ekrina", "miss", "totalBytes"), raw("memory", "native", "ekrina", "match", "totalBytes")), 1048576), 1) }} -->1.3<!-- bench:end --> MB that is not the index.
Ekrina's searcher is collected (`collected` in [`bench/results.json`](../../bench/results.json)), but <!-- bench:{{ span(div(min(raw("memory", "native", "ekrina", "residueBytes"), raw("memory", "native", "ekrina (acronym)", "residueBytes"), raw("memory", "native", "ekrina (indexed)", "residueBytes"), raw("memory", "en", "ekrina", "residueBytes"), raw("memory", "en", "ekrina (acronym)", "residueBytes"), raw("memory", "en", "ekrina (indexed)", "residueBytes")), 1048576), div(max(raw("memory", "native", "ekrina", "residueBytes"), raw("memory", "native", "ekrina (acronym)", "residueBytes"), raw("memory", "native", "ekrina (indexed)", "residueBytes"), raw("memory", "en", "ekrina", "residueBytes"), raw("memory", "en", "ekrina (acronym)", "residueBytes"), raw("memory", "en", "ekrina (indexed)", "residueBytes")), 1048576), 2) }} -->0.41–0.47<!-- bench:end --> MB stays behind on the two corpora.
Most of it is V8's compiled code for Ekrina's own functions, which lives as long as the module is loaded ([performance.md](../performance.md#what-a-dropped-searcher-leaves-behind)).
The en cells, in [`bench/results.json`](../../bench/results.json), tell the same story.

## Typing `hinton` at 100k

The probe types the short-word query `hinton` from the 3-character UI gate onward (real UIs gate search behind 2–3 characters, because a 1–2 char query matches a huge fraction of the corpus and every rich-result library has to materialise it).
Each sample is a fresh process on the 100k native corpus that builds the searcher, answers five other queries so the library's code is already compiled, then types `hin`, `hint` and `hinto` once each, in order, as a user does; each step's cell is the median of seven such processes, and **session** is the sum of the three.
A keystroke runs once per process because repeating one query in a process lets V8 reuse the regexes it compiled for it, which a user's next keystroke never can.

Every row has already answered five queries before the first keystroke, so one-time work (Ekrina's mask build, fuzzysort's lazy target prep) is done by then; the [cold cells](../benchmarks.md#size-speed--search-type) measure it.

## Matching inside long text

The hazard there is the fuzzy tier assembling a "match" from characters scattered across unrelated words, so the tier rejects any assembly covering less than <!-- bench:{{ constant("18%") }} -->18%<!-- bench:end --> of the span it stretches across (`DENSITY_FLOOR` in [`src/fuzzy.ts`](../../src/fuzzy.ts)).
The constant was set on the bench's earlier synthetic corpora, where junk chains maxed out at 0.143 density and the sparsest genuine match measured 0.211.
On real text a few junk chains clear the floor, such as `mueller` across "**M**arc O**uelle**t Gensle**r**" and `andchat` across "**and** the **Cho**col**at**", where others are arguably real sparse matches (`khaj` on "**K**au**haj**").

Corrections rise with length<!-- bench:{{ assert(gt(n("longtext", "16384", "corrected"), n("longtext", "512", "corrected")), "corrections rise with document length") }} --><!-- bench:end --> to <!-- bench:{{ cell("longtext", "16384", "corrected") }} -->3.5%<!-- bench:end --> at 16k, since a longer document holds more words within a correction of any given query.
The rates move with the words drawn: a draw of 400 absent words, run the same way but not part of `results.json`, measured fuzzy junk at <!-- bench:{{ unsourced("0.8%", "400-word longtext draw, 2026-11-08") }} -->0.8%<!-- bench:end --> on native and <!-- bench:{{ unsourced("1.0%", "400-word longtext draw, 2026-11-08") }} -->1.0%<!-- bench:end --> on en from 512 characters up, so read [the table](../benchmarks.md#matching-inside-long-text) as about <!-- bench:{{ pct(div(highest("longtext", "512+1024+2048+4096+8192+16384", "fuzzy junk"), 100)) }} -->1%<!-- bench:end -->.
Miss time includes the typo rescue (a miss must fail it too), and it is <!-- bench:{{ fixed(n("longtext", "16384", "miss ms"), 2) }} -->0.35<!-- bench:end --> ms at 16k chars.
[`bench/longtext.test.ts`](../../bench/longtext.test.ts) keeps that table as a regression guard, failing if either rate rises above <!-- bench:{{ constant("5%") }} -->5%<!-- bench:end -->.

## Regenerating the numbers

Every measured table in [the benchmarks](../benchmarks.md) is generated, and `pnpm vpr bench --all` regenerates all of them: it measures, writes [`bench/results.json`](../../bench/results.json), rewrites each table in place, and redraws the Pareto charts.
No measured cell in these pages is typed by hand.

- `pnpm vpr bench` alone times ekrina's own rows once and writes nothing.
- `pnpm vpr bench --docs` re-emits the tables from the committed `results.json` without measuring anything.
- `pnpm vpr bench --check` exits nonzero if any table disagrees with `results.json`.
- `pnpm vpr bench --speed`, `pnpm vpr bench --quality` and `pnpm vpr bench --memory` run one stage of the measurement, over ekrina's own rows and printed unless `--all` is added; `--runs=N` sets the fresh processes per cold cell (default 1).
- `pnpm vpr bench --scope=native-10k` scopes a dev run to one corpus (`native`) or one corpus at one size (`native-10k`).
  A scoped run measures a partial matrix, so it prints and stops: neither `results.json` nor the docs are touched.

_Both charts read the [scorecard](../benchmarks.md#scorecard) out of [`bench/results.json`](../../bench/results.json) ([`pareto.ts`](../pareto.ts)), so they cannot disagree with it; `pnpm vpr bench --all` redraws them._

The pre-filter funnel ([`bench/funnel.test.ts`](../../bench/funnel.test.ts)) is a diagnostic rather than a published table; `pnpm vpr bench:test` runs it.
Improvements to the benchmarks are welcome.
