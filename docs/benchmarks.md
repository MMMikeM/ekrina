# Match quality and speed benchmarks

Full data behind the README's summary: what each library calls a match, where it ranks the right answer, and how long a query takes.
Every measured table here is generated from [`bench/results.json`](../bench/results.json) by `pnpm vpr bench`, and no measured cell is typed by hand.
[How the benchmarks are measured](./benchmarks/method.md) covers the harness, the corpora and the query families, and [Match quality, by query family](./benchmarks/families.md) has every family's scores.

## The recommendation

The recommendation is to _pick Ekrina for list matching_, with two carve-outs the data supports.

- **Quality**: Ekrina tops the scorecard on all three corpora<!-- bench:{{ assert(lt(highest("scorecard-native+scorecard-en+scorecard-emoji", "fast-fuzzy+Fuse.js (tuned)+uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy", "MRR"), lowest("scorecard-native+scorecard-en+scorecard-emoji", "Ekrina", "MRR")), "Ekrina scores the highest MRR on every corpus") }} --><!-- bench:end --> (<!-- bench:{{ cell("scorecard-en", "Ekrina", "MRR") }} -->0.92<!-- bench:end --> en, <!-- bench:{{ cell("scorecard-native", "Ekrina", "MRR") }} -->0.91<!-- bench:end --> native and emoji)<!-- bench:{{ assert(within(n("scorecard-native", "Ekrina", "MRR"), n("scorecard-emoji", "Ekrina", "MRR"), 0), "Ekrina scores the same MRR on native and emoji") }} --><!-- bench:end --> and answers none of the queries nothing answers<!-- bench:{{ assert(lt(highest("scorecard-native+scorecard-en+scorecard-emoji", "Ekrina+Ekrina (acronym)+Ekrina (indexed)", "Junk"), 0.5), "no Ekrina row answers a query nothing answers") }} --><!-- bench:end -->; the nearest rows<!-- bench:{{ assert(lt(highest("scorecard-native", "uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy", "MRR"), lowest("scorecard-native", "fast-fuzzy+Fuse.js (tuned)", "MRR")), "fast-fuzzy and Fuse.js (tuned) are the next rows on quality after Ekrina") }} --><!-- bench:end -->, fast-fuzzy and Fuse.js (tuned), answer <!-- bench:{{ fractions(div(lowest("scorecard-native+scorecard-en+scorecard-emoji", "fast-fuzzy+Fuse.js (tuned)", "Junk"), 100), div(highest("scorecard-native+scorecard-en+scorecard-emoji", "fast-fuzzy+Fuse.js (tuned)", "Junk"), 100)) }} -->a quarter to a half<!-- bench:end --> of them.
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
Each library's base row is what installing it gives you, and for two of them it scores lower: uFuzzy <!-- bench:{{ cell("library-ufuzzy-scorecard-native", "uFuzzy", "MRR") }} -->0.21<!-- bench:end --> MRR rather than <!-- bench:{{ cell("scorecard-native", "uFuzzy (all opts)", "MRR") }} -->0.66<!-- bench:end -->, and Fuse.js <!-- bench:{{ cell("library-fuse-scorecard-native", "Fuse.js", "MRR") }} -->0.72<!-- bench:end --> rather than <!-- bench:{{ cell("scorecard-native", "Fuse.js (tuned)", "MRR") }} -->0.76<!-- bench:end -->.<!-- bench:{{ assert(lt(n("library-ufuzzy-scorecard-native", "uFuzzy", "MRR"), n("scorecard-native", "uFuzzy (all opts)", "MRR")), "uFuzzy's base row scores lower than its headline row") }} --><!-- bench:end --><!-- bench:{{ assert(lt(n("library-fuse-scorecard-native", "Fuse.js", "MRR"), n("scorecard-native", "Fuse.js (tuned)", "MRR")), "Fuse.js scores higher tuned than on its defaults") }} --><!-- bench:end -->
Every other configuration is on its library's own page, against the rest of that library's: [Ekrina](./libraries/ekrina.md), [Fuse.js](./libraries/fuse.md), [uFuzzy](./libraries/ufuzzy.md), [fast-fuzzy](./libraries/fast-fuzzy.md), [@nozbe/microfuzz](./libraries/microfuzz.md) and [fuzzy](./libraries/fuzzy.md).
An "(all opts)" row shares its base library's size, deps, and type.
Ekrina's opt-in row is named after the option it switches on: **(acronym)** for `acronym: true` on its field spec.
**Ekrina (indexed)** is the defaults with `buildIndex()` called up front, so its results are Ekrina's and only its timings differ.
A "(tuned)" row is an "(all opts)" row with its settings chosen by a sweep against an earlier version of this bench, and Fuse.js has the only one: at `threshold` <!-- bench:{{ constant("0.45") }} -->0.45<!-- bench:end --> it scores <!-- bench:{{ cell("scorecard-native", "Fuse.js (tuned)", "MRR") }} -->0.76<!-- bench:end --> on both Wikidata corpora against the default's <!-- bench:{{ cell("library-fuse-scorecard-native", "Fuse.js", "MRR") }} -->0.72<!-- bench:end --><!-- bench:{{ assert(within(n("scorecard-native", "Fuse.js (tuned)", "MRR"), n("scorecard-en", "Fuse.js (tuned)", "MRR"), 0), "Fuse.js (tuned) scores the same on both Wikidata corpora") }} --><!-- bench:end -->, and returns <!-- bench:{{ probeCount("native", "gensler", "fuse.js (tuned)") }} -->73<!-- bench:end --> rows for `gensler` ([Fuse.js](./libraries/fuse.md)).

## How to read these numbers

Every time comes from a fresh Node process per sample, so the JIT and every cache start empty and nothing carries over between cells; each published cold cell is the median of three such processes.
A batch answers one warm-up query and then 24 distinct representative queries once each, the way a session does.
Which column matters depends on workload: search-as-you-type → **per query**; a page that builds a searcher and answers a handful of queries → **session total**; a backend one-shot over fresh data → **one-shot**; a first-keystroke latency budget over a prebuilt index → **cold query**.
Read sub-<!-- bench:{{ constant("15%") }} -->15%<!-- bench:end --> differences as statistical ties, the tie band from here on, and larger ones as real.
[One measurement model](./benchmarks/method.md#one-measurement-model) defines every column, and [Timing method](./benchmarks/method.md#timing-method) the guards on a run.

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
Its query families and their weights ([The corpora and the query families](./benchmarks/method.md#the-corpora-and-the-query-families)) are the mistakes Ekrina was designed to forgive, chosen by its author.
Every library is scored by the same rules, each at its best-scoring configuration, but which mistakes count is a statement of what Ekrina is for: if your users make different ones, read the families one by one ([Match quality, by query family](./benchmarks/families.md)) rather than the headline.

The timings lean both ways:

- **per query** leaves every constructor out and lets the warm-up absorb first-contact setup, which suits libraries that index up front, and fuzzysort, whose prepare-all lands in the warm-up.
  Lazy Ekrina's mask build stays inside it, which is why Ekrina takes <!-- bench:{{ cell("batch-native", "Ekrina", "per query") }} -->1.96 ms<!-- bench:end --> per query on native at 100k against Ekrina (indexed)'s <!-- bench:{{ cell("batch-native", "Ekrina (indexed)", "per query") }} -->1.43 ms<!-- bench:end --><!-- bench:{{ assert(gt(n("batch-native", "Ekrina", "per query"), n("batch-native", "Ekrina (indexed)", "per query")), "lazy Ekrina is slower per query than Ekrina (indexed)") }} --><!-- bench:end -->.
- **session total** charges each design for its setup wherever it pays it; read it beside per query when a searcher answers only a handful of queries.
- **cold query** includes Ekrina's mask build whenever the query needs one; Ekrina (indexed) shows the same work moved into its constructor.
- **typing** shows Ekrina's survivor cache, the design choice that makes each keystroke cheaper than the last: Ekrina's time per keystroke falls <!-- bench:{{ times(div(sessionMs("ekrina", "hin"), sessionMs("ekrina", "hinto")), 1) }} -->16.0×<!-- bench:end --> across `hinton`.

## Scorecard

One line per configuration: MRR and junk from [`bench/hits.test.ts`](../bench/hits.test.ts) (ranks are deterministic, measured once, untimed), times from the process-cold matrix ([Timing method](./benchmarks/method.md#timing-method); `pnpm vpr bench --all --runs=N` sets the processes per cell).
**MRR** = the group-weighted mean of the 33 scored families' MRR@10 ([The corpora and the query families](./benchmarks/method.md#the-corpora-and-the-query-families)): ten queries each, scored by the rank of the first relevant result, misses and ranks outside the top 10 scoring 0.
**junk** = the share of the 100 queries nothing answers that the library answered anyway, averaged over the five kinds.
**index ms** = the constructor call (from the batch cell's fresh processes).
**cold ms** = the mean first-answer time across the six timed queries, each in its own fresh process.
**session ms** = the constructor plus one fresh process answering a warm-up match and then every representative query once: the realistic session, setup included wherever the library pays it.
**per query** = the mean of the 24 queries after the warm-up: how long a query takes once the searcher has answered real queries.

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

**emoji corpus**, timed at its whole 1,923 items rather than 10k.
**Its timings cannot rank the libraries**: a whole session here takes as little as <!-- bench:{{ fixed(lowest("scorecard-emoji", "Ekrina+Ekrina (indexed)+Ekrina (acronym)+fast-fuzzy+Fuse.js (tuned)+uFuzzy (all opts)+fuzzysort+@nozbe/microfuzz+match-sorter+fuzzy", "session ms"), 2) }} -->8.67<!-- bench:end --> ms, short enough that run-to-run noise can reorder neighbouring rows.
They are shown for completeness; the en and native corpora carry the speed comparison.

<!-- bench:scorecard-emoji -->
| Library           |  MRR | Junk | index ms | cold ms | session ms | per query |
|-------------------|-----:|-----:|---------:|--------:|-----------:|----------:|
| Ekrina            | 0.91 |   0% |     0.17 |    3.41 |      18.76 |      0.57 |
| Ekrina (indexed)  | 0.91 |   0% |     1.28 |    2.22 |      18.20 |      0.55 |
| Ekrina (acronym)  | 0.91 |   0% |     0.18 |    4.03 |      20.46 |      0.58 |
| fast-fuzzy        | 0.84 |  26% |    12.31 |   11.19 |     116.51 |      3.90 |
| Fuse.js (tuned)   | 0.71 |  35% |     0.74 |    5.56 |      93.30 |      3.60 |
| uFuzzy (all opts) | 0.65 |   0% |     4.11 |    1.18 |      20.27 |      0.63 |
| fuzzysort         | 0.52 |  25% |     0.03 |    3.06 |       8.67 |      0.22 |
| @nozbe/microfuzz  | 0.47 |  24% |     2.00 |    0.85 |      15.75 |      0.54 |
| match-sorter      | 0.45 |  24% |     0.03 |    5.13 |      48.46 |      1.75 |
| fuzzy             | 0.39 |  24% |     0.03 |    1.22 |      18.78 |      0.73 |
<!-- bench:end -->

The scorecard's timing columns are exactly what the Pareto charts draw, one per workload; both draw the native 10k scorecard.

**Frontend workload** (one searcher answers every keystroke, so its index, built at load or by the first query that needs it, is paid once per session):

<!-- bench:pareto-query-picture -->
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./pareto-query-dark.svg">
  <img alt="Scatter plot of eight JavaScript fuzzy search libraries, each at its best-scoring configuration and Ekrina in three, comparing MRR (how highly each ranks the queried item) against mean milliseconds per query across one searcher's 24-query session, after a warm-up that takes each library's one-time setup except lazy Ekrina's index build, on a log scale, on the native 10k corpus over 33 query families. The Pareto frontier runs fuzzysort (0.46 MRR at 0.24 ms) to Ekrina (indexed) (0.91 MRR at 0.31 ms). Ekrina owns the accurate end of the frontier; its faster end is markedly less accurate, and every other configuration, including Fuse.js, is dominated." src="./pareto-query-light.svg">
</picture>
<!-- bench:end -->

fuzzysort owns the fast end, <!-- bench:{{ cell("scorecard-native", "fuzzysort", "MRR") }} -->0.46<!-- bench:end --> MRR at <!-- bench:{{ cell("scorecard-native", "fuzzysort", "per query") }} -->0.24<!-- bench:end --> ms with bare output<!-- bench:{{ assert(lt(n("scorecard-native", "fuzzysort", "per query"), lowest("scorecard-native", "Ekrina+Ekrina (acronym)+Ekrina (indexed)+fast-fuzzy+Fuse.js (tuned)+uFuzzy (all opts)+@nozbe/microfuzz+match-sorter+fuzzy", "per query")), "fuzzysort answers fastest per query") }} --><!-- bench:end -->, and Ekrina (indexed) reaches <!-- bench:{{ cell("scorecard-native", "Ekrina (indexed)", "MRR") }} -->0.91<!-- bench:end --> at <!-- bench:{{ cell("scorecard-native", "Ekrina (indexed)", "per query") }} -->0.31<!-- bench:end --> ms; uFuzzy (all opts), at <!-- bench:{{ cell("scorecard-native", "uFuzzy (all opts)", "MRR") }} -->0.66<!-- bench:end --> MRR and <!-- bench:{{ cell("scorecard-native", "uFuzzy (all opts)", "per query") }} -->0.63<!-- bench:end --> ms, is slower than every Ekrina row<!-- bench:{{ assert(gt(n("scorecard-native", "uFuzzy (all opts)", "per query"), highest("scorecard-native", "Ekrina+Ekrina (acronym)+Ekrina (indexed)", "per query")), "uFuzzy (all opts) is slower per query than every Ekrina row") }} --><!-- bench:end --> and below them on quality.<!-- bench:{{ assert(lt(n("scorecard-native", "uFuzzy (all opts)", "MRR"), lowest("scorecard-native", "Ekrina+Ekrina (acronym)+Ekrina (indexed)", "MRR")), "uFuzzy (all opts) scores below every Ekrina row") }} --><!-- bench:end -->

**Backend one-shot workload** (a fresh process runs constructor + first answer): the chart is in [the comparison](./compare.md), which shows it deliberately, since it is the less flattering of the two Pareto charts.

## Size, speed & search type

Every cell is process-cold ([One measurement model](./benchmarks/method.md#one-measurement-model)), and each corpus gets two tables.
The scale table measures the one-shot workload: **index** = the constructor, **cold query** = mean first answer across the six timed queries (each in its own fresh process), **total** = the mean of constructor + first answer, summed inside each query's own child, **total rel** = that total relative to Ekrina (<!-- bench:{{ constant("100%") }} -->100%<!-- bench:end --> = same, lower = faster).
The batch table reads cold to warm and ends on what it ranks by: **build** = the constructor, **first answer** = the warm-up, **session total** = all of them together, **per query** = the mean of the 24 queries after the warm-up, **per query rel** = that relative to Ekrina.
These tables publish the 100k size, and emoji's its whole 1,923 items; the 10k matrix and the scorecard carry the fine-grained view, and every cell of both sits in [`bench/results.json`](../bench/results.json).
The three corpora are described in [The corpora and the query families](./benchmarks/method.md#the-corpora-and-the-query-families); they're benched separately.
The native table only lists configurations that fold diacritics, i.e. actually do that corpus's task (cross-checked per query by [`bench/hits.test.ts`](../bench/hits.test.ts)); a fast non-folding row would be fast at a different, easier job, so those are omitted and named below the table.
The **_all libraries_** row is the corpus-wide view: the geometric mean of every shown configuration at that size.
**(all opts)** rows switch on every opt-in the library has: diacritic folding, multi-word, highlight/ranges output, and typo modes; base rows are stock defaults, and [Configurations](./benchmarks/method.md#configurations) itemises which opt-in is which.
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
`tfts` is the exception because Ekrina (acronym) matches it literally and never builds the whole-list mask index for it, where Ekrina does (the third case under [the backend one-shot chart](./benchmarks/method.md#the-backend-one-shot-workload)).

Omitted: fast-fuzzy and fuzzy, which have no folding option at all, and the base rows of uFuzzy and Fuse.js.

### emoji corpus, unranked

The whole 1,923-item list, timed the same way as the other two corpora but at its own length.
That is too short to rank speed on, so these rows have no geomean, appear in the scorecard only under its warning, and stay out of the Pareto charts and the library pages.

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

### Reading the speed numbers

The **batch** column is the headline: one process, 24 distinct queries, so it shows whether the amortisation each design promises actually happens.
_Ekrina (indexed) runs the fastest session at 100k among the configurations above 0.5 MRR_<!-- bench:{{ assert(gt(lowest("scorecard-native+scorecard-en", "Ekrina+Ekrina (acronym)+fast-fuzzy+Fuse.js (tuned)+uFuzzy (all opts)", "MRR"), 0.5), "the rows compared score above 0.5 MRR") }} --><!-- bench:end --><!-- bench:{{ assert(lt(highest("scorecard-native+scorecard-en", "@nozbe/microfuzz+fuzzysort+match-sorter+fuzzy", "MRR"), 0.5), "the rows left out score under 0.5 MRR") }} --><!-- bench:end --><!-- bench:{{ assert(lt(n("batch-en", "Ekrina (indexed)", "session total"), lowest("batch-en", "Ekrina+Ekrina (acronym)+fast-fuzzy+Fuse.js (tuned)+uFuzzy (all opts)", "session total")), "Ekrina (indexed) runs the fastest en session above 0.5 MRR") }} --><!-- bench:end --><!-- bench:{{ assert(lt(n("batch-native", "Ekrina (indexed)", "session total"), lowest("batch-native", "Ekrina+Ekrina (acronym)+Fuse.js (tuned)+uFuzzy (all opts)", "session total")), "Ekrina (indexed) runs the fastest native session above 0.5 MRR") }} --><!-- bench:end -->: <!-- bench:{{ pct(div(n("batch-en", "Ekrina (indexed)", "session total"), n("batch-en", "Ekrina", "session total"))) }} -->85%<!-- bench:end --> of Ekrina's time on en and <!-- bench:{{ pct(div(n("batch-native", "Ekrina (indexed)", "session total"), n("batch-native", "Ekrina", "session total"))) }} -->84%<!-- bench:end --> on native.
Folding uFuzzy, at <!-- bench:{{ span(lowest("scorecard-native+scorecard-en", "uFuzzy (all opts)", "MRR"), highest("scorecard-native+scorecard-en", "uFuzzy (all opts)", "MRR"), 2) }} -->0.66<!-- bench:end --> MRR to Ekrina's <!-- bench:{{ span(lowest("scorecard-native+scorecard-en", "Ekrina", "MRR"), highest("scorecard-native+scorecard-en", "Ekrina", "MRR"), 2) }} -->0.91–0.92<!-- bench:end -->, takes longer than Ekrina over the session once its constructor counts<!-- bench:{{ assert(gt(mul(min(div(n("batch-native", "uFuzzy (all opts)", "session total"), n("batch-native", "Ekrina", "session total")), div(n("batch-en", "uFuzzy (all opts)", "session total"), n("batch-en", "Ekrina", "session total"))), 100), 115), "folding uFuzzy's session is outside the tie band of Ekrina's") }} --><!-- bench:end -->, at <!-- bench:{{ pct(div(n("batch-en", "uFuzzy (all opts)", "session total"), n("batch-en", "Ekrina", "session total"))) }} -->130%<!-- bench:end --> of its time on en and <!-- bench:{{ pct(div(n("batch-native", "uFuzzy (all opts)", "session total"), n("batch-native", "Ekrina", "session total"))) }} -->120%<!-- bench:end --> on native.
Cross-_type_ speed isn't apples-to-apples: **typo-tolerant** libs (Fuse.js, fast-fuzzy) do far more work per query, and non-folding configurations are omitted from the native table entirely (they would be timing a different task).
Results are identical in any script, but the mask index cannot tell non-Latin letters apart, so on non-Latin text a keystroke that scans the whole list scores every item in it, though an extending keystroke still rescans only the items the last one let through (`bench/non-latin.test.ts`, over a Cyrillic copy of the corpus).

## Build time

<!-- bench:build -->
| build |  Ekrina | Ekrina (indexed) | @nozbe/microfuzz | fast-fuzzy | Fuse.js | uFuzzy (all opts) |
|-------|--------:|-----------------:|-----------------:|-----------:|--------:|------------------:|
| 10k   | 0.17 ms |          2.13 ms |          4.50 ms |   27.86 ms | 1.09 ms |           4.33 ms |
| 100k  | 0.23 ms |          8.53 ms |         51.83 ms |  323.48 ms | 5.51 ms |           8.43 ms |
<!-- bench:end -->

Measured on the native corpus (process-cold constructor timings; build time barely differs between corpora).
Ekrina's constructor only allocates - field text is trimmed, normalised and masked the first time an item survives a gate - so a 100k list swap takes under half a millisecond (<!-- bench:{{ cell("build", "100k", "Ekrina") }} -->0.23 ms<!-- bench:end -->)<!-- bench:{{ assert(lt(n("build", "100k", "Ekrina"), 0.5), "a 100k Ekrina list swap takes under half a millisecond") }} --><!-- bench:end -->, and the first query then carries what construction deferred (its cold cells).

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
**dropped MB** is what is still retained once the searcher is unreachable and collected.
fuzzysort retains nothing until its first `go()` fills its `prepare()` cache, which is process-wide and unevicted, so its **dropped** column equals its footprint<!-- bench:{{ assert(within(n("memory", "fuzzysort", "dropped MB"), n("memory", "fuzzysort", "+ `gensler`"), 0), "fuzzysort's dropped footprint equals its retained one") }} --><!-- bench:end --> until you call `cleanup()`.

## Typing `hinton` at 100k

While typing, each query extends the last.
Ekrina's prefix-narrowing cache rescans only the previous query's mask-gate survivors, so successive keystrokes get faster<!-- bench:{{ assert(gt(min(sub(n("session", "Ekrina", "`hin`"), n("session", "Ekrina", "`hint`")), sub(n("session", "Ekrina", "`hint`"), n("session", "Ekrina", "`hinto`"))), 0), "each Ekrina keystroke is faster than the one before") }} --><!-- bench:end -->.
Every other library scans the whole list per keystroke; fuzzysort's later keystrokes are cheaper only because its first one prepared every target.

<!-- bench:session -->
| Library            | `hin` | `hint` | `hinto` | session |
|--------------------|------:|-------:|--------:|--------:|
| Ekrina             |  4.02 |   1.28 |    0.25 |    5.55 |
| @nozbe/microfuzz   | 14.87 |  12.84 |   12.18 |   39.88 |
| fuzzysort          |  8.90 |   3.51 |    2.64 |   15.06 |
| uFuzzy (all opts)  |  5.50 |   1.86 |    2.33 |    9.70 |
| Fuse.js (all opts) | 90.14 | 119.52 |  125.13 |  334.79 |
<!-- bench:end -->

Measured by [`bench/session.test.ts`](../bench/session.test.ts).

## Matching inside long text

Everything above matches short labels in a list; the other workload is `fuzzyMatch` over one large string, a document.

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
Literal-only matching, for callers that want no fuzzy assemblies or corrections at all, is a one-line `isLiteral` filter.
