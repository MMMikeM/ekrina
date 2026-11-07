import { defineConfig } from "knip/config";

export default defineConfig({
	workspaces: {
		".": {
			entry: ["scripts/*.ts", "docs/pareto.ts", "test/**/*.test.ts"],
			project: ["src/**/*.ts", "scripts/**/*.ts", "test/**/*.ts", "docs/*.ts"],
			// vite.config.ts is vite-plus's, which knip's vite and vitest plugins fail to
			// load, so the tests are listed as entries above instead.
			vite: false,
			vitest: false,
			ignoreDependencies: [
				// Named only by vite.config.ts: `pack.attw`, `pack.publint` and the
				// coverage provider.
				"@arethetypeswrong/core",
				"publint",
				"@vitest/coverage-v8",
				// The catalog alias that makes vite-plus the `vite` every tool resolves.
				"vite",
				"@voidzero-dev/vite-plus-core",
				// For `tsc -p examples/command-palette`, a separate pnpm root.
				"@types/react",
				"@types/react-dom",
			],
		},
		bench: {
			entry: ["*.test.ts", "vitest.config.ts", "run.ts", "memory.ts", "session-typist.ts"],
			project: ["**/*.ts"],
		},
	},
	// The site's deploy binary, installed in site/, a separate pnpm root.
	ignoreBinaries: ["wrangler"],
	treatConfigHintsAsErrors: true,
});
