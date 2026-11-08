# ekrina

Fuzzy search that corrects up to two typos per query and says how every result matched. Zero dependencies, dual ESM/CJS, no platform assumptions — browsers, Node, Deno, Bun, edge runtimes.

The package is `ekrina`; the working directory is still `mikrofuzz` from before the rename.
1.0.0 is on npm (published 2026-08-04), so the public surface follows semver from here: an export, a score value or a `Tier` string changes only with a version bump and a CHANGELOG entry. The CHANGELOG has a section per release, each recording the measured design decisions it made.

## Hard constraints

- **No runtime dependencies.** Ever. `devDependencies` only. The `bench` workspace depends on the eight comparison libraries on purpose, which is allowed because it is `private: true` and never published.
- **Nothing platform-specific in `src/`.** No `node:` imports, no DOM, nothing outside ES2022 — `tsconfig.json` pins `lib: ["ES2022"]` so a stray global is a compile error rather than a runtime surprise on Workers. `node:fs` belongs to `bench/` and `docs/` scripts only.
- **`isolatedDeclarations` is on.** Declarations come from oxc, not from the TypeScript compiler, so every export needs an explicit type annotation (`export const wordChar: RegExp = …`). Inference a human finds obvious still fails the build.
- **`normaliseText` is offset-preserving.** Exactly one code unit out per code unit of `NFC(text).trim()` in. Every `HighlightRange` the library returns indexes the caller's own string, so a fold that changes length silently corrupts every highlight. New folds go through `computeFold`'s length check, no exceptions, however tempting the Unicode edge case.
- **Gates may only false-pass, never false-reject.** `charMask`, `buildPresenceGate`, `buildFuzzyGate` and the prefix-narrowing survivor cache exist purely to skip work. A gate that rejects a field some tier would have matched is a correctness bug, not a tuning question. The monotonicity argument in `search.ts` is what licenses reusing survivors across keystrokes; changing any gate means rechecking it.
- **`SCORES.CONTAINS` is a published dividing line.** At or below it means "the query text appears here"; above it is a fuzzy chain or a one-edit rescue, and only `tier` tells those apart. `TYPO_PENALTY` (2.1) is sized so even a corrected exact hit sorts below a true `contains`; shrinking it inverts the guarantee and measurably lowers MRR (CHANGELOG records the measured inversion).
- Score values and `Tier` strings are public API. The site's how-it-works/scores page documents them and `test/tier-constants.test.ts` pins them, so a tier rename or a changed score value is a breaking change with a CHANGELOG entry.

## Commands

Every command is a task in `vite.config.ts`'s `run.tasks`, which serves as the repo's justfile: `vpr <task>` runs one (`pnpm vpr <task>` without vite-plus installed globally), arguments after the name pass through (`vpr bench --all`), and `vpr` alone lists them all, the site's and the example's included. CI calls the same tasks, so a command is defined once; the root `package.json` keeps only `prepare`, which installs the git hooks. A push checks formatting and runs `vpr gate` first (`.vite-hooks/pre-push`); `VP_GIT_HOOKS=0 git push` skips both.

The gate is `vpr gate`, and it runs before claiming done: build, then the type checks, lint (the library, bench, site and example, React rules for the example) and knip (`knip.ts`: unused files, exports and dependencies) side by side, then test with coverage. Coverage of `src/` must stay at 100%; a branch that only guards a future Unicode or an unreachable caller gets a `/* v8 ignore */` with the reason, never a test that fakes reaching it. Build, lint, knip and test replay from the task cache when nothing they read changed, so an unchanged tree gates in under a second. The test run's cache leaves out `coverage/**` and knip's leaves out `node_modules/.cache/**`, files each writes and reads back, or neither would ever replay. The type checks never replay, because tsc 7 is a native binary the cache can't see read. `vpr types` runs them alone and covers `src`/`test`, via `bench/tsconfig.json` `bench/` and `docs/pareto.ts`, and the docs tutorial's `examples/command-palette` against `src/`. `vpr format` runs `vp fmt` over the repo, skipping the `fmt.ignorePatterns` in `vite.config.ts`. `vpr build` is `vp pack` → minified ESM/CJS plus declarations in `dist/`, cached like lint and test, so a hit restores `dist/` without rebuilding. There is no `prepublishOnly`: the release stages a packed tarball, and npm runs no lifecycle scripts for one.

One pnpm workspace holds the library at the root, `bench`, `site` (the Astro docs, `vpr site` and `vpr site:build`) and `examples/command-palette` (the tutorial's app, `vpr example`, which builds the library first), with one lockfile and the security overrides and 7-day `minimumReleaseAge` in `pnpm-workspace.yaml`. The library's CI, its publish job and the pack action install with `--filter '!ekrina-docs'`, so the site's dependencies never reach the job holding the npm token; knip skips `site` for the same reason, and `docs.yml` installs only the site. The global `vite` override to vite-plus-core is vite-plus's documented setup, and the site builds on it.

A release is a `vX.Y.Z` tag pushed from `main` (`vpr release`), after the version in `package.json` is bumped and its CHANGELOG section dated; `.github/workflows/publish.yml` refuses an undated or mismatched one, stages the version on npm with provenance through trusted publishing, and creates a draft GitHub Release with that section as notes and the tarball, its SHA-256, a Sigstore attestation and its provenance envelope (`.intoto.jsonl`) attached. The maintainer then approves the staged version on npm with 2FA (`npm stage approve`) and publishes the draft (`gh release edit vX.Y.Z --draft=false`). A prerelease version (`1.2.0-beta.0`) goes out under its own dist-tag. Never publish from a laptop: `publishConfig.provenance` makes it fail outside CI.

`vpr test` covers `test/**` only. The bench workspace has its own suite, `vpr bench:test`, which builds first, because it imports the built `ekrina`, and replays from cache when neither `dist/`, `bench/` nor its two opt-ins changed. `vpr bench` stays a plain script on purpose: a measurement must never be replayed from a cache.

**Defaults measure ekrina once; other libraries and repeats are opt-in.** Every bench entry point (`vpr bench`, `vpr bench:test`, `bench/run.ts`, `bench/memory.ts`) runs only ekrina's own rows (`ekrina`, `ekrina (indexed)`, `ekrina (acronym)`) and times each query once. `BENCH_ONLY=all` (or `vpr bench --all`) brings in every library; `BENCH_REPEAT=1` restores warm-ups and medians in the suite's timings, and `--runs=N` / `--count=N` the processes per cold cell. Ask before running anything opt-in: a full matrix runs every library over three corpora.

## Benchmarks and published numbers

Every number in README.md and docs/benchmarks.md is generated, and `vpr bench --all` (`bench/pipeline.ts`) is the only thing that generates them.
docs/performance.md is the design-rationale record: decision evidence quoted from the runs that settled decisions, never current standings, and nothing in it is generated.
`vpr bench --all` builds, measures every library, writes `bench/results.json`, rewrites every marked table in docs/benchmarks.md, README.md, docs/compare.md and docs/libraries/, and redraws the Pareto SVGs, with `BENCH_REPEAT=1` set for its timings.
Plain `vpr bench` times ekrina's rows once in the cold stage and prints, touching neither the artifact nor the docs.
Never hand-edit a cell inside a `<!-- bench:… -->` region — the next run overwrites it, and `vpr bench --check` fails in the meantime.

- `vpr bench --docs` re-emits every table from the committed `results.json` without measuring. This is the one to reach for when reworking prose around a table.
- `vpr bench --check` exits nonzero, naming the regions, if the doc disagrees with the artifact.
- `vpr bench --speed` / `--quality` / `--memory` run one stage (ekrina only and printed, unless `--all`); `--runs=N` sets the fresh processes per cold cell (default 1; a full `--all` run takes about four minutes).
- `vpr bench --size --all` measures every library's gzipped bundle (`bench/size.ts`) and rewrites the size cells and the inline `<!-- bench:ekrina-gzip -->` regions in seconds; sizes live in `results.json`, not `bench/libraries.ts`. `bench/size.test.ts` holds Ekrina's under a budget. An inline region keeps both markers on one line, inside a sentence.
- `vpr bench --only=<library>` re-measures one library's rows and merges them over the committed artifact, guarded by a foreign-anchor check (an untouched library's cell must reproduce within 25%) and a printed old→new delta report to confirm only the expected cells moved. The cross-library ordering then spans two sessions; rerun the full matrix before publishing it as evidence.
- `vpr bench:test` — the gate funnel and the other assertions, against ekrina's rows unless `BENCH_ONLY=all`. The funnel is a diagnostic, not a published table.

`bench/results.json` is committed: it is the evidence for every published cell, so a number that moves is a reviewable diff.
Adding a table means adding a region to `regions()` in `bench/tables.ts` and a marker pair in the doc; headings and prose stay outside the markers, except the clause an inline region generates.

Guards to respect rather than route around:

- The pipeline exits nonzero on a contaminated run — base ekrina measuring more than 10% slower than `ekrina (acronym)`, summed over every cold cell but the acronym query's, even though the acronym row runs strictly more code per query (on the acronym query its tier matches literally and skips the index build, so that cell is left out). That means garbage collection or thermal throttling disturbed the run. Rerun on a quiet machine; do not publish it.
- `bench/corpus-*.json` and `bench/misspellings.json` are frozen, and regeneration is gated behind `GEN_WIKIDATA=1` (the `en` and `native` corpora and the misspellings, `vpr corpus:wikidata`) and `GEN_EMOJI=1` (the emoji corpus, `vpr corpus:emoji`) because every published rank and MRR derives from those exact sequences. Wikidata changes daily, so regenerating redraws items as well as the sampled families and representative queries, and the hand-written prose around the family tables needs rewriting with them.
- `vpr bench --scope=native-10k` scopes a dev run to one corpus (`native`) or one corpus at one size (`native-10k`): cold stage only, printed, never written. `BENCH=` still works as an alias.

## Documentation

**Everything re-exported from `src/index.ts` carries JSDoc** — `fuzzyMatch`, `createSearcher`, `normaliseText`, `splitWords`, `SCORES`, `TYPO_PENALTY`, and every public type, fields included. Internal exports get whatever the next reader needs, which is usually a `//` note about why the thing exists rather than what it does.

JSDoc says what the caller needs and nothing more:

- Lead with what it does, in one line.
- `@param` only when the name and type don't already say it.
- `@throws` whenever it can throw.
- `@example` on the primary entry points only (`createSearcher`, `fuzzyMatch`).
- Never restate the type signature in prose. TypeScript already published it.
- Scores are always described as lower = better, matching README and `SCORES`.

## Comments

**Default to none.** A comment can go stale, and it's evidence the code didn't explain itself. Reach for a better name or a small extracted function first — `admitsChunk`, `boundaryOccurrence` and `substitutedWindow` are all names that replaced a block comment, and the name then survives refactoring, gets typechecked, and appears at the call site.

`src/` currently over-comments badly — long explanatory blocks, narrated history, measured tables inline. It is the thing to reduce. New comments should not imitate it. When you touch a function, delete its comments that fail the test below rather than preserving them out of politeness.

Delete comments that restate the code:

```ts
// The chunk start is a known occurrence of queryChar, so this always
// consumes at least one character and chunkEnd lands at or after it.
let chunkEnd = chunkStart;
```

**Extract unclear logic into functions that explain it.** A block of code that needs a labelling comment should be a function. Applies hardest to the long procedural routines — a tier ladder or a rescue path with six labelled steps is six named functions and a readable body.

Write comments only for what the code genuinely cannot carry:

- **The invariant, and what breaks without it.** Gates may only false-pass; the survivor cache is sound only because mask bits grow monotonically under query extension; `normaliseText` must stay 1:1 or every published range breaks.
- **Why a tuned number is that number** — one line, plus a pointer to where the measurement lives (`@see docs/benchmarks.md`). The evidence table itself belongs in `docs/`, not in twenty lines above a `const`.
- **Ordering that looks arbitrary but is load-bearing.** Acronym is tried before contains because a field matching both ways must get the better tier.
- **Toolchain and protocol landmines** that read as mistakes and get "fixed" back: the `oxlint-disable` on `new Array`, the explicit `RegExp` annotations `isolatedDeclarations` demands.

Keep them to a sentence or two. If a comment needs a paragraph, that's usually a signal the design or the docs should take the weight instead.

Never narrate a change (`// now retries four placements`, `// fixed to handle hyphens`). That belongs in the commit message and CHANGELOG.md; the code is the current state. Same for history — "this used to be an allowlist that diverged", "earlier versions did per-variant work" — git has it.

A file header is a comment, held to the same test. "What is this file" is the filename's job and "what does it export" is the exports' job; neither justifies a header, so `fuzzy.ts` restating the chunk rules its code already implements should go. Write one only for what reading the file cannot tell you — that `bench/funnel.test.ts` imports `../src` internals on purpose, that `bench/corpus-wikidata-gen.test.ts` rewrites every published rank if run. Most files should open on their first import.

## Tests

Vitest, `test/**/*.test.ts`, importing the public surface from `../src/index`, never from `dist`. Tests are typechecked: `tsconfig.json` includes `test/**`, so `vpr types` covers them and mocks need real parameter types rather than casts over an empty tuple.

Name tests as behaviour, not method — `"a dropped keystroke in an otherwise exact word"`, ``"`score <= SCORES.CONTAINS` selects non-fuzzy matches"``. Prefer a failing assertion that reads as a spec sentence over a comment explaining what the assertion means.

A tier with its own semantics gets its own file (`fuzzy-tier`, `adjacent-swap`, `typo-rescue`, `acronym`), and regression tests keep their provenance — `known-issues.test.ts` pins the six v0.x bugs and says so.

Statistical claims live in `bench/`, where the corpora and the measurement do: the long-text junk rate is measured and held under a ceiling by `bench/longtext.test.ts`, gate soundness by `bench/funnel.test.ts`, ranks and result-set sizes by `bench/hits.test.ts`, which scores MRR over sampled query families, each query by its first relevant result (`bench/corpus.ts` defines relevance), so no library is credited for how it breaks a tie. `test/` pins behaviour and the published constants. `bench/funnel.test.ts` reaches into `../src/gates` on purpose — `dist` doesn't export the gates and shouldn't.

## Prose

README.md, CHANGELOG.md, docs/ and BLOG-DRAFT.md: one sentence per line, no hard wrapping mid-sentence. EU spelling everywhere — prose (behaviour, optimise, normalisation) and identifiers alike (`normaliseText`, `normalisedField`); only platform builtins keep theirs (`String.prototype.normalize`).

Claims about behaviour cite the table or command that produced them, and a claim that no longer matches a regenerated table gets rewritten rather than softened.

## Style

Enforced by `vp fmt`/`vp lint`, configured in `vite.config.ts`, not by hand: tabs, double quotes, semicolons, 100 columns. Run `vpr format`.

The generated files the formatter skips (`bench/results.json`, the corpora and misspellings, and every doc with a marked region: `docs/benchmarks.md`, `docs/compare.md`, `docs/libraries/`, `README.md`) and `site/` keep whatever style they have; never reformat them by hand.
