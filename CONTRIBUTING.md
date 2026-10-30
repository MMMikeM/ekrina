# Contributing

## Reporting a bug or asking for a feature

Open an [issue](https://github.com/MMMikeM/ekrina/issues) with the field text, the query, what you got and what you expected; a failing `fuzzyMatch(text, query)` call is the most useful report there is.
Report a security problem privately instead, as [SECURITY.md](./SECURITY.md) describes.

## Changing the code

Fork the repository, make the change on a branch, and open a pull request against `main`.
Every pull request runs the checks below in CI, and one that fails them is not merged.

```bash
pnpm install
pnpm gate   # build, typecheck, lint, and the tests with 100% coverage of src/
```

- **Tests come with the change.** A behaviour change or a fix adds a test in `test/`, named for the behaviour (`"a dropped keystroke in an otherwise exact word"`), and `src/` stays at 100% statement and branch coverage.
- **No runtime dependencies**, and nothing platform-specific in `src/`: no `node:` imports, no DOM, nothing outside ES2022.
- **Score values and `Tier` strings are public API**; changing one is a breaking change and needs a CHANGELOG entry.
- **A change that moves a benchmark number** reruns `pnpm bench` and commits `bench/results.json` with it; never hand-edit a generated table.
- Formatting is oxfmt (`pnpm format`), and lint is oxlint.

The design decisions and the reasons behind them are in [CHANGELOG.md](./CHANGELOG.md) and [docs/](./docs).
