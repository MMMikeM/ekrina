# The pipeline, and where the time goes

What `createSearcher` builds, what a `search(query)` call does, how many of your records reach each stage, and how long each stage takes.

Counts and timings come from `pnpm --filter=ekrina-bench exec vp test run stages.test.ts`, over the sixteen single-word probes at 100k, both corpora, on a machine under some load, so read the times as approximate.
Stage times are measured by difference, so they overlap slightly.

## Build

```mermaid
flowchart LR
    L["createSearcher(list)"] --> S["resolve spec defaults"]
    S --> B["allocate normalisedFields, fieldMasks"]
    B --> D(["done — under half a millisecond at 100k"])
```

Construction resolves the field specs and allocates the buffers survivors will later be written into, under half a millisecond at 100k (the build table in [benchmarks.md](./benchmarks.md)).
It reads no item text, which is trimmed, normalised and masked the first time an item survives a gate.

Everything an index would hold is built on demand, during queries.

## Query

```mermaid
flowchart TD
    Q["search(query, { limit })"] --> P["first 256 characters -> normaliseText -> prepareQuery"]
    P --> E{"empty?"}
    E -->|yes| Z(["[]"])
    E -->|no| ONE{"one character?"}
    ONE -->|yes| WS["word-start raw gate<br/>scan all N; never cached"]
    WS --> MAT
    ONE -->|no| N{"extends the previous query,<br/>same gate kind?"}

    N -->|yes| NAR["scan cached survivors<br/>gate on normalised text"]
    N -->|no| RG{"single word, and every<br/>character in UNFOLD?"}
    RG -->|yes| RAW["compile raw gate<br/>scan all N against the caller's own strings"]
    RG -->|no| MASK["build union masks<br/>over all N (once per searcher)"]
    MASK --> MSCAN["scan all N against the union masks"]

    NAR --> MAT
    RAW --> MAT["materialise survivors<br/>trim + normalise + per-field mask, cached"]
    MSCAN --> MAT
    MAT --> LAD["tier ladder<br/>exact -> prefix -> boundary -> multi-word<br/>-> acronym -> contains -> fuzzy chain"]
    LAD --> LIT{"fewer literal hits<br/>than min(10, limit)?"}
    LIT -->|no| OUT["build results, sort by score,<br/>cut to limit"]
    LIT -->|yes| STG["correction stages, in order:<br/>early rescue (a word of five characters or more),<br/>readings, late rescue (shorter, and only if nothing matched)"]
    STG --> SCAN["per stage: scan all N, or only the survivors,<br/>against its letter budget on the union masks, built first if missing;<br/>then its letter-pair gate on the items that pass<br/>(an item's bigram set is read the first time it is needed)"]
    SCAN --> FIX["correct each admitted field beside the match it already holds:<br/>a literal hit stands, a fuzzy chain competes with the correction"]
    FIX --> OUT
```

Which path a query takes depends on:

1. whether it is one character, which matches only where it starts a word;
2. whether it extends the previous one;
3. whether it is a single word made of characters the fold table covers;
4. whether it needs a correction, which a four-character query gets only when nothing matches it as typed, and a query holding a word over 64 characters never gets.

Every subsequence gate, raw or normalised, checks a field longer than 256 characters with one linear in-order scan instead of its regex, which would take time quadratic in the field's length on crafted text.

With a `limit`, the ladder runs in full until `limit` items have matched literally, and after that tries only the literal tiers, since no fuzzy chain can reach the page; the corrections run only if fewer than ten items matched literally, or fewer than `limit` when that is smaller.

## Records and time per stage

en 100k, mean over sixteen single-word probes:

| stage                              | records in |      records out |                           time |
| ---------------------------------- | ---------: | ---------------: | -----------------------------: |
| construction                       |          — |                — |       under half a millisecond |
| raw gate (first query)             |    100,000 |   **92 — 0.09%** |                        2.33 ms |
| materialise survivors              |         92 |               92 |                        0.02 ms |
| tier ladder                        |         92 |   **29 results** |                        0.09 ms |
| — rescue path only —               |            |                  |                                |
| union mask build                   |    100,000 |                — | **3.22 ms**, once per searcher |
| bigram sets, items one class short |      6,361 |                — |    0.69 ms, once per item read |
| rescue stage                       |    100,000 | **2,322 — 2.3%** |                        1.56 ms |

Native 100k behaves the same: the raw gate leaves _92 records, 0.09%_, at 2.60 ms; the ladder produces 29 results in 0.06 ms; the rescue's mask build is 3.61 ms, the bigram sets of the 6,297 items one class short take 0.60 ms, and its stage admits 2,357 records (2.4%) at 1.28 ms.

Once the gate has run, the literal path takes almost no time.
0.09% of the corpus survives it, and everything downstream - materialising, normalising, masking and running the full tier ladder on those survivors - takes 0.1 ms against the gate's 2.33.

The rescue admits _2.3% of the corpus_, about 25 times what the literal gate lets through, and it is the only thing that needs a whole-corpus index.
Twelve of the sixteen probes take it on both corpora, because the probe set is deliberately typo-heavy.
The bigram stage keeps that set small: a field missing one character class is only reachable by an edit at that class's query position, so every query bigram away from that position must be present.

## Stages that only some sessions run

**The union masks, ~5–7 ms.**
Built the first time a query is rescuable _and_ turns up fewer than ten literal hits (fewer than `limit`, if that is smaller), because below that a correction can still reach the visible page, and only a mask can admit the near-misses the literal gate rejected.
A four-character query builds them only when nothing matched it at all.
A session whose queries all match literally never builds them.
Multi-word and non-Latin queries have no raw-gate form, so they take the mask path and force the build immediately.
That scan computes only the masks, folding each code unit once (`rawFieldMask`).
An item's bigram set is read the first time a gate needs it, which in the rescue stage means an item missing exactly one character class, about 6% of the corpus, and reading those takes 0.6–0.7 ms.

**The raw gate, ~2–3 ms.**
Run by any query that cannot narrow: the first one, and any later one that isn't an extension of its predecessor.
A typed sequence runs it on its first keystroke, and each unrelated query runs it again.

Building the masks only when a query needs them, and gating the raw text until then, makes the first query faster than an index built up front would, and a long run of unrelated queries slower.
`search.buildIndex()` builds them at construction instead, the masks and every bigram set in one fused scan per field (`rawFieldScan`; the whole constructor takes 5.9–6.5 ms at 100k), and every query that cannot narrow then filters on the masks first, a single word running its gate on only the items they let through (the `Ekrina (indexed)` rows in [benchmarks.md](./benchmarks.md)).

## What the survivor cache does

Each query leaves behind the set that passed its gate.
The next query, if it extends the last one, scans only that set, and the set shrinks with every keystroke, because each one re-gates what the previous one kept.

Soundness rests on the filters being monotone under extension, meaning an item the shorter query rejected stays rejected.
A query that has _become_ rescuable breaks that, because it needs near-misses a literal-gated set never held.
So does a multi-word query, which needs candidates the subsequence gate has already dropped, since the multi-word tier matches out of order.
Both are checked for explicitly.
A one-character query never seeds the cache: it admits only items where the character starts a word, and the next keystroke's subsequence gate needs items it rejected.

The rescue path deliberately ignores the cache: it scans all N, because the near-misses it wants are exactly what the cached set excluded.

## Large result sets

0.09% of records reach the ladder and the ladder takes under 0.1 ms, so filtering is not the slow part of a query that returns a lot.
The time it takes beyond the gate grows with how many results it has, not how many records it searched: in the typing session in [benchmarks.md](./benchmarks.md), `hin`, the widest query, takes 3.73 ms and `hinto` 0.29.
Even with a `limit`, every literal result is built and sorted before the list is cut.
