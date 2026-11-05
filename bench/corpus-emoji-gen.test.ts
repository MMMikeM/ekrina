/**
 * One-shot generator for corpus-emoji.json: every emoji emojibase-data names,
 * as a picker searches it, the label then the CLDR tags the label does not
 * already say ("pretzel — convoluted, twisted"). Skin-tone variants are left
 * out, as pickers fold them under one entry. emojibase-data is MIT; its
 * licence travels in corpus-emoji.LICENSE. Gated:
 *   GEN_EMOJI=1 pnpm --filter=ekrina-bench exec vitest run corpus-emoji-gen
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { expect, it } from "vite-plus/test";

const SOURCE = "https://cdn.jsdelivr.net/npm/emojibase-data@17.0.0/en/data.json";
const SOURCE_SHA256 = "ed014f1049bd370c5794f815850156196ac382850f51c3e9f6a9e83553fb3f01";

type Emoji = { label: string; tags?: string[] };

const asPickerItem = ({ label, tags = [] }: Emoji): string => {
	const said = new Set(label.toLowerCase().split(/\W+/));
	const extra = tags.filter((tag) => !said.has(tag));
	return extra.length ? `${label} — ${extra.join(", ")}` : label;
};

it.skipIf(!process.env.GEN_EMOJI)("regenerates the emoji corpus snapshot", { timeout: 120_000 }, async () => {
	const response = await fetch(SOURCE);
	if (!response.ok) throw new Error(`${SOURCE}: ${response.status}`);
	const body = await response.text();
	expect(createHash("sha256").update(body).digest("hex")).toBe(SOURCE_SHA256);
	const emoji = (JSON.parse(body) as Emoji[]).filter(
		(e) => e.tags?.length && !e.label.startsWith("regional indicator"),
	);
	writeFileSync(new URL("./corpus-emoji.json", import.meta.url), JSON.stringify([...new Set(emoji.map(asPickerItem))]));
});
