import { defineConfig } from "vite-plus";
import { agentsMd } from "./scripts/agents-md.ts";
import { INTERNAL_NAMES } from "./scripts/internal-names.ts";

export default defineConfig({
	fmt: {
		useTabs: true,
		// The bench pipeline owns results.json, the frozen corpora, and every
		// marked region in docs/benchmarks.md — formatting them fights the
		// generator and `pnpm bench --check`.
		ignorePatterns: [
			"dist",
			"bench/results.json",
			"bench/corpus-*.json",
			"docs/benchmarks.md",
			"site",
		],
	},
	lint: {
		plugins: ["typescript", "unicorn", "oxc"],
		categories: { correctness: "error" },
		rules: {},
		env: { builtin: true },
		// The site is typechecked by Astro and keeps its own style.
		ignorePatterns: ["site"],
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
			verify: {
				command: ["vp lint", "knip", "vp test run --coverage"],
				dependsOn: ["types"],
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
			suite: {
				command: "vp test run",
				cwd: "bench",
				dependsOn: ["build"],
				// Without these the task runs in a clean environment and never sees them.
				cache: {
					input: [{ auto: true }, "!bench/node_modules/.vite/**"],
					env: ["BENCH_ONLY", "BENCH_REPEAT"],
				},
			},
		},
	},
});
