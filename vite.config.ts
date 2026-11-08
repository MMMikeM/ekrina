import { defineConfig } from "vite-plus";
import { agentsMd } from "./scripts/agents-md.ts";
import { INTERNAL_NAMES } from "./scripts/internal-names.ts";

export default defineConfig({
	fmt: {
		useTabs: true,
		// The bench pipeline owns results.json, the frozen corpora, and every doc
		// with a marked region; formatting them fights the generator and
		// `vpr bench --check`.
		ignorePatterns: [
			"dist",
			"bench/results.json",
			"bench/corpus-*.json",
			"bench/misspellings.json",
			"docs/benchmarks.md",
			"docs/benchmarks",
			"docs/compare.md",
			"docs/libraries",
			"README.md",
			"site",
		],
	},
	lint: {
		plugins: ["typescript", "unicorn", "oxc"],
		categories: { correctness: "error" },
		rules: {},
		env: { builtin: true },
		overrides: [
			{ files: ["examples/command-palette/**"], plugins: ["react"], env: { browser: true } },
		],
	},
	pack: {
		entry: ["./src/index.ts"],
		format: ["esm", "cjs"],
		dts: true,
		clean: true,
		sourcemap: false,
		minify: {
			mangleProps: {
				include: new RegExp(`^(${INTERNAL_NAMES.join("|")})$`),
			},
		},
		// attw, publint and the bundler only warn by default; these make each one
		// fail the build instead.
		failOnWarn: true,
		attw: { level: "error" },
		publint: { strict: true },
		// The minifier keeps `v8 ignore` hints as annotations, beside the @__PURE__
		// ones consumers' tree-shaking needs, so they're stripped on their own.
		plugins: [
			{
				name: "strip-coverage-hints",
				renderChunk: (code: string) => code.replace(/\/\* v8 ignore (?:next|start|stop) \*\//g, ""),
			},
			agentsMd(),
		],
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
			build: "vp pack",
			// Its dependencies run side by side before the tests.
			gate: {
				command: "vp test run --coverage",
				dependsOn: ["types", "lint", "knip"],
				// Coverage writes temp files the run then reads back, which otherwise
				// marks every run as having changed its own inputs.
				cache: {
					input: [{ auto: true }, "!coverage/**"],
					output: [{ auto: true }, "!coverage/**"],
				},
			},
			// tsc 7 is a native binary whose file reads the cache's tracking doesn't see,
			// so a cached run would replay a pass over code it never read.
			types: {
				command: [
					"tsc --noEmit",
					"tsc -p bench --noEmit",
					"tsc -p examples/command-palette --noEmit",
				],
				dependsOn: ["build"],
				cache: false,
			},
			lint: "vp lint",
			"lint:fix": { command: "vp lint --fix", cache: false },
			format: { command: "vp fmt", cache: false },
			knip: {
				command: "knip",
				// Its loader caches each compiled config here and reads it back next run.
				cache: {
					input: [{ auto: true }, "!node_modules/.cache/**"],
					output: [{ auto: true }, "!node_modules/.cache/**"],
				},
			},
			test: "vp test run",
			"bench:test": {
				command: "vp test run",
				cwd: "bench",
				dependsOn: ["build"],
				// Without these the task runs in a clean environment and never sees them.
				cache: {
					input: [{ auto: true }, "!bench/node_modules/.vite/**"],
					env: ["BENCH_ONLY", "BENCH_REPEAT"],
				},
			},
			// A measurement must never be replayed from a cache.
			bench: { command: "node bench/pipeline.ts", dependsOn: ["build"], cache: false },
			release: { command: "node scripts/release.ts", cache: false },
			"corpus:wikidata": {
				command: "GEN_WIKIDATA=1 vp test run corpus-wikidata-gen",
				cwd: "bench",
				cache: false,
			},
			"corpus:emoji": {
				command: "GEN_EMOJI=1 vp test run corpus-emoji-gen",
				cwd: "bench",
				cache: false,
			},
			site: { command: "vp run ekrina-docs#dev", cache: false },
			"site:build": { command: "vp run ekrina-docs#build", cache: false },
			example: { command: "vp run ekrina-command-palette#dev", cache: false },
		},
	},
});
