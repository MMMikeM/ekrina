# Ekrina

**Tiny, typed fuzzy matching with ranked matches.**

[![npm](https://img.shields.io/npm/v/ekrina)](https://www.npmjs.com/package/ekrina)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/ekrina)](https://bundlephobia.com/package/ekrina)
[![license](https://img.shields.io/npm/l/ekrina)](https://github.com/MMMikeM/ekrina/blob/main/LICENSE)

A fuzzy matcher usually hands back a number.
Ranking on it is guesswork, highlighting means re-running the match yourself, and one transposed character makes the whole thing return nothing at all.
Ekrina returns a categorical `tier`, the numeric `ranges` to highlight, and a score whose scale is pinned by tests; it also corrects single-character typos, in ~5.5 kB with zero dependencies, on any runtime with ES2022.

- **Tells you how it matched.** Every match carries `tier`, `ranges` and `score`, so ranking, highlighting and "showing results for…" are all reads off the result.
- **Survives a typo.** A transposition, an insertion, a deletion or a substitution each break the subsequence property; the four one-edit tiers still take all three at rank 1.
- **Tops the match-quality scorecard.** 0.87 MRR on the mixed corpus at ~0.8 ms per query, against seven other libraries.
- **Runs anywhere.** No `node:` imports, no DOM, nothing above ES2022: browsers, Node, Deno, Bun and edge runtimes, ESM and CJS.
- **Stays small.** ~5.5 kB gzip, zero runtime dependencies, TS-first.

Corrects single-character typos, not general edit distance, in exchange for the size and speed.
Inspired by [@nozbe/microfuzz](https://github.com/Nozbe/microfuzz), [benchmarked](./docs/benchmarks.md) against it and six others, and there is a [migration diff](#migrating-from-nozbemicrofuzz) if you are coming from it.

## Install

```bash
npm i ekrina  # or pnpm add ekrina
```

Nothing in the package touches a platform global.
`src/` compiles against `lib: ["ES2022"]` alone, so there is no `node:crypto`, no `document`, and nothing to polyfill on Workers, Deno or Bun.
Both ESM and CJS ship, with types for each.

## Usage

### Searching a collection

```typescript
import { createFuzzySearch, SCORES } from "ekrina";

// array of strings
const search = createFuzzySearch(["apple", "banana", "cherry"]);
search("ban"); // [{ item: "banana", score: 0.5, fields: [...] }]

// objects: a function extracts the text to search
const byName = createFuzzySearch(users, (u) => u.name);
byName("john");

// multiple fields, per-field config
const posts = [
	{ title: "Banana bread", body: "best baked goods" },
	{ title: "Release notes", body: "banana picker shipped" },
];
const byField = createFuzzySearch(posts, [
	{ text: (p) => p.title },
	{ text: (p) => p.body, atBest: SCORES.CONTAINS }, // body's best hit ranks like a bare contains
]);
byField("ban");
// [
//   { item: posts[0], score: 0.5, fields: [{ score: 0.5, tier: "prefix", ranges: [[0, 2]] }, null] },
//   { item: posts[1], score: 2.5, fields: [null, { score: 2.5, tier: "prefix", ranges: [[0, 2]] }] },
// ]
// item score = the best field score; body scores are shifted by atBest (0.5 + 2 = 2.5),
// so the title hit leads even though both are prefix matches.
```

Results are sorted best-first (stable), and preprocessing is cached; the index is built on the first call and reused by every query after.

### Highlighting a result

`ranges` are `[start, end]` pairs, both inclusive, in ascending order, and they index the string you passed in rather than a normalised copy of it.
Slicing the original text is therefore the whole job, accents and casing included:

```typescript
import { createFuzzySearch, type HighlightRanges } from "ekrina";

const highlight = (text: string, ranges: HighlightRanges): string => {
	let html = "";
	let cursor = 0;
	for (const [start, end] of ranges) {
		html += `${text.slice(cursor, start)}<mark>${text.slice(start, end + 1)}</mark>`;
		cursor = end + 1;
	}
	return html + text.slice(cursor);
};

const commands = [
	{ title: "Open File…" },
	{ title: "Open Recent" },
	{ title: "Preferences: Open User Settings" },
	{ title: "Close Editor" },
];
const search = createFuzzySearch(commands, (c) => c.title);

for (const { item, fields } of search("opn")) {
	console.log(highlight(item.title, fields[0]?.ranges ?? []));
}
// <mark>Op</mark>e<mark>n</mark> File…
// <mark>Op</mark>e<mark>n</mark> Recent
// Preferences: <mark>Op</mark>e<mark>n</mark> User Settings
```

Every tier fills `ranges` the same way, so the one helper covers all of them: `"user open"` highlights both words in place (`Preferences: <mark>Open</mark> <mark>User</mark> Settings`), and a corrected query highlights what it actually found (`"recnet"` gives `Open <mark>Recent</mark>`, `tier: "corrected"`, `corrected: "recent"`).

In React the searcher is the memo boundary, so no hook is needed:

```typescript
const search = useMemo(() => createFuzzySearch(commands, (c) => c.title), [commands]);
const results = useMemo(() => search(query), [search, query]);
```

### Matching a single string

Scores one string against a query; reach for it directly when there is no list, e.g. matching inside a document.

```typescript
import { fuzzyMatch } from "ekrina";

fuzzyMatch("Hello World", "wor");
// { score: 1, tier: "boundary", ranges: [[6, 8]] }

fuzzyMatch("cherry", "xyz"); // null
```

Options: `fuzzyMatch(text, query, { acronym? })`.
`acronym: true` adds the initials tier (`rsaw` finds "Rath, Streich and Witting" at rank 1) for under a millisecond more per query.

## Where it fits

- **Command palettes and pickers**: `tier` + `ranges` rank and highlight results without reverse-engineering a score.
- **Search-as-you-type**: each keystroke rescans only the previous one's survivors, so the first keystroke is the slow one and the last runs over 4× faster, even over 100k items.
- **Filter UIs that show every match**: the narrowest result sets of the subsequence engines; a structured query returns a median of 7 rows where Fuse.js ships ~90.
- **Backend one-shot lookups**: constructor + first answer takes ~4.5 ms in a genuinely cold process over 10k items, so indexing per request is fine.
- **Finding a phrase inside a document**: `fuzzyMatch` scans 16,000 characters in 0.29 ms, and the density floor keeps absent words at exactly 0 false matches.

## Scores and tiers

Lower is better. Each match reports a numeric `score` (for sorting) and a categorical `tier`:

| score | tier               | meaning                                    |
| ----- | ------------------ | ------------------------------------------ |
| 0     | `exact`            | exact match                                |
| 0.1   | `normalised-exact` | case / diacritics-insensitive exact        |
| 0.5   | `prefix`           | starts with query                          |
| 0.9   | `boundary-exact`   | at a word boundary, exact case             |
| 1     | `boundary`         | at a word boundary                         |
| 1.5   | `multi-word`       | all query words present, any order         |
| 1.8   | `acronym`          | word initials (opt-in via `acronym: true`) |
| 2     | `contains`         | contains query anywhere                    |
| > 2   | `fuzzy`            | fuzzy chain (fewer chunks = better)        |
| +2.1  | `corrected`        | one-character typo fixed (`genric`)        |

A `corrected` match scores as the corrected query's tier + 2.1, which puts even a corrected exact hit above `contains` (2).
A correction is a guess at what you meant, so the literal hit always ranks first.
`score <= SCORES.CONTAINS` is therefore exactly "the query text appears here", and filtering to it opts out of typo matching entirely.

Import `SCORES` for thresholds and `atBest` values; or read `tier` directly:

```typescript
results.filter((r) => r.score <= SCORES.CONTAINS); // drop fuzzy chains and deep rescues
results.filter((r) => r.fields[0]?.tier !== "fuzzy"); // drop fuzzy chains only, categorically
```

A `corrected` match carries the fixed query, so you can say what you searched for:

```typescript
const top = results[0]?.fields[0];
if (top?.tier === "corrected") notice(`Showing results for ${top.corrected}`);
```

`atBest` shifts `score` but never `tier`, so tier filters stay reliable on demoted fields (a body-field prefix hit can report `score: 2.5, tier: "prefix"`).
All four typo tiers also score above `CONTAINS` (a rescued contains is 4.1) without being fuzzy chains, so filter by `tier` when you mean the kind of match.

> **Long text:** a fuzzy chain assembled from chunks scattered across a document is junk; unguarded, a word _absent_ from the text still "matches" 35% of the time by 512 chars, ~100% by 16k.
> The fuzzy tier refuses any assembly covering less than 18% of its span (measured junk density never exceeds 0.143, the sparsest genuine match is 0.211), which holds the junk rate at _0% at every measured length_ with label behaviour unchanged ([the long-text table](./docs/benchmarks.md#matching-inside-long-text)).

> **Acronym semantics:** apostrophes are word-internal: `People's` contributes one initial, `p`, so `lpdr` matches `Lao People's Democratic Republic`.
> Stopwords count too: `Democratic Republic of the Congo` is `drotc`, and `drc` matches nothing (the density floor rejects so sparse a chain).

## The fuzzy tier

Ekrina ships one opinionated fuzzy mode, always on, with no strategy knob: chunks must start at a word boundary or run 3+ characters (the query's last 1-2 characters are exempt, since a short tail could never satisfy the run rule), and the whole assembly must cover at least 18% of the span it stretches across (the density floor that keeps long text junk-free).
Anything it refuses either matched a higher tier already or wasn't worth showing; filter `tier === "fuzzy"` out of the results if you want literal matches only.

## Migrating from `@nozbe/microfuzz`

```diff
- import createFuzzySearch from "@nozbe/microfuzz";
+ import { createFuzzySearch } from "ekrina";

  // one field
- const search = createFuzzySearch(items, { key: "title" });
+ const search = createFuzzySearch(items, (item) => item.title);

  // several fields
- const search = createFuzzySearch(items, { getText: (i) => [i.title, i.body] });
+ const search = createFuzzySearch(items, [{ text: (i) => i.title }, { text: (i) => i.body }]);

  // reading a result
- for (const { item, matches } of search(query)) highlight(item.title, matches[0]);
+ for (const { item, fields } of search(query)) highlight(item.title, fields[0]?.ranges);
```

Six behavioural differences to know about:

- **`matches` became `fields`, and carries more than ranges.** microfuzz returns `Array<HighlightRanges | null>`, one entry per `getText` string. Ekrina returns `Array<MatchResult | null>`: the ranges are at `fields[i].ranges`, next to that field's own `score` and `tier`. The `[start, end]` inclusive convention is unchanged, so an existing highlight helper keeps working once it reads `.ranges`.
- **The scores are an API contract here.** microfuzz documents its values as "not an API contract, can change between releases"; the shared tiers happen to agree today. Ekrina exports them as `SCORES`, pins them in `test/tier-constants.test.ts`, and treats a changed score as a breaking change with a CHANGELOG entry.
- **There is no `strategy` option.** `'smart'` is the always-on behaviour. `'off'` becomes `results.filter((r) => r.score <= SCORES.CONTAINS)`, which is exactly "the query text appears here". `'aggressive'` has no equivalent on purpose: the density floor that refuses scattered chains is what holds the long-text junk rate at 0%.
- **Typos match now.** Same corpus, same twenty probes: 0.46 MRR to 0.84, almost all of it from the one-edit tiers ([the scorecard](./docs/benchmarks.md#scorecard)).
- **`normalizeText` is `normaliseText`.** EU spelling across the public surface, `splitWords` and `normaliseText` included.
- **No React hook.** microfuzz ships `useFuzzySearchList`; Ekrina doesn't, because the searcher is already the memo boundary. `useMemo(() => createFuzzySearch(list, getText), [list])` gives you the same caching, and the list of results is a second `useMemo` on the query.

Ekrina is ~5.5 kB gzip against microfuzz's ~1.7 kB, and adds an ESM build to microfuzz's CJS-only one.

## How it compares

At any realistic size these libraries all answer fast enough: a twenty-query session over 100,000 items averages ~3.4 ms per query after the first (~1 ms at 10k), every number measured in a fresh, cold process, and `fuzzyMatch` over a 16,000-character document takes 0.29 ms.
What separates them is _match quality_ and _what you get back_.

Each library at its best-scoring configuration, mixed corpus at 10k items, measured August 2026 (the exact versions are the devDependencies in [`bench/package.json`](./bench/package.json)):

| Library                     |    Gzip | Deps |  MRR | ms/query | Tiers | Ranges | Typos    |
| --------------------------- | ------: | ---: | ---: | -------: | :---: | :----: | -------- |
| **Ekrina** (acronym)        | ~5.5 kB |    0 | 0.87 | **0.81** |  🟢   |   🟢   | one edit |
| Fuse.js (all opts)          | ~9.3 kB |    0 | 0.81 |    17.11 |  🔴   |   🟡   | full     |
| fast-fuzzy                  |  ~11 kB |    1 | 0.59 |     7.41 |  🔴   |   🟡   | full     |
| uFuzzy (all opts)           | ~4.1 kB |    0 | 0.52 |     1.04 |  🔴   |   🟢   | one edit |
| @nozbe/microfuzz            | ~1.7 kB |    0 | 0.46 |     1.50 |  🔴   |   🟢   | 🔴       |
| fuzzysort                   | ~3.7 kB |    0 | 0.42 |     0.42 |  🔴   |   🟢   | 🔴       |
| fuzzy                       | ~0.8 kB |    0 | 0.35 |     1.92 |  🔴   |   🟡   | 🔴       |
| match-sorter                | ~3.4 kB |    2 | 0.32 |     3.03 |  🟢   |   🔴   | 🔴       |

**MRR** is the mean reciprocal rank of the queried item across 18 scored probes, top-10 cutoff.
**ms/query** is how long one query takes once the searcher has answered nineteen real ones, the search-as-you-type number.
Gzip is `esbuild --bundle --minify` tree-shaken to each library's primary API, which is why it reads lower than the bundlephobia badge above: that badge measures the whole published package.
The full matrix, every feature cell verified against the library's current source, is in [docs/benchmarks.md](./docs/benchmarks.md#libraries).

Accuracy against one whole cold search (index + one query) is the least flattering way to measure Ekrina, since a library with no constructor does no work up front (the frontend chart in [docs/benchmarks.md](./docs/benchmarks.md), query time only, is an Ekrina-only frontier):

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/pareto-total-dark.svg">
  <img alt="Mixed-corpus accuracy (MRR) vs. cold one-shot cost (constructor plus first answer in a fresh process, log scale) as a Pareto frontier. The frontier is fuzzy then Ekrina (acronym): Ekrina (acronym) scores 0.87 at ~4.7 ms one-shot, and everything else, including Fuse.js (all opts) at 0.81 and ~25 ms, is dominated." src="./docs/pareto-total-light.svg">
</picture>

Ekrina is the only library that by default:

- returns a categorical `tier` _and_ numeric `ranges`
- folds diacritics
- matches multi-word
- takes per-field config

It was written for matching in-memory lists on the client, and the cold-process numbers hold up for serverside work too.

### The evidence

Full method and data live in [docs/benchmarks.md](./docs/benchmarks.md).

- **Match quality**: Ekrina returns the smallest result set of the subsequence libraries and ranks the queried item _first on every structured query_; a one-char slip still matches, and at two dropped chars it returns nothing where its parent returns 67 junk chains.
  A transposition, an insertion and a substitution each break the subsequence property; Ekrina's four one-edit tiers take all three at rank 1 with a single row.
  A typo inside a phrase is corrected too: the words that do occur pin the field, and only the failing word is rescued. Two or more edits in one query remain the edit-distance engines' edge.
- **Speed, measured cold**: a twenty-query session (one searcher, twenty distinct queries, fresh process) runs 19 ms at 10k and 75 ms at 100k, the fastest of anything above 0.5 MRR, and ~4–47× under every typo-tolerant or tiered alternative, ~1–3.4 ms per query after the first.
  The whole preparation happens on the first query (~4.4 ms at 10k, ~17 ms at 100k), the cold column in [docs/benchmarks.md](./docs/benchmarks.md); only the bare-output engines (uFuzzy, and fuzzysort at 10k) run the session faster, at a fraction of the match quality.
  A prefix-narrowing cache makes each keystroke after the first faster as the phrase grows.

### What to pick

Pick Ekrina. It tops the quality scorecard on both benchmark corpora outright and runs the fastest realistic session of anything above 0.5 MRR at every published size.
At ~5.5 kB gzip it sits mid-pack on size, and the one-edit rescue machinery is where the quality lead comes from (the unfold table is generated from the fold logic at first use, not shipped). Fuse.js and fast-fuzzy are 1.7–2× larger.
One workload genuinely points elsewhere:

- **Typos beyond a single edit must still match** (user-typed queries over messy data): the four typo tiers cover every one-character mistake, but two or more edits in one query need real edit distance. Pick `Fuse.js` (Bitap) or `fast-fuzzy`, at 1.7–2× the bundle, ~7–20 ms queries, and ~90–450-row result sets.

The rest of the field is dominated on these benchmarks; the full argument, per-library, is in [the recommendation](./docs/benchmarks.md#the-recommendation).

## Other exports

- `normaliseText(text)`: lowercase, strip diacritics.
- `splitWords(text)`: tokenise on any non-alphanumeric run (keeps `_`).
- `SCORES`: the tier constants.
- `TYPO_PENALTY`: the 2.1 every `corrected` score adds to its corrected tier.

## Types

```typescript
type Range = [number, number]; // [start, end] inclusive
type HighlightRanges = Range[];
type Tier =
	| "exact"
	| "normalised-exact"
	| "prefix"
	| "boundary-exact"
	| "boundary"
	| "multi-word"
	| "acronym"
	| "contains"
	| "fuzzy"
	| "corrected";

type MatchResult = {
	score: number;
	tier: Tier;
	corrected?: string; // the fixed query, when tier is "corrected"
	ranges: HighlightRanges;
};

type FieldSpec<T> = {
	text: (item: T) => string | null;
	acronym?: boolean; // default false
	atBest?: number; // shifts this field's scores; its best possible hit ranks here
};

type FuzzyResult<T> = {
	item: T;
	score: number; // min effective score across fields
	fields: (MatchResult | null)[]; // one per field spec
};
```

## The name

Ancient Greek ἔκρινα, eh-KREE-na, "I sifted, I judged": the aorist of κρίνω, the root of criterion, discern, and critic.
It sifts a list and judges each candidate against a criterion.

## License

MIT
