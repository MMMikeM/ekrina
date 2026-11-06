# Ekrina

**Lazy where it counts.**

<p>
<a href="https://www.npmjs.com/package/ekrina"><picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/npm/v/ekrina?style=flat-square&colorA=151b23&colorB=7c5cff"><img alt="npm" src="https://img.shields.io/npm/v/ekrina?style=flat-square&colorA=f6f8fa&colorB=7c5cff"></picture></a>
<a href="https://github.com/MMMikeM/ekrina/blob/main/LICENSE"><picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/npm/l/ekrina?style=flat-square&colorA=151b23&colorB=7c5cff"><img alt="license" src="https://img.shields.io/npm/l/ekrina?style=flat-square&colorA=f6f8fa&colorB=7c5cff"></picture></a>
</p>

<p>
<a href="https://github.com/MMMikeM/ekrina/actions/workflows/ci.yml"><picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/github/actions/workflow/status/MMMikeM/ekrina/ci.yml?branch=main&label=CI&logo=githubactions&style=flat-square&colorA=151b23&logoColor=f0f6fc"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/MMMikeM/ekrina/ci.yml?branch=main&label=CI&logo=githubactions&style=flat-square&colorA=f6f8fa&logoColor=1f2328"></picture></a>
<a href="https://github.com/MMMikeM/ekrina/actions/workflows/node.yml"><picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/github/actions/workflow/status/MMMikeM/ekrina/node.yml?branch=main&label=Node%2018%2B&logo=nodedotjs&style=flat-square&colorA=151b23&logoColor=f0f6fc"><img alt="Node 18+" src="https://img.shields.io/github/actions/workflow/status/MMMikeM/ekrina/node.yml?branch=main&label=Node%2018%2B&logo=nodedotjs&style=flat-square&colorA=f6f8fa&logoColor=1f2328"></picture></a>
<a href="https://github.com/MMMikeM/ekrina/actions/workflows/deno.yml"><picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/github/actions/workflow/status/MMMikeM/ekrina/deno.yml?branch=main&label=Deno&logo=deno&style=flat-square&colorA=151b23&logoColor=f0f6fc"><img alt="Deno" src="https://img.shields.io/github/actions/workflow/status/MMMikeM/ekrina/deno.yml?branch=main&label=Deno&logo=deno&style=flat-square&colorA=f6f8fa&logoColor=1f2328"></picture></a>
<a href="https://github.com/MMMikeM/ekrina/actions/workflows/bun.yml"><picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/github/actions/workflow/status/MMMikeM/ekrina/bun.yml?branch=main&label=Bun&logo=bun&style=flat-square&colorA=151b23&logoColor=f0f6fc"><img alt="Bun" src="https://img.shields.io/github/actions/workflow/status/MMMikeM/ekrina/bun.yml?branch=main&label=Bun&logo=bun&style=flat-square&colorA=f6f8fa&logoColor=1f2328"></picture></a>
</p>

<p>
<a href="https://bundlejs.com/?q=ekrina"><picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fdeno.bundlejs.com%2F%3Fq%3Dekrina&query=%24.size.compressedSize&label=minzipped%20size&style=flat-square&colorA=151b23&colorB=3369ff"><img alt="minzipped size" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fdeno.bundlejs.com%2F%3Fq%3Dekrina&query=%24.size.compressedSize&label=minzipped%20size&style=flat-square&colorA=f6f8fa&colorB=3369ff"></picture></a>
<a href="https://github.com/MMMikeM/ekrina/actions/workflows/ci.yml"><picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/coverage-100%25-gray?style=flat-square&colorA=151b23&colorB=3369ff"><img alt="coverage 100%" src="https://img.shields.io/badge/coverage-100%25-gray?style=flat-square&colorA=f6f8fa&colorB=3369ff"></picture></a>
<a href="https://scorecard.dev/viewer/?uri=github.com/MMMikeM/ekrina"><picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/ossf-scorecard/github.com/MMMikeM/ekrina?label=OpenSSF%20Scorecard&style=flat-square&colorA=151b23"><img alt="OpenSSF Scorecard" src="https://img.shields.io/ossf-scorecard/github.com/MMMikeM/ekrina?label=OpenSSF%20Scorecard&style=flat-square&colorA=f6f8fa"></picture></a>
<a href="https://www.bestpractices.dev/projects/16088"><picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/cii/level/16088?label=OpenSSF%20Best%20Practices&style=flat-square&colorA=151b23"><img alt="OpenSSF Best Practices" src="https://img.shields.io/cii/level/16088?label=OpenSSF%20Best%20Practices&style=flat-square&colorA=f6f8fa"></picture></a>
</p>

A fuzzy matcher usually hands back a number.
Ranking on it is guesswork, highlighting means re-running the match yourself, and one transposed character makes the whole thing return nothing at all.

Ekrina tells you how every result matched: a `tier` such as `prefix`, `fuzzy` or `corrected`, the `ranges` to highlight in your own string, and a score you can filter on.
It corrects up to two mistakes per query and says when it did, but only guesses when the query as typed comes up short, and it returns nothing for nonsense.
It does only the work each query needs, has no dependencies, and runs on anything with ES2022.

To see it first, [search the emoji](https://ekrina.thelazyweb.dev/) on the docs site's home page, which runs this library in your browser.

```bash
npm install ekrina
```

## From zero to a search

**1. Build a searcher once, and call it with each query.**

```typescript
import { createSearcher } from "ekrina";

const commands = [
	{ id: "file.open", title: "Open File…" },
	{ id: "file.openRecent", title: "Open Recent" },
	{ id: "settings.open", title: "Preferences: Open User Settings" },
];

const search = createSearcher(commands, (command) => command.title);
```

**2. Read how each result matched.** Lower scores are better, and results come back best first.

```typescript
search("settings");
// [{
//   item: { id: "settings.open", title: "Preferences: Open User Settings" },
//   score: 1,
//   fields: [{ score: 1, tier: "boundary", ranges: [[23, 30]] }],
// }]
```

`ranges` index the string you passed in, so highlighting is slicing it, escaped if it goes into HTML ([highlighting](https://ekrina.thelazyweb.dev/guides/highlight/)).

**3. Say when it corrected a typo.**

```typescript
const [top] = search("recnet");
// top.fields[0]: { score: 3.1, tier: "corrected", corrected: "recent", ranges: [[5, 10]] }

if (top?.tier === "corrected") {
	showNotice(`Showing results for ${top.corrected}`);
}
```

A correction always comes after every match of the query as typed, and `search("qxzwkv")` returns `[]`.

## How it compares

Each library at its best-scoring configuration, on 10,000 real Wikidata names under their native spellings:

<!-- bench:compare -->
| Library           |  MRR |    ms | Gzip kB | Junk | Typos     | Tiers | Ranges  | Deps |
|-------------------|-----:|------:|--------:|-----:|-----------|:-----:|:-------:|-----:|
| **Ekrina**        | 0.91 |  1.06 |     8.2 |   0% | ≤ 2 edits |  yes  |   yes   |    0 |
| fast-fuzzy        | 0.81 |  6.20 |    11.1 |  24% | any       |  no   | partial |    1 |
| Fuse.js (tuned)   | 0.76 | 12.21 |     9.6 |  47% | any       |  no   | opt-in  |    0 |
| uFuzzy (all opts) | 0.66 |  0.64 |     4.3 |   0% | ≤ 1 edit  |  no   |   yes   |    0 |
| fuzzysort         | 0.46 |  0.41 |     3.7 |   7% | none      |  no   |   yes   |    0 |
| @nozbe/microfuzz  | 0.41 |  2.10 |     1.7 |   7% | none      |  no   |   yes   |    0 |
| match-sorter      | 0.39 |  2.70 |     3.6 |   7% | none      |  yes  |   no    |    2 |
| fuzzy             | 0.30 |  2.10 |     0.8 |   7% | none      |  no   | partial |    0 |
<!-- bench:end -->

**MRR** is mean reciprocal rank over families of real-world mistakes, where 1 means the right item always comes first, and **Junk** is the share of queries with no right answer that a library answers anyway.
[The comparison](https://ekrina.thelazyweb.dev/compare/) has the method and what to pick, including where another library wins, and [the benchmarks](https://ekrina.thelazyweb.dev/benchmarks/) have every family.

## Docs

- The [quickstart](https://ekrina.thelazyweb.dev/getting-started/) goes from install to highlighted results and correction notices.
- The recipes cover [searching several fields](https://ekrina.thelazyweb.dev/guides/several-fields/), [highlighting](https://ekrina.thelazyweb.dev/guides/highlight/), [handling corrections](https://ekrina.thelazyweb.dev/guides/corrections/), [keeping only literal matches](https://ekrina.thelazyweb.dev/guides/literal-matches/), [search as you type](https://ekrina.thelazyweb.dev/guides/search-as-you-type/) and [matching inside long text](https://ekrina.thelazyweb.dev/guides/long-text/).
- [How it works](https://ekrina.thelazyweb.dev/how-it-works/scores/) lists every tier and score, [what it corrects](https://ekrina.thelazyweb.dev/how-it-works/corrections/) and [the fuzzy tier](https://ekrina.thelazyweb.dev/how-it-works/fuzzy-tier/).
- Migration guides from [@nozbe/microfuzz](https://ekrina.thelazyweb.dev/guides/migrate-from-microfuzz/), [Fuse.js](https://ekrina.thelazyweb.dev/guides/migrate-from-fuse/), [match-sorter](https://ekrina.thelazyweb.dev/guides/migrate-from-match-sorter/) and [fast-fuzzy](https://ekrina.thelazyweb.dev/guides/migrate-from-fast-fuzzy/).
- The [API reference](https://ekrina.thelazyweb.dev/reference/) is generated from the JSDoc.
- For LLMs, there's [`llms.txt`](https://ekrina.thelazyweb.dev/llms.txt) and a Markdown copy of every page.
- Coding agents get `AGENTS.md` in the installed package, with [the rules for using it](https://ekrina.thelazyweb.dev/ai-agents/).

## The name

Ancient Greek ἔκρινα, eh-KREE-na, "I sifted, I judged", is the aorist of κρίνω, the root of criterion and critic, and cognate with the Latin _cernere_ behind discern.
It sifts a list and judges each candidate against a criterion.

## Security

Ekrina has no runtime dependencies and no install scripts, its tests cover every line and branch, and each release is built in CI with npm provenance and goes live only after a maintainer approves it.
Reporting a vulnerability, verifying a release and the limits on hostile input are in [SECURITY.md](./SECURITY.md).

## Contributing

Bug reports and feature requests go in [GitHub issues](https://github.com/MMMikeM/ekrina/issues), and [CONTRIBUTING.md](./CONTRIBUTING.md) covers changing the code.

## License

MIT
