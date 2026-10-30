# The pipeline, and where the time goes

What `createFuzzySearch` builds, what a `search(query)` call does, how many of your records reach each stage, and how long each stage takes.
Companion to [optimisation.md](./optimisation.md) (what moved the numbers) and [measurement.md](./measurement.md) (how the harness came to be wrong).

Counts and timings come from `pnpm --filter=ekrina-bench exec vitest run stages.test.ts`, over the sixteen single-word probes at 100k, both corpora, on a machine under some load, so read the times as approximate.
Stage times are measured by difference, so they overlap slightly.

## Build

```mermaid
flowchart LR
    L["createFuzzySearch(list)"] --> S["resolve spec defaults"]
    S --> B["allocate trimmedFields, normalisedFields, fieldMasks"]
    B --> D(["done — ~0.35 ms at 100k"])
```

Construction reads nothing.
It resolves the field specs and allocates the buffers survivors will later be written into.
No text is trimmed, normalised or copied, and no mask is computed.
At 100k that is ~0.35 ms of allocation and nothing else (the build table in [benchmarks.md](./benchmarks.md)).

Everything an index would hold is built on demand, during queries.

## Query

```mermaid
flowchart TD
    Q["search(query, { limit })"] --> P["normaliseText -> prepareQuery"]
    P --> E{"empty?"}
    E -->|yes| Z(["[]"])
    E -->|no| ONE{"one character?"}
    ONE -->|yes| WS["word-start raw gate<br/>scan all N; never cached"]
    WS --> MAT
    ONE -->|no| N{"extends the previous query,<br/>same gate kind?"}

    N -->|yes| NAR["scan cached survivors<br/>gate on normalised text"]
    N -->|no| RG{"single word, and every<br/>character in UNFOLD?"}
    RG -->|yes| RAW["compile raw gate<br/>scan all N against the caller's own strings"]
    RG -->|no| MASK["build union masks + bigram sets<br/>over all N (once per searcher)"]
    MASK --> MSCAN["scan all N against the union masks"]

    NAR --> MAT
    RAW --> MAT["materialise survivors<br/>trim + normalise + per-field mask, cached"]
    MSCAN --> MAT
    MAT --> LAD["tier ladder<br/>exact -> prefix -> boundary -> multi-word<br/>-> acronym -> contains -> fuzzy chain"]
    LAD --> LIT{"rescuable query with fewer literal hits<br/>than min(10, limit)? four characters:<br/>no hit at all, literal or fuzzy"}
    LIT -->|no| OUT["build results, sort by score,<br/>cut to limit"]
    LIT -->|yes| REL["relaxed scan over the union masks, built first if missing:<br/>admit items missing at most one<br/>character class, and only if every query bigram<br/>away from that class's position is present"]
    REL --> RES["ladder + one-edit rescue"]
    RES --> OUT
```

Which path a query takes depends on:

1. whether it is one character, which matches only where it starts a word;
2. whether it extends the previous one;
3. whether it is a single word made of characters the fold table covers;
4. whether it needs a correction, which a four-character query gets only when nothing matches it as typed.

Every subsequence gate, raw or normalised, checks a field longer than 256 characters with one linear in-order scan instead of its regex, which would take time quadratic in the field's length on crafted text.

With a `limit`, the ladder first runs its literal tiers alone, and the fuzzy chain and the corrections run only if fewer than `limit` items matched literally.

## Who reaches what, and how long it takes

ascii 100k, mean over sixteen single-word probes:

| stage                     | records in |      records out |                           time |
| ------------------------- | ---------: | ---------------: | -----------------------------: |
| construction              |          — |                — |                       ~0.35 ms |
| raw gate (first query)    |    100,000 |  **457 — 0.46%** |                        3.16 ms |
| materialise survivors     |        457 |              457 |                        0.06 ms |
| tier ladder               |        457 |  **365 results** |                        0.13 ms |
| — rescue path only —      |            |                  |                                |
| union mask + bigram build |    100,000 |                — | **12.0 ms**, once per searcher |
| relaxed scan + rescue     |    100,000 | **5,495 — 5.5%** |                        1.65 ms |

Mixed 100k behaves the same, and tighter: the raw gate leaves _176 records, 0.18%_, at 3.86 ms; the ladder produces 133 results in 0.04 ms; the rescue's mask build is 14.4 ms and its relaxed scan admits 7,397 records (7.4%) at 1.99 ms.

Once the gate has run, the literal path takes almost no time.
0.46% of the corpus survives it, and everything downstream - materialising, normalising, masking and running the full tier ladder on those survivors - takes 0.19 ms against the gate's 3.16.

The rescue is a different pipeline.
It admits _5.5% of the corpus_, twelve times what the literal gate lets through, and it is the only thing that needs a whole-corpus index.
Eleven of the sixteen ascii probes take it, twelve on mixed, because the probe set is deliberately typo-heavy.
The bigram stage keeps that set small: a field missing one character class is only reachable by an edit at that class's query position, so every query bigram away from that position must be present, and the class test alone admitted 19.3% when it was measured.

## Stages that only some sessions run

**The union masks and bigram sets, ~12–14 ms.**
Built the first time a query is rescuable _and_ turns up fewer than ten literal hits (fewer than `limit`, if that is smaller), because below that a correction can still reach the visible page, and only a mask can admit the near-misses the literal gate rejected.
A four-character query builds them only when nothing matched it at all.
A session whose queries all match literally never builds them.
Multi-word and non-Latin queries have no raw-gate form, so they take the mask path and force the build immediately.
The class mask and the bigram sets come from one fused scan per field (`rawFieldScan`), folding each code unit exactly once; the two-pass build it replaced took ~18.5 ms.

**The raw gate, ~3–4 ms.**
Run by any query that cannot narrow: the first one, and any later one that isn't an extension of its predecessor.
A typed sequence runs it once; a searcher handed unrelated queries runs it every time.

Those two are the design's central trade.
Against an eagerly-built index the first query is faster and a long run of unrelated queries is slower.
`search.buildIndex()` takes the other side of it on request: the mask build moves into construction, and every query that cannot narrow filters on the masks instead of running the raw gate (the `Ekrina (indexed)` rows in [benchmarks.md](./benchmarks.md)).

## What the survivor cache does

Each query leaves behind the set that passed its gate.
The next query, if it extends the last one, scans only that set, and the set shrinks with every keystroke, because each one re-gates what the previous one kept.

Soundness rests on the filters being monotone under extension, meaning an item the shorter query rejected stays rejected.
A query that has _become_ rescuable breaks that, because it needs near-misses a literal-gated set never held.
So does a multi-word query, which needs candidates the subsequence gate has already dropped, since the multi-word tier matches out of order.
Both are checked for explicitly.
A one-character query never seeds the cache: it admits only items where the character starts a word, and the next keystroke's subsequence gate needs items it rejected.

The rescue path deliberately ignores the cache: it scans all N, because the near-misses it wants are exactly what the cached set excluded.

## Where the remaining time is

For a query that returns a lot, the time goes elsewhere.
0.46% of records reach the ladder and the ladder takes 0.13 ms, so filtering is no longer the slow part.
What remains is proportional to how many results a query has, not how many records it searched: in the typing session in [benchmarks.md](./benchmarks.md), `gra`, the widest query, takes 2.28 ms per keystroke and `grady` 0.58.
`limit` saves the fuzzy and correction work once enough items match literally; the literal results are still built and sorted.
