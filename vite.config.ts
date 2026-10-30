import { defineConfig } from "vite-plus";

export default defineConfig({
	fmt: {
		useTabs: true,
		// The bench pipeline owns results.json, the frozen corpora, and every
		// marked region in docs/benchmarks.md — formatting them fights the
		// generator and `pnpm bench --check`.
		ignorePatterns: ["dist", "bench/results.json", "bench/corpus-*.json", "docs/benchmarks.md"],
	},
	lint: {
		plugins: ["typescript", "unicorn", "oxc"],
		categories: { correctness: "error" },
		rules: {},
		env: { builtin: true },
		ignorePatterns: [],
	},
	pack: {
		entry: ["./src/index.ts"],
		format: ["esm", "cjs"],
		dts: true,
		clean: true,
		sourcemap: false,
		minify: true,
		// attw, publint and the bundler only warn by default; these make each one
		// fail the build instead.
		failOnWarn: true,
		attw: { level: "error" },
		publint: { strict: true },
	},
	test: {
		include: ["test/**/*.test.ts"],
		coverage: {
			provider: "v8",
			include: ["src/**"],
			reporter: ["text-summary"],
			thresholds: { 100: true },
		},
	},
	run: {
		tasks: {
			verify: {
				command: ["vp lint", "vp test run --coverage"],
				dependsOn: ["types"],
			},
			// tsc 7 is a native binary whose file reads the cache's tracking doesn't see,
			// so a cached run would replay a pass over code it never read.
			types: {
				command: ["tsc --noEmit", "tsc -p bench --noEmit"],
				dependsOn: ["build"],
				cache: false,
			},
			suite: {
				command: "vp test run",
				cwd: "bench",
				dependsOn: ["build"],
				cache: { input: [{ auto: true }, "!bench/node_modules/.vite/**"] },
			},
		},
	},
});
