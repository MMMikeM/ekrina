# Optimisation

Companion to [measurement.md](./measurement.md), which covers how the benchmark harness came to be wrong and how it was fixed.
This one covers what the corrected harness then found.

Everything here is measured on the ascii and mixed corpora at 100k, one library per process.
Every change listed as landed produced _identical ranks and MRR_ across all thirty probes, these are optimisations, so any output change is a bug.

## Where the time actually goes

Counted per query on the ascii corpus at 100k:

```
100,000 items
   ↓ mask scan            0.16 ms   3%    94% rejected
 ~6,208 mask survivors
   ↓ front gate           ~0.2 ms   5%
   ~741 reach the ladder
   ↓ tier ladder          ~4.2 ms  92%    ~5.7 µs per candidate
   390 results
```

The pre-filter was never the problem.
Ekrina's entire gate, a per-item `Int32Array` mask read plus a native regex on survivors, takes less time than uFuzzy's _whole_ query, which has no index at all.
All the slow work happens per surviving candidate, and only 53% of candidates that reach the ladder produce a result.

## What landed

| change              |                  ascii |                  mixed | what it does                                               |
| ------------------- | ---------------------: | ---------------------: | ---------------------------------------------------------- |
| Anchored front gate |             −12% query |              −8% query | Gate at a placement the chunk assembler would actually try |
| Rescue cutoff       |           −10.5% query |            −9.2% query | Stop attempting corrections once ten literal hits exist    |
| Lazy fields         | −34% query, −69% build | −54% query, −61% build | Materialise a field's text only when its mask survives     |

### Anchored front gate

`buildFuzzyGate` was a bare subsequence test, so it admitted any field whose characters appeared in order, and the ladder then rejected 64% of them.
`fuzzyChainMatch` only ever begins a chain where `admitsChunk` holds - the placement opens a word, or runs the query's first three characters consecutively - and every earlier tier satisfies one of those anyway.
Requiring the anchor cut fields reaching the ladder by 32% (ascii) and 39% (mixed) and cannot false-reject.

It is also monotone under query extension, which the survivor cache depends on: extending a query lengthens the subsequence and never changes its first three characters, so both branches only ever admit fewer fields.

### Rescue cutoff

`TYPO_PENALTY` is 2.1, so the best possible correction scores 2.1, strictly worse than any `exact`, `prefix`, `boundary` or `contains` match, all of which score at or below `SCORES.CONTAINS` (2).
Once ten literal-tier hits exist, no correction can enter the top ten, so computing them is work no caller can observe through the ranking.

Before the budget, the rescue ran 17,616 times per query to produce about five corrected results, roughly 3,500 attempts per correction.

The budget counts _literal-tier_ hits rather than all results, because `fuzzy` starts at CONTAINS and rises past 2.1, so fuzzy hits must not be allowed to crowd out a correction.

### Lazy fields

The largest single win, and the one that reframed the rest.

The mask rejects ~94% of a corpus, yet the index was building a trimmed copy, a normalised copy and a `PreparedField` object for _every_ item, so ~94% of 27 MB and ~40 ms of build was constructed for items no query reads.

Now the build loop produces masks and nothing else, folding characters straight out of the raw string with no allocation, and a field's text is materialised on first mask survival and cached.
The first query materialises ~5,400 fields; the second materialises none.

Each pass below removed work that did not need to be in the build loop:

| build, ascii 100k                                    |             |
| ---------------------------------------------------- | ----------: |
| eager                                                |     39.5 ms |
| don't _retain_ the strings                           |     18.9 ms |
| don't _compute_ them either, fold the mask from raw | **7.25 ms** |

The second pass still normalised every item and allocated 100k objects before discarding them.
The third replaced `for (const ch of raw)` - which allocates a one-character string per code point, about 3M over a 100k corpus - with a `charCodeAt` loop that only folds for code points above 127.

The deferred work lands on the first query instead.
Cold is flat on ascii and ~6% worse on mixed.
The one-shot total, build plus first query, is 3.1× better on ascii and 3.7× on mixed.

## What was rejected

The negative results are the more useful half, because each was a confident hypothesis that measurement killed in minutes.

| hypothesis                                      | verdict                                                                                                                                                                                       |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bigram presence mask**                        | Slower queries _and_ +38% build. Four integer ANDs per variant plus a closure lost to _one_ call into V8's Irregexp, which is compiled machine code with fast literal-alternation dispatch. |
| **Flattening the index into a string arena**    | The scan it would optimise is 3.4% of query time. The `Int32Array` mask scan was already doing its job.                                                                                       |
| **Interleaving query samples across libraries** | Inflated fuzzysort 0.178 → 0.646 ms and uFuzzy 0.183 → 0.453 by making every sample run cache-cold. Correct for 1–40 ms index builds, wrong for sub-millisecond queries.                      |
| **Larger V8 semi-space**                        | ekrina held at 4.78 / 5.16 / 4.96 / 5.17 ms across default/16/64/128 MB. Young-generation sizing was not the variance.                                                                         |
| **`limit` option, as a sort saving**            | The sort is ~3.4k comparisons on 392 results, under 0.1 ms. `limit` shipped later for the fuzzy work it lets the searcher skip (CHANGELOG).                                    |
| **ASCII lookup tables in `rawFieldScan`**      | Two 128-entry typed arrays for the mask bit and bigram class, replacing the branch chain: `buildIndex()` at 100k measured 109% (ascii) and 121% (mixed) of the branches. Its comment records the same result for four factored versions. |
| **Gate regexes without the `u` flag**           | An explicit Latin word-character class in the lookbehind lets the raw gate drop `u` and stay false-pass only, but scanning 100k raw strings measured 94–100% of the `u` version, which is within the noise. |
| **Lazy bigram sets**                            | Masks alone take 4 of the scan's 9.6 ms at 100k, so building bigrams per item on demand halved `buildIndex()` (11.8 → 5.5 ms) and a fresh searcher's first phrase (12.3 → 5.8 ms). A short miss then computed them one item at a time for most of the list (`zzzz` 5.6 → 15.9 ms), and building them all on the first rescue only moves that time onto the first typo. |
| **Lazy ranges**                                 | 1.08–1.67 range entries per result, and the fuzzy tier's ranges fall out of the chain walk that produces the score. Nothing to defer.                                                         |
| **`missingClasses` dispatch**                   | Sound and adds no work, but its effect sits below the harness's ±3% noise floor, so it cannot be claimed.                                                                                             |

Every attempt to beat a native regex lost.
The anchored gate won because it makes Irregexp reject _earlier_; the bigram mask lost because it tried to replace Irregexp with a JS loop.

Every win came from moving work off the 100,000 path, onto the ~6,200 or ~741 paths.
Every rejected idea added per-item work to speed up a path that was already fast.

## Allocation per query

Churn per query, measured at ascii 100k:

| library           | allocated/query | results/query |
| ----------------- | --------------: | ------------: |
| uFuzzy (all opts) |          4.5 kB |           144 |
| uFuzzy            |          6.3 kB |           115 |
| Ekrina             |         33.3 kB |           392 |
| @nozbe/microfuzz  |         62.1 kB |           832 |
| fuzzysort         |         95.0 kB |           832 |
| Ekrina (acronym)   |         98.9 kB |           392 |

Churn tracks measurement variance almost exactly: uFuzzy at 4–6 kB is stable to ±5%, Ekrina at 33 kB swings ±20%, fuzzysort at 95 kB spreads 122–170%.
That is why Ekrina was the library the old shared-process harness distorted most.

`Ekrina (acronym)` allocating 3× base for _identical_ output, the same 392 results, is an unexplored defect.

## Open

- ~~`rawCharMask` has no soundness test~~, done: `test/raw-mask.test.ts` and `bench/raw-mask.test.ts` pin that the (now fused) `rawFieldScan` mask never drops a bit over either corpus.
- ~~`fieldMasks` duplicates `unionMasks` for one-field lists~~, done: `buildUnionIndex` shares the array when `specCount === 1`.
- The acronym configuration's 3× allocation: `acronymTier` builds an offsets array and initials string per surviving field, hit or miss. Speed parity with base holds in every published cell, so this is GC pressure only; fix by streaming over module scratch if a heap number ever moves on it.
- ~~Build-time flags in `src/flags.ts`~~, done: the missing-class dispatch is unconditional (a variant needing a class the field lacks always fails the containment test it skips, so the short-circuit is result-neutral), and `src/flags.ts` plus the `bench/variants.ts` machinery are deleted.
