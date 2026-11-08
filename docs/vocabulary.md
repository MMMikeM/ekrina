# Vocabulary

The current glossary and naming conventions for `src/`.
Successor to two audit-era documents, `naming.md` (0.x) and `vocab-audit.md` (1.0), both described states the code has since left, and git history keeps them.

## The load-bearing vocabulary

Words that carry meaning across files; a maintainer should be able to trust these everywhere.

| Word                       | Means, everywhere                                                                                                                                         | Guarded by                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `item`                     | one collection element `T`                                                                                                                                | `SearchResult.item`                          |
| `field`                    | one searchable string an item's `selectField` returns; on a result, `field` names the best one and `fields[name]` is that field's match                   | `matchField`, `Field`, `FieldMatch`          |
| `query`                    | the search string (trimmed raw; `normalisedQuery` for the folded form)                                                                                    | `PreparedQuery`                              |
| `prepared`                 | the per-query state built once and reused across every field; modules key their own lazy state to it with `perQuery`                                      | `PreparedQuery`, `perQuery`                  |
| `normalised`               | passed through `normaliseText` (lowercased, diacritics folded, trimmed)                                                                                   | every `normalised*` binding                  |
| `raw`                      | the caller's own string, before trim and fold                                                                                                             | `rawFieldScan`, `RescueVariant.raw`          |
| `tier`                     | which rung of the ladder matched (categorical)                                                                                                            | `Tier`, `SCORES`                             |
| `score`                    | the numeric sort key, lower = better                                                                                                                      | `MatchResult.score`                          |
| `literal`                  | a hit at or below `SCORES.CONTAINS`, the query text actually appears                                                                                      | `literalPass`, `literalHits`, `literalTiers` |
| `range`                    | inclusive `[start, end]` span for highlighting                                                                                                            | `HighlightRange`, `HighlightRanges`          |
| `chunk`                    | a consecutive matched run inside the fuzzy tier (same type as `HighlightRange`, different meaning)                                                        | `Chunk` alias                                |
| `chain`                    | an assembled sequence of chunks covering the whole query                                                                                                  | `fuzzyChainMatch`, `ChainScore`              |
| `gate`                     | a fast per-query pre-filter that can only false-pass, never false-reject                                                                                  | `gates.ts`                                   |
| `mask`                     | the 32-bit char-class summary used by the O(1) gate; every stored mask is scope-qualified (`queryMask`, `fieldMasks`, `UnionIndex.masks`, `requiredMask`) | `charMask`                                   |
| `class`                    | unqualified: a charMask bucket (`bigramClass`, `missingClasses`, `classBit`); regex character classes always say "char class"                             | `charMask`, `escapeCharClass`                |
| `bigram`                   | an adjacent pair of char classes, hashed into a 64-bit presence set for the rescue gate                                                                   | `FieldBigrams`, `RescueBigramGate`           |
| `survivor`                 | an item index that passed the gate for the previous query                                                                                                 | `survivorCache`                              |
| `relaxed`                  | the mask gate tolerating exactly one missing class (what a substitution typo looks like from a mask)                                                      | `budgetAdmits`, `isRescuableQuery`           |
| `rescue`                   | the one-edit correction machinery, run as the early or late stage; `RescueContext` is its per-field call state                                            | `rescue.ts`, `earlyRescue`, `lateRescue`     |
| `variant`                  | one enumerated one-edit correction candidate (swap or drop)                                                                                               | `RescueVariant`                              |
| `stage`                    | a correction pass run after the literal pass, in `stages` order (early rescue, readings, late rescue): a letter budget, a pair gate, a matcher            | `Stage`, `PreparedStage`, `stages.ts`        |
| `reading`                  | a second-pass interpretation of a query the ladder and rescue missed: two edits, a held key, a stray or missing space, a sparse word, a short swap        | the `readings` stage                         |
| `subject`                  | what a rescue corrects, the whole query, or a phrase's one absent word                                                                                    | `CorrectionSubject`                          |
| `window`                   | a field slice exactly one substitution away from the subject                                                                                              | `substitutedWindows`                         |
| `correction` / `corrected` | the fixed query a rescue scores; `MatchResult.corrected` carries it in the caller's casing                                                                | `prepareCorrection`, tier `"corrected"`      |
| `short`                    | a query with no word of five characters or more; inside `correctSubject`, a corrected word under five characters                                          | `isShortQuery`, `MIN_TYPO_QUERY_LENGTH`      |
| `fallback`                 | a short query's correction, offered only when nothing matches the query as typed                                                                          | `isShortQuery` in `correction.ts`            |
| `cutoff`                   | the literal-hit count (ten, or `limit` if lower) at which the searcher stops trying corrections, with or without a limit                                  | `RESCUE_CUTOFF`                              |
| `limit`                    | the caller's cap on returned results; the capped results equal slicing the uncapped ones                                                                  | `SearchOptions.limit`                        |
| `fold`                     | the per-code-point, length-preserving case/diacritic mapping                                                                                              | `normalise.ts`                               |
| `unfold`                   | the fold's inverse, folded char → every source code point, for gating un-normalised text                                                                  | `normalise.ts`                               |
| `boundary`                 | any non-word character; one definition everywhere                                                                                                         | `boundaries.ts`                              |
| `lead`                     | count of leading-whitespace units stripped from a raw field                                                                                               | `leads`, `shiftRanges`                       |

## Conventions

Schemes the code follows deliberately; new code joins them.

- **Lengths are spelled out**: `queryLength`, `runLength`, `subjectLength`, never `Len`.
- **Positions**: a string offset is `at` (or `<noun>At`: `soleAt`, `wordAt`, `halfAt`, `insertAt`, `splitAt`); a scan start is `from` (or `<noun>From`: `queryFrom`); an array index is `<noun>Index` (`wordIndex`, `absentIndex`).
- **Characters**: `char` is a code point as a string; `unit` is a numeric UTF-16 code unit (`charCodeAt`); `codePoint` is a numeric code point (`codePointAt`).
- **Bigram halves** carry the `Lo`/`Hi` suffix; field-side sets are `bigrams*`, query-side requirements are `required*`; the per-field accumulator keeps bare `{ lo, hi }` (`FieldBigrams`).
- **Tier probes** in ladder.ts are `<name>Tier(…): MatchResult | null`; `fuzzyMatch` (public) and `fuzzyChainMatch` (a chain scorer, not a rung probe) are the deliberate exceptions.
- **Ends are exclusive** in bare locals (`end`, `chunkEnd`, `wordEnd`, the JS slice idiom); inclusive ends exist only inside `HighlightRange` tuples and are always destructured `[start, end]`.
- **Predicates** read as predicates: `is*` (`isBoundaryAt`, `isExactMask`, `isRescuableQuery`, `isShortQuery`, `isUnbeatableCorrection`) or a domain verb (`admitsChunk`).
- **`*Occurrence`** returns an index or -1 (`boundaryOccurrence`, `wordStartOccurrence`).
- **`build*` constructs fresh** per-query state (`buildFuzzyGate`, `buildRescueVariants`); **`prepare*` constructs caller-cached state** (`prepareQuery`, `prepareCorrection`); noun and `*Of` accessors may memoise transparently (`unfoldTable`, `wordStartsOf`).
- **`prefer*`** names an asymmetric selection and its parameters carry the policy: `preferBetter(incumbent, challenger)` keeps the incumbent on ties unless it is fuzzy.
- **Raw/normalised pairs** always travel in `(raw, normalised)` order and take `raw*`/`normalised*` names when both are in scope.
- **Single letters** are for loop counters (`i`, `f`, `k`, `b`) and two-line comparators (`a`, `b`); everything else gets a word.
- **`SCREAMING_CASE`** for tuning constants (`SCORES`, `CHUNK_SCORES`, `DENSITY_FLOOR`, `TYPO_PENALTY`, `RESCUE_CUTOFF`).
- **EU spelling** in identifiers and prose alike (`normaliseText`, `NORMALISED_EXACT`); only platform builtins keep theirs (`String.prototype.normalize`).

## File map

One concern per file.

| File          | Concern                                                                         |
| ------------- | ------------------------------------------------------------------------------- |
| index.ts      | the public surface                                                              |
| types.ts      | the public types                                                                |
| scores.ts     | the tier ladder's constants, the typo penalty, and picking the better match     |
| boundaries.ts | word semantics: the char class, tokenisation, the boundary predicates           |
| normalise.ts  | the 1:1 fold, and its inverse table for the raw gate                            |
| gates.ts      | everything that may only false-pass: masks, bigram sets, raw-field scans, gates |
| query.ts      | the prepared query and the caches it carries                                    |
| ladder.ts     | the literal tiers                                                               |
| fuzzy.ts      | the fuzzy chain tier                                                            |
| correction.ts | what both correction engines share: floors, edits, edit distance, word offsets  |
| rescue.ts     | the one-edit typo rescue                                                        |
| readings.ts   | the second pass: corrections the one-edit rescue cannot make                    |
| match.ts      | matching one field, and `fuzzyMatch`                                            |
| fields.ts     | resolving and checking `createSearcher`'s fields                                |
| search.ts     | `createSearcher` and the collection cache                                       |
