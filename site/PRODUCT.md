# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers choosing a fuzzy-search library for a search-as-you-type interface, such as a command palette or a picker; backend one-shot lookups are a secondary workload.
LLM agents that recommend a library to those developers, reading the Markdown copy of each page and `llms.txt`, and coding agents using it, which read `dist/AGENTS.md` in the installed package.

## Product Purpose

The documentation site for `ekrina`, a zero-dependency fuzzy matcher published on npm.
It shows what the library does by running it on the page, explains the API, and shows, from measured evidence, how Ekrina compares with seven other libraries on match quality, junk results and speed, so a reader can decide which to use.

## Positioning

Lazy where it counts: Ekrina does only the work each query needs, and only guesses when the query as typed comes up short.
It corrects up to two typos per query and says when it did, returns nothing for nonsense, and reports how each match was made (a tier, highlight ranges and a score pinned by tests).
Its benchmark is published with the method, the frozen corpora and every cell in `bench/results.json`.

## Operating Context

The pages whose tables `pnpm bench` regenerates (benchmarks, compare and one page per library) are copied from `docs/` at build time, since GitHub renders those too.
The API reference is generated from the source's JSDoc.
Every other page is written for the site in `src/content/docs`, and reads each number it quotes from `bench/results.json` at build time through `src/bench.ts`.
The landing page runs the library live over the emoji corpus, and the tutorial runs `examples/command-palette` from the repository.
Every page is also served as Markdown, and every chart has a table twin in the HTML so crawlers and agents get the numbers without running scripts.
The site deploys when a stable release is published, or when the maintainer runs the docs workflow by hand.

## Capabilities and Constraints

Static Astro Starlight site, rendered at build time; interactive controls work without JavaScript where possible, and the two live demos load the library only on first use.
Timings exist for the en and native corpora at 10k and 100k items; the emoji corpus is scored for quality only.

## Brand Commitments

The pitch is "Lazy where it counts.", the landing page's hero, with "Lazy" highlighted.
The voice is plain and measured: it states what Ekrina loses as plainly as what it wins, and claims nothing a page cannot back with a number or a runnable example.

## Evidence on Hand

`bench/results.json`: per library, headline and per-family MRR, junk rates, the 24 timed queries' per-query times, cold first answers, build times and memory.
`bench/libraries.ts`: each library's gzipped bundle size and feature cells, recorded by hand rather than measured by the bench.
No testimonials, users or adoption figures exist, and none may be invented.

## Product Principles

- Every published number traces to `bench/results.json`, or for bundle sizes to `bench/libraries.ts`.
- Ekrina's losses are shown as plainly as its wins, with the same visual weight.
- Speed is shown beside the quality that comes with it, at the list size the reader has.
- What a chart shows, a table on the same page also states, for readers and agents who cannot see it.
- Every code example runs as written, against the library as it is in the repository.

## Accessibility & Inclusion

WCAG 2.2 AA.
