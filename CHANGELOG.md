# Changelog

## 1.0.0 (unreleased)

Initial release, nothing has been published before this; earlier version numbers in git history were internal development stages.

Ekrina is a zero-dependency fuzzy matcher.
`fuzzyMatch` scores one string and returns `{ score, tier, ranges }`, and `createFuzzySearch` is a cached collection search built on it.
Scoring is lower = better, and `score <= SCORES.CONTAINS` is exactly "the query text appears here", everything above it is a fuzzy chain or a one-edit typo rescue, told apart by `tier`.

Design decisions worth recording, with the measurements that made them:

- **Typo corrections sort below every literal tier.**
  `TYPO_PENALTY` (2.1, exported) is added to the corrected query's tier, so even a corrected exact hit (2.1) sits under a true `contains` (2).
  A correction is a guess about what the user meant, so it ranks below a substring match of what they actually typed.
  With the penalty at 0.9 the guess won, and it was measurable, infix queries lost the intended item from MRR 0.973 to 0.906 as other items' corrections displaced it.
- **One `corrected` tier for every one-character edit** - swap ("geenric"), insertion ("generric"), deletion ("genric"), substitution ("genaric") - with `MatchResult.corrected` carrying the fixed query in the caller's casing.
  Which edit fired is derivable by diffing and nothing actionable branches on it.
  A substitution never puts a separator where a letter was: `kepa` is not corrected to "ke a".
  MRR of the intended item over the ascii corpus: insertion 0.004 → 0.998, substitution 0.000 → 0.996; deletion 0.968 via the fuzzy tier before the rescue existed, 0.962 ranked as a typo under the penalty.
- **Phrase rescues correct exactly one word.**
  A multi-word query with one absent word rescues that word alone and rescores the whole phrase; the literally-occurring words pin the candidate fields first, so enumeration runs over a handful of fields rather than the corpus.
  Two mistyped words stay unmatched by design, and `bench/longtext.test.ts` asserts a mistyped word beside a real one never invents a phrase match at any document length.
- **Each word of a multi-word query only has to start a word of the field.**
  `woo handcrafted` matches "Handcrafted Wooden Chair" at the `multi-word` tier, so a phrase stays a literal match, in any order, while its last word is half-typed (docs/benchmarks.md, the two-words-partial-reversed family).
- **A density floor instead of a strategy knob.**
  The fuzzy tier rejects any chunk assembly covering less than 18% of its span (measured junk chains ≤ 0.143 density, sparsest genuine match 0.211).
  Junk rate over document-length text: 5–98% across measured lengths → 0%, with label behaviour unchanged.
  Literal-only filtering stays a one-liner: drop results with `score > SCORES.CONTAINS`.
- **Gates may only false-pass.**
  The subsequence pre-gate anchors where the chunk assembler would actually start, cutting fields that reach the tier ladder by 32% (ascii) and 39% (mixed) with byte-identical result sets; `bench/funnel.test.ts` asserts the false-pass-only property per field.
- **A bigram gate on the rescue's relaxed scan.**
  A field missing exactly one of the query's character classes is only reachable by an edit at that class's sole query position, so every query bigram away from that position must be present in the field.
  Relaxed-scan admissions drop from 19.3% of a 100k corpus to 5.2% (ascii) and 16.7% to 3.2% (mixed), with result sets, ranks and MRR byte-identical (`bench/searcher-parity.test.ts`).
- **The rescue stops once ten literal hits exist.**
  No correction (≥ 2.1) can reach a top ten already filled at or below `SCORES.CONTAINS` (2), so the rescue becomes provably invisible work and is skipped.
  The count covers the whole corpus before any correction is tried, so a result never depends on list order or on earlier searches (`test/search-history.test.ts`).
  The cutoff holds without a `limit` too: trying corrections anyway on uncapped searches changed no top ten, added hundreds of rows per affected query at 100k (`rmain` +1,031, mostly `rman` and `rain` inside unrelated words) and took 10–27% longer.
- **Below five characters, a correction is a fallback.**
  A four-character query is corrected only at a word start, never by dropping a character, and in the searcher only when no item matches it as typed.
  Inside a phrase whose other words reach five characters, a four-character word is corrected at a word start alongside matches as typed, because the other words pin the field: over 400 sampled phrases the right item ranked first 397 times, with no irrelevant rows.
  Correcting four characters everywhere sank `rsaw` from 2nd to 23rd, broke the long-text zero-junk guarantee and made short-query probes 2.9–3.8× slower at 100k.
  As a fallback it takes the four-character typo family from 0 to 0.59 on mixed and 0.79 on ascii, lifting MRR 0.82 → 0.84 and 0.80 → 0.84 with no other family moving, and makes a four-character miss take as long as a five-character one already did (docs/performance.md, "Short corrections are a fallback").
  `fuzzyMatch` sees one string, so it corrects whenever that string has no match as typed; a list can show fewer corrections than `fuzzyMatch` returns per item.
- **The fuzzy tier retries its first chunk from up to four admissible placements** and keeps the best-scoring assembly, so a query whose first character also opens an earlier word ("towls" hitting the T of "Tasty Silk Towels") is not stranded: 307 → 0 missed assemblies over the ascii bench corpus.
  Later chunks stay leftmost-greedy, because reconsidering those starts leaking junk.
- **The searcher prepares nothing up front and rescans survivors while you type.**
  Construction only allocates (~1 ms for a 100k list); a field is normalised and masked the first time it survives a gate, and the one whole-corpus pass (the union-and-bigram masks) waits for the first query that needs it (a second word, a character the raw scan cannot fold, or a correction), so a session of single words that match literally never runs it.
  A query extending the previous one rescans only the previous gate survivors, sound because every gate is monotone under query extension; typing `gra` → `grad` → `grady` over 100k items runs 2.7 → 1.4 → 0.6 ms per keystroke (docs/benchmarks.md, session table).
- **Within a score, a whole word ranks first.**
  A match that ends on a word boundary sorts ahead of one that stops inside a word, then list order, so `will` finds "Will Smith" before "Willa Corkery" and a correction that completes a word before one that doesn't; score values are unchanged.
  MRR rises 0.84 → 0.87 on both corpora (0.87 → 0.90 with acronyms), from the plain-word, typo and four-character typo families (docs/benchmarks.md, the family tables).
- **One character matches only where it starts a word.**
  Anywhere, one character matches most of any list; at word starts, a 100-item list returns a median of 9 rows per letter and 100k items about a quarter of the list.
  `fuzzyMatch` applies the same rule, so `fuzzyMatch("banana", "n")` is null.
- **`limit` skips matches that would be sliced off.**
  `search(query, { limit })` returns exactly what slicing the full results would, and once `limit` items match as typed, the fuzzy and corrected matches that score above them are never computed.
  Over mixed 100k, `ma` falls from 7.7 to 5.9 ms and `gra` from 3.5 to 2.8 ms at `limit: 10`; queries with fewer literal hits than the limit take as long as before.
  Sorting itself is quick: re-sorting 40,000 rows takes 0.4 ms.
- **`buildIndex()` runs the whole-corpus pass up front, on request.**
  Every query that doesn't extend its predecessor then filters on the masks instead of scanning the raw strings: over mixed 100k the mean first answer falls from 26.5 to 4.3 ms and the 24-query batch from 73 to 44 ms, with a 22.9 ms constructor and 0.8 MB more held from the start (docs/benchmarks.md, the `Ekrina (indexed)` rows).
  It stays opt-in because a searcher asked one question loses: constructor plus first answer is 31.2 ms against 26.9 ms lazy.
