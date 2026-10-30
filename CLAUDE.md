# ekrina

Tiny, typed fuzzy matching. Zero dependencies, dual ESM/CJS, no platform assumptions — browsers, Node, Deno, Bun, edge runtimes.

The package is `ekrina`; the working directory is still `mikrofuzz` from before the rename.
1.0.0 is on npm (published 2026-08-04), so the public surface follows semver from here: an export, a score value or a `Tier` string changes only with a version bump and a CHANGELOG entry. The CHANGELOG has a section per release, each recording the measured design decisions it made.

## Hard constraints

- **No runtime dependencies.** Ever. `devDependencies` only. The `bench` workspace depends on the eight comparison libraries on purpose, which is allowed because it is `private: true` and never published.
- **Nothing platform-specific in `src/`.** No `node:` imports, no DOM, nothing outside ES2022 — `tsconfig.json` pins `lib: ["ES2022"]` so a stray global is a compile error rather than a runtime surprise on Workers. `node:fs` belongs to `bench/` and `docs/` scripts only.
- **`isolatedDeclarations` is on.** Declarations come from oxc, not from the TypeScript compiler, so every export needs an explicit type annotation (`export const wordChar: RegExp = …`). Inference a human finds obvious still fails the build.
- **`normaliseText` is offset-preserving.** Exactly one code unit out per code unit of `NFC(text).trim()` in. Every `Range` the library returns indexes the caller's own string, so a fold that changes length silently corrupts every highlight. New folds go through `computeFold`'s length check, no exceptions, however tempting the Unicode edge case.
- **Gates may only false-pass, never false-reject.** `charMask`, `buildPresenceGate`, `buildFuzzyGate` and the prefix-narrowing survivor cache exist purely to skip work. A gate that rejects a field some tier would have matched is a correctness bug, not a tuning question. The monotonicity argument in `search.ts` is what licenses reusing survivors across keystrokes; changing any gate means rechecking it.
- **`SCORES.CONTAINS` is a published dividing line.** At or below it means "the query text appears here"; above it is a fuzzy chain or a one-edit rescue, and only `tier` tells those apart. `TYPO_PENALTY` (2.1) is sized so even a corrected exact hit sorts below a true `contains`; shrinking it inverts the guarantee and measurably lowers MRR (CHANGELOG records the measured inversion).
- Score values and `Tier` strings are public API. README documents them and `test/tier-constants.test.ts` pins them, so a tier rename or a changed score value is a breaking change with a CHANGELOG entry.

## Commands

The gate is `pnpm gate`, and it runs before claiming done: build, then `lint:types`, lint and test with coverage, all as `vite.config.ts` tasks. Coverage of `src/` must stay at 100%; a branch that only guards a future Unicode or an unreachable caller gets a `/* v8 ignore */` with the reason, never a test that fakes reaching it. Lint and test replay from the task cache when nothing they read changed; the type checks never do, because tsc 7 is a native binary the cache can't see read. `lint:types` covers `src`/`test` and, via `bench/tsconfig.json`, `bench/` and `docs/pareto.ts`. `pnpm format` runs oxfmt over `src` and `test`. `pnpm build` is tsdown → minified ESM/CJS plus declarations in `dist/`; `prepublishOnly` reruns `lint:types`, `test`, `build`.

A release is a `vX.Y.Z` tag pushed from `main` (`pnpm release`), after the version in `package.json` is bumped and its CHANGELOG section dated; `.github/workflows/publish.yml` refuses an undated or mismatched one, stages the version on npm with provenance through trusted publishing, and creates a draft GitHub Release with that section as notes and the tarball, its SHA-256 and a Sigstore attestation attached. The maintainer then approves the staged version on npm with 2FA (`npm stage approve`) and publishes the draft (`gh release edit vX.Y.Z --draft=false`). A prerelease version (`1.2.0-beta.0`) goes out under its own dist-tag. Never publish from a laptop: `publishConfig.provenance` makes it fail outside CI.

`pnpm test` covers `test/**` only. The bench workspace has its own suite, `pnpm bench:test`, which builds first, because it imports the built `ekrina`, and replays from cache when neither `dist/` nor `bench/` changed. `pnpm bench` stays a plain script on purpose: a measurement must never be replayed from a cache.

## Benchmarks and published numbers

Every number in README.md and docs/benchmarks.md is generated, and `pnpm bench` (`bench/pipeline.ts`) is the only thing that generates them.
docs/performance.md is the design-rationale record: decision evidence quoted from the runs that settled decisions, never current standings, and nothing in it is generated.
`pnpm bench` measures, writes `bench/results.json`, rewrites every marked table in docs/benchmarks.md, and redraws the Pareto SVGs.
Never hand-edit a cell inside a `<!-- bench:… -->` region — the next run overwrites it, and `pnpm bench --check` fails in the meantime.

- `pnpm bench --docs` re-emits every table from the committed `results.json` without measuring. This is the one to reach for when reworking prose around a table.
- `pnpm bench --check` exits nonzero, naming the regions, if the doc disagrees with the artifact.
- `pnpm bench --speed` / `--quality` / `--memory` run one stage; `--runs=N` sets the fresh processes per cold cell (default 1; a full run takes about four minutes).
- `pnpm bench --only=<library>` re-measures one library's rows and merges them over the committed artifact, guarded by a foreign-anchor check (an untouched library's cell must reproduce within 25%) and a printed old→new delta report to confirm only the expected cells moved. The cross-library ordering then spans two sessions; rerun the full matrix before publishing it as evidence.
- `pnpm bench:test` — the gate funnel and the other assertions. The funnel is a diagnostic, not a published table.

`bench/results.json` is committed: it is the evidence for every published cell, so a number that moves is a reviewable diff.
Adding a table means adding a region to `regions()` in `bench/tables.ts` and a marker pair in the doc; headings and prose stay outside the markers.

Guards to respect rather than route around:

- The pipeline exits nonzero on a contaminated run — base ekrina measuring more than 10% slower than `ekrina (acronym)`, summed over every cold cell, even though the acronym row runs strictly more code per query. That means garbage collection or thermal throttling disturbed the run. Rerun on a quiet machine; do not publish it.
- `bench/corpus-*.json` is frozen, and regeneration is gated behind `GEN_CORPUS=1` because every published rank and MRR derives from those exact sequences. Regenerating also changes the sampled query families and the representative queries, so the hand-written prose around the family tables needs rewriting with them.
- `pnpm bench --scope=mixed-10k` scopes a dev run: it measures a partial matrix, so it prints and stops without touching `results.json` or the docs. `BENCH=` still works as an alias.

## Documentation

**Everything re-exported from `src/index.ts` carries JSDoc** — `fuzzyMatch`, `createFuzzySearch`, `normaliseText`, `splitWords`, `SCORES`, `TYPO_PENALTY`, and every public type, fields included. Internal exports get whatever the next reader needs, which is usually a `//` note about why the thing exists rather than what it does.

JSDoc says what the caller needs and nothing more:

- Lead with what it does, in one line.
- `@param` only when the name and type don't already say it.
- `@throws` whenever it can throw.
- `@example` on the primary entry points only (`createFuzzySearch`, `fuzzyMatch`).
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

A file header is a comment, held to the same test. "What is this file" is the filename's job and "what does it export" is the exports' job; neither justifies a header, so `fuzzy.ts` restating the chunk rules its code already implements should go. Write one only for what reading the file cannot tell you — that `bench/funnel.test.ts` imports `../src` internals on purpose, that `bench/corpus-gen.test.ts` rewrites every published rank if run. Most files should open on their first import.

## Tests

Vitest, `test/**/*.test.ts`, importing the public surface from `../src/index`, never from `dist`. Tests are typechecked: `tsconfig.json` includes `test/**`, so `pnpm lint:types` covers them and mocks need real parameter types rather than casts over an empty tuple.

Name tests as behaviour, not method — `"a dropped keystroke in an otherwise exact word"`, ``"`score <= SCORES.CONTAINS` selects non-fuzzy matches"``. Prefer a failing assertion that reads as a spec sentence over a comment explaining what the assertion means.

A tier with its own semantics gets its own file (`fuzzy-tier`, `adjacent-swap`, `typo-rescue`, `acronym`), and regression tests keep their provenance — `known-issues.test.ts` pins the six v0.x bugs and says so.

Statistical claims live in `bench/`, where the corpora and the measurement do: the long-text junk rate is asserted by `bench/longtext.test.ts`, gate soundness by `bench/funnel.test.ts`, ranks and result-set sizes by `bench/hits.test.ts`, which scores MRR over sampled query families, each query by its first relevant result (`bench/corpus.ts` defines relevance), so no library is credited for how it breaks a tie. `test/` pins behaviour and the published constants. `bench/funnel.test.ts` reaches into `../src/gates` on purpose — `dist` doesn't export the gates and shouldn't.

## Prose

README.md, CHANGELOG.md, docs/ and BLOG-DRAFT.md: one sentence per line, no hard wrapping mid-sentence. EU spelling everywhere — prose (behaviour, optimise, normalisation) and identifiers alike (`normaliseText`, `normalisedField`); only platform builtins keep theirs (`String.prototype.normalize`).

Claims about behaviour cite the table or command that produced them, and a claim that no longer matches a regenerated table gets rewritten rather than softened.

## Style

Enforced by oxfmt/oxlint, not by hand: tabs, double quotes, semicolons, 100 columns. Run `pnpm format`.

`oxfmt.config.ts`, `oxlint.config.ts`, and the `bench/`/`docs/` scripts sit outside the format script's path — leave their existing style alone rather than reformatting them by hand.
