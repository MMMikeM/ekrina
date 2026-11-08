/**
 * Frontend session probe: three keystrokes on the 100k native corpus starting at
 * the 3-char UI gate, each extending the last (typing). ekrina's prefix-narrowing
 * cache rescans only the previous query's mask-gate survivors, so successive
 * keystrokes get faster; every other library runs a full scan per keystroke.
 * Each keystroke runs once, in order, in a fresh process, as a user types it:
 * repeating one query in a process would let V8 reuse the regexes it compiled,
 * which a user's next keystroke never can.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vite-plus/test";
import { type SessionRow, ensureRawDir, rawFile } from "./artifact.ts";
import { SELECTED_NAMES } from "./configs.ts";
import { REPEAT } from "./passes.ts";
import { CORPORA } from "./corpus.ts";

const SIZE = 100_000;
const SHOWN = [
	"ekrina",
	"@nozbe/microfuzz",
	"fuzzysort",
	"uFuzzy (all opts)",
	"fuse.js (all opts)",
].filter((name) => SELECTED_NAMES.includes(name));
const PROCESSES = REPEAT ? 7 : 1;
const typist = fileURLToPath(new URL("./session-typist.ts", import.meta.url));

const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[xs.length >> 1] as number;

const typeOnce = (library: string, steps: string[]): number[] =>
	JSON.parse(
		execFileSync(process.execPath, [typist], {
			env: { ...process.env, SESSION_CELL: JSON.stringify({ library, steps, size: SIZE }) },
			encoding: "utf8",
			stdio: ["ignore", "pipe", "inherit"],
		}),
	) as number[];

it("frontend session: three successive queries at 100k", { timeout: 600_000 }, () => {
	const native = CORPORA.find((c) => c.name === "native");
	if (!native) throw new Error("native corpus missing");
	// The short-word probe, typed keystroke by keystroke from the 3-char UI gate.
	const word = native.specs[1].query;
	const steps = [3, 4, 5].map((k) => word.slice(0, k));

	const samples = new Map<string, number[][]>(SHOWN.map((name) => [name, []]));
	for (let round = 0; round < PROCESSES; round++) {
		// Rotated so drift across the run lands on every library alike.
		for (let k = 0; k < SHOWN.length; k++) {
			const name = SHOWN[(k + round) % SHOWN.length] as string;
			samples.get(name)?.push(typeOnce(name, steps));
		}
	}

	const rows: SessionRow[] = SHOWN.map((library) => {
		const runs = samples.get(library) as number[][];
		const stepMs = steps.map((_, k) => median(runs.map((run) => run[k] as number)));
		return { library, stepMs, sessionMs: stepMs.reduce((a, b) => a + b, 0) };
	});
	for (const row of rows) expect(row.sessionMs).toBeGreaterThan(0);

	ensureRawDir();
	writeFileSync(
		rawFile("session.json"),
		JSON.stringify({ size: SIZE, corpus: "native", steps, rows }, null, "\t"),
	);
});
