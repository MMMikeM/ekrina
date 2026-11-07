# Changelog

## 2.0.0 (unreleased)

One matcher, which corrects far more than one character, named fields with one match per result, and seven renames.
Every score value and `TYPO_PENALTY` are unchanged, and `score <= SCORES.CONTAINS` still selects exactly the matches the query text appears in; what breaks is that the same query returns more `corrected` matches than 1.1.2 did, the shape of a result, and the seven names below.

- **`createFuzzySearch` is `createSearcher`, and its types are `Searcher` and `SearchResult`.**
  The old function name is shared with another library's default export, so code written for that library looked right here and failed at runtime; `Searcher` names what the function returns.
  `FuzzySearcher` is `Searcher` and `FuzzyResult` is `SearchResult`, because "fuzzy" is also the name of one tier, and every result, an `exact` match included, was typed as fuzzy.
  Rename the import and the two types; the behaviour is unchanged.
- **`Range` is `HighlightRange`.**
  `Range` is also the DOM's global type, which is half-open where these pairs are inclusive, and in a project with the DOM library an unimported `Range` meant the DOM's.
- **`FieldSpec.text` is `selectField`.**
  It was the one function on the public surface named like a value, and `text` is also the string `fuzzyMatch(text, query)` takes; the single-field form's parameter is `selectField` too.
  Rename `text:` to `selectField:` in each field spec.
- **`FieldSpec.atBest` is `demoteBy`.**
  The value is added to every score the field produces, which `atBest` hid by naming only where the field's best hit lands; the number and the mechanism are unchanged.
  A field spec with any key but `selectField`, `acronym` and `demoteBy`, the 1.x `text` and `atBest` included, a field without `selectField`, or anything but a field or a plain object of fields in their place (an array of field specs, a `Map`, a class instance, a string) throws a `TypeError`; before, `atBest` was ignored and the others failed with an unreadable message.
  So a misspelt `demotBy`, or a field written beside a lone spec's `selectField`, is an error rather than silently ignored.
  A negative, infinite or non-number `demoteBy` throws a `RangeError`, since a negative shift would carry a fuzzy or corrected match to or below `SCORES.CONTAINS`.
- **Several fields are named, and a result is its best field's match.**
  An object that names each field replaces the array of field specs: `createSearcher(posts, { title: (p) => p.title, body: { selectField: (p) => p.body, demoteBy: SCORES.CONTAINS } })`.
  A field is a function, or a spec when it needs options, and one spec alone, `{ selectField, acronym: true }`, is a single field with options.
  A result is `{ item, score, tier, ranges, text, corrected? }`, the best field's match with `text` the string `ranges` index, where 1.x returned `fields: (MatchResult | null)[]` and left the caller to find the field that set the score.
  With named fields, `field` names the best one and `fields` holds every field that matched, by name, each with its own `tier`, `ranges` and `text`.
  A tied score goes to the field whose match ends on a word boundary, then to the one named first, so a field can't be named like an integer, which JavaScript orders before the others, nor `selectField`, which marks a lone spec.
  `isLiteral(match)` says whether a match is of the query as typed, on demoted fields too.
  Pass an object where you passed an array, and read `result.tier` and `result.ranges` where you read `result.fields[0]`.
- **The `boundary-exact` tier is `boundary-cased`, and `SCORES.BOUNDARY_EXACT` is `SCORES.BOUNDARY_CASED`.**
  Everywhere else on the ladder "exact" means the whole field equals the query (`exact`, `normalised-exact`); this tier means a word starts with the query in the same case.
  Its score, 0.9, is unchanged.

- **Corrections reach further, when the query as typed matches poorly.**
  As well as one wrong, missing, extra or swapped character:
  - two mistakes in a word of eight letters or more, or one in each phrase word of five or more, at 2.1 each;
  - a space typed inside a word or left out between two, as one mistake;
  - a word typed sparsely, at least four of its letters in order from its first and covering half of it (`hget` for "Huguette"), scored just above `contains`;
  - a key held down, a run of three or more of one letter, as one mistake (`twaaain`);
  - two neighbouring letters swapped in a four-letter word, undone where the fix starts a word (`tahn` for "Than"), even beside a fuzzy chain that keeps other short corrections from running.

  A word read any of these ways reports `corrected` spelt as the field spells it.
  On the benchmark below MRR rises 0.70 → 0.91–0.92 on all three corpora, held-out queries rise with them (`bench/held-out.test.ts`), and the share of unanswerable queries answered stays at zero on every corpus.
  A query with ten or more literal matches skips them entirely, since the second pass runs only while fewer than ten items match literally (docs/performance.md).
  The bundle grows from ~6.4 kB to ~8.4 kB gzipped (esbuild, tree-shaken to `createSearcher`), and these corrections are most of it.
  The build mangles internal property names, and duplicated paths are merged into one; together they took the bundle from ~9.3 kB with every result unchanged, checked over 46,320 compared result lists and all 702 MRR cells.
- **Searching is faster than 1.1.2, corrections included, and holds about as much.**
  No query compiles a gate regex any more: a single word is gated by an `indexOf` scan, which ties the regex per test, and the raw-text gates anchor on `\w`, which compiles in a fraction of the time a `\p{L}` class does.
  Results are built once, for the page the sort keeps; the searcher keeps no per-item copy of trimmed text or of scores; and the raw scans read a table of non-ASCII character classes instead of folding each character.
  Against 1.1.2 a query takes 43% less once a searcher is warm (0.54–0.64 → 0.31–0.36 ms at 10k), a 100k session 11–16% less and a first answer 17–45% less, and a 100k searcher holds 1.15 MB rather than 1.91 MB until its first query and 0.1–0.35 MB more once it has answered a few (docs/benchmarks.md).
  Passing `limit` costs nothing: once `limit` items match literally, the rest skip the fuzzy chain, which takes about a fifth off one- to three-letter queries over a large list.
- **The benchmark measures real data.**
  The synthetic corpora are replaced by 100,000 well-known Wikidata entities under their English and their native names, and an emoji picker's labels and tags, with query families drawn from how people mistype, Wikipedia's list of common misspellings included, weighted by group before anything was measured.
  Each library also gets a junk rate, the share of queries no item answers that it answers anyway.
  On real text the long-text junk rate is 2–4% rather than the 0% measured on synthetic text, and `bench/longtext.test.ts` now holds it under a ceiling.
  The typing session times each keystroke once, in a fresh process, as a user types it: repeating one query in a process let V8 reuse the regexes it compiled, which no real keystroke can.
- **The package ships `dist/AGENTS.md`.**
  It lists the exports and the rules a coding agent needs to use them correctly, built from the docs site's page for AI coding agents.

## 1.1.2 (2026-11-02)

- **A query is matched on its first 256 characters, and one holding a word over 64 characters is never corrected.**
  Leading spaces don't count towards the 256, and the cut never splits a character.
  Before this, a query of a few thousand characters made the gate regex throw an uncaught `SyntaxError`, a single long word made typo correction cost time and memory quadratic in its length (0.4 s and ~220 MB at 1,000 characters), and a phrase with an absent word of 16,385 characters never returned.
  `test/hostile-text.test.ts` holds each hostile query shape from an external review, and `pnpm bench --quality` reproduces every published rank and MRR.
- **A phrase that repeats one word walks each field once.**
  Each copy resumes after the last, so a field whose word starts sit between mid-word hits is no longer rescanned per copy: 64 copies of `the` over 50 such fields went from 452 ms to 25 ms.
- **`fuzzyMatch` builds its gates only for a field that gets past the character check.**
  Matching every row of a list one call at a time no longer pays for gates most rows never reach, which matters most for a long query: 10,000 rows against a 256-character word went from 380 ms to under 10 ms.
- **The cache of rare-character folds is bounded**, so queries naming many distinct code points cannot grow it towards all of Unicode.

## 1.1.1 (2026-10-30)

- **A repeated word in a multi-word query needs its own occurrence.**
  `john john` no longer matches "John Smith" at the `multi-word` tier, and a phrase never returns two ranges over the same characters.
  Found by the property tests in `test/properties.test.ts`, which assert every range indexes the caller's string without overlap.

Releases are now staged on npm and go live only once a maintainer approves them with 2FA, and each GitHub Release carries a Sigstore attestation of its tarball.

## 1.1.0 (2026-10-30)

Scores and `Tier` strings are unchanged from 1.0.0.
Releases are published from CI through npm trusted publishing, with a provenance attestation; 1.0.0 was published by hand without one.
Matching text longer than 256 characters takes linear time in its length; in 1.0.0 a crafted text and query could take seconds at 64k characters (below).
A one-character query now returns its word-start matches, where 1.0.0 returned none.
`FuzzySearcher` is now a callable object carrying `buildIndex`, so a hand-written implementation of the type, a test mock for instance, needs that method too.

- **Long text is gated by a linear scan.**
  The pre-gate regex retries from every anchored start, so text full of starts that fail late took time quadratic in its length: 1.3 s for `aaab` over 64k characters, 6.4 s for a crafted 128k-character text, and 1.7 s inside a searcher over one such field.
  Past 256 characters the gate is now one pass checking the query's characters occur in order, which admits a superset of what the regex did, so results are unchanged and the same inputs answer in under 15 ms (`test/hostile-text.test.ts`).
- **Each word of a multi-word query only has to start a word of the field.**
  `woo handcrafted` matches "Handcrafted Wooden Chair" at the `multi-word` tier, so a phrase stays a literal match, in any order, while its last word is half-typed (docs/benchmarks.md, the two-words-partial-reversed family).
- **Within a score, a whole word ranks first.**
  A match that ends on a word boundary sorts ahead of one that stops inside a word, then list order, so `will` finds "Will Smith" before "Willa Corkery" and a correction that completes a word before one that doesn't; score values are unchanged.
  MRR rises 0.84 → 0.87 on both corpora (0.87 → 0.90 with acronyms), from the plain-word, typo and four-character typo families, measured before the sampled queries were limited to those three items or fewer could answer.
- **One character matches only where it starts a word.**
  Anywhere, one character matches most of any list; at word starts, a 100-item list returns a median of 9 rows per letter and 100k items about a quarter of the list.
  `fuzzyMatch` applies the same rule, so `fuzzyMatch("banana", "n")` is null.
- **`limit` skips matches that would be sliced off.**
  `search(query, { limit })` returns exactly what slicing the full results would, and once `limit` items match as typed, the fuzzy and corrected matches that score above them are never computed.
  Over mixed 100k, `ma` falls from 7.7 to 5.9 ms and `gra` from 3.5 to 2.8 ms at `limit: 10`; queries with fewer literal hits than the limit take as long as before.
  Sorting itself is quick: re-sorting 40,000 rows takes 0.4 ms.
- **`buildIndex()` runs the whole-corpus pass up front, on request.**
  Every query that doesn't extend its predecessor then filters on the masks instead of scanning the raw strings: over mixed 100k the mean first answer falls from 19.2 to 2.4 ms and the 24-query batch from 63 to 31 ms, with a 20.6 ms constructor and 0.8 MB more held from the start (docs/benchmarks.md, the `Ekrina (indexed)` rows).
  It stays opt-in because a searcher asked one question loses: constructor plus first answer is 23.4 ms against 19.6 ms lazy.
- **Below five characters, a correction is a fallback.**
  A four-character query is corrected only at a word start, never by dropping a character, and in the searcher only when no item matches it as typed.
  Inside a phrase whose other words reach five characters, a four-character word is corrected at a word start alongside matches as typed, because the other words pin the field: over 400 sampled phrases the right item ranked first 397 times, with no irrelevant rows.
  Correcting four characters everywhere sank `rsaw` from 2nd to 23rd, broke the long-text zero-junk guarantee and made short-query probes 2.9–3.8× slower at 100k.
  As a fallback it takes the four-character typo family from 0 to 0.59 on mixed and 0.79 on ascii, lifting MRR 0.82 → 0.84 and 0.80 → 0.84 with no other family moving, and makes a four-character miss take as long as a five-character one already did (docs/performance.md, "Short corrections are a fallback").
  `fuzzyMatch` sees one string, so it corrects whenever that string has no match as typed; a list can show fewer corrections than `fuzzyMatch` returns per item.
- **The ten-hit cutoff is the same for every list order.**
  The count covers the whole corpus before any correction is tried, so a result never depends on list order or on earlier searches (`test/search-history.test.ts`).
  The cutoff holds without a `limit` too: trying corrections anyway on uncapped searches changed no top ten, added hundreds of rows per affected query at 100k (`rmain` +1,031, mostly `rman` and `rain` inside unrelated words) and took 10–27% longer.
- **A substitution never puts a separator where a letter was**: `kepa` is not corrected to "ke a".

## 1.0.0 (2026-08-04)

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
  MRR of the intended item over the ascii corpus: insertion 0.004 → 0.998, substitution 0.000 → 0.996; deletion 0.968 via the fuzzy tier before the rescue existed, 0.962 ranked as a typo under the penalty.
- **Phrase rescues correct exactly one word.**
  A multi-word query with one absent word rescues that word alone and rescores the whole phrase; the literally-occurring words pin the candidate fields first, so enumeration runs over a handful of fields rather than the corpus.
  Two mistyped words stay unmatched by design, and `bench/longtext.test.ts` asserts a mistyped word beside a real one never invents a phrase match at any document length.
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
- **The fuzzy tier retries its first chunk from up to four admissible placements** and keeps the best-scoring assembly, so a query whose first character also opens an earlier word ("towls" hitting the T of "Tasty Silk Towels") is not stranded: 307 → 0 missed assemblies over the ascii bench corpus.
  Later chunks stay leftmost-greedy, because reconsidering those starts leaking junk.
- **The searcher prepares nothing up front and rescans survivors while you type.**
  Construction only allocates (~1 ms for a 100k list); a field is normalised and masked the first time it survives a gate, and the one whole-corpus pass (the union-and-bigram masks) waits for the first query that needs it (a second word, a character the raw scan cannot fold, or a correction), so a session of single words that match literally never runs it.
  A query extending the previous one rescans only the previous gate survivors, sound because every gate is monotone under query extension; typing `gra` → `grad` → `grady` over 100k items runs 2.3 → 1.3 → 0.6 ms per keystroke (the session table in docs/benchmarks.md at this release).
