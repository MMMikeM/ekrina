# Security

## Reporting a vulnerability

Report it privately through [GitHub's vulnerability reporting](https://github.com/MMMikeM/ekrina/security/advisories/new), not in a public issue.
Fixes land in the latest 1.x release; older versions are not patched.

## What the package does

- It has no runtime dependencies and no install scripts, so installing it runs nothing.
- It does no I/O: no network, no file system, and no globals beyond ES2022, which `tsconfig.json` enforces.
  It reads the strings you pass and returns results.
- Queries are escaped before they become regular expressions, so a query cannot inject regex syntax.

## Releases

Every release is built by [the publish workflow](./.github/workflows/publish.yml) from a version tag and staged on npm through trusted publishing, with a provenance attestation that links the tarball to its commit and workflow run.
A staged version goes live only when a maintainer approves it with 2FA, so a compromised workflow cannot publish on its own.
`publishConfig.provenance` is set, so a publish from anywhere but CI fails.
`npm audit signatures` verifies an installed copy.
The GitHub Release carries the same tarball, its SHA-256 and a Sigstore attestation, which `gh attestation verify ekrina-<version>.tgz --repo MMMikeM/ekrina` checks.
1.0.0 predates this and was published by hand, without an attestation; 1.1.0 was published directly from CI, before staging.

## Testing

The tests cover every statement and branch of `src/`, and `pnpm gate` fails below 100%.
Property tests (`test/properties.test.ts`, with fast-check) check the published invariants against random input: ranges always index the caller's string, normalisation is 1:1, and a search typed keystroke by keystroke returns what a fresh one does.
CI runs `pnpm audit` over the development dependencies, CodeQL on every pull request, and the packed tarball on Node 18–24, Bun and Deno.

## Cost on hostile input

Matching time grows with the length of the text and of the query, so a caller matching untrusted input should cap both.
Text longer than 256 characters is gated by one linear scan, and [`test/hostile-text.test.ts`](./test/hostile-text.test.ts) holds crafted inputs that took seconds in 1.0.0 to linear time.
Shorter text goes through a regular expression whose worst case is quadratic in the text's length, which 256 characters keeps small.
