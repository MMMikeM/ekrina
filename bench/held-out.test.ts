/**
 * Diagnostic, never published: ekrina's rows on the published families scored
 * again on items and seeds no tuning has seen (corpus.ts `heldOut`), beside the
 * published score, so a gain that exists only on the published queries shows up
 * as a gap.
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { ensureRawDir, rawFile } from "./artifact.ts";
import { configs } from "./configs.ts";
import { CORPORA, heldOut } from "./corpus";
import { type Sample, scoreFamilies, scorecardOf } from "./mrr.ts";

const SIZE = 10_000;
// The gap measured when the families were fixed was 0.03–0.04; one twice that
// would mean a change scores on the published queries and not on fresh ones.
const MAX_HELD_OUT_GAP = 0.08;

// Only ekrina is tuned against the published families, so only its rows can be
// fit to them; the other libraries would double the suite's time to say nothing.
const ekrinaRows = (list: string[]) => configs(list).filter((c) => c.name.startsWith("ekrina"));

const score = (list: string[], samples: Sample[]) => {
	const all = ekrinaRows(list);
	const families = scoreFamilies(samples, all, ekrinaRows([...list].reverse()));
	return { families, scorecard: scorecardOf(families, all) };
};

const runOut: Record<string, unknown> = {};

describe("held-out families", () => {
	for (const corpus of CORPORA) {
		it(`[${corpus.name}] keep the gain the published ones show`, { timeout: 120_000 }, () => {
			const published = score(corpus.build(SIZE), corpus.samples);
			const { items, samples } = heldOut(corpus);
			const fresh = score(items, samples);
			const mrrOf = (rows: typeof fresh.scorecard, library: string): number | undefined =>
				rows.find((row) => row.library === library)?.mrr;
			const table = published.scorecard.map(({ library, mrr }) => ({
				library,
				published: mrr,
				heldOut: mrrOf(fresh.scorecard, library),
			}));
			console.table(table);
			const families = fresh.families
				.filter((family) => family.scored)
				.map((family) => ({
					kind: family.kind,
					...Object.fromEntries(
						Object.entries(family.mrr).map(([library, mrr]) => [
							library,
							`${published.families.find((p) => p.kind === family.kind)?.mrr[library]} → ${mrr}`,
						]),
					),
				}));
			runOut[corpus.name] = { table, families };
			ensureRawDir();
			writeFileSync(rawFile("held-out.json"), JSON.stringify(runOut, null, "\t"));
			const publishedMrr = mrrOf(published.scorecard, "ekrina");
			const heldOutMrr = mrrOf(fresh.scorecard, "ekrina");
			// `--only=` narrows the set, and a check against an absent row would assert nothing.
			if (publishedMrr !== undefined && heldOutMrr !== undefined) {
				expect(
					publishedMrr - heldOutMrr,
					"Ekrina is fit to the published queries",
				).toBeLessThanOrEqual(MAX_HELD_OUT_GAP);
			}
		});
	}
});
