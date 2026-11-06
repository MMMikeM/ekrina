/**
 * Writes src/components/emoji-glyphs.json: the emoji for each item of
 * bench/corpus-emoji.json, at the same index, since the corpus holds only the
 * names. Rerun it whenever the corpus is regenerated; the file must stay in
 * corpus order, or every row of the landing page's demo shows the wrong emoji.
 * Fetches the generator's pinned source, so it is not part of `pnpm content`:
 *   node scripts/emoji-glyphs.ts
 */
import { deepStrictEqual } from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Must match bench/corpus-emoji-gen.test.ts.
const SOURCE = "https://cdn.jsdelivr.net/npm/emojibase-data@17.0.0/en/data.json";
const SOURCE_SHA256 = "ed014f1049bd370c5794f815850156196ac382850f51c3e9f6a9e83553fb3f01";

type Emoji = { emoji: string; label: string; tags?: string[] };

const asPickerItem = ({ label, tags = [] }: Emoji): string => {
	const said = new Set(label.toLowerCase().split(/\W+/));
	const extra = tags.filter((tag) => !said.has(tag));
	return extra.length ? `${label} — ${extra.join(", ")}` : label;
};

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`${SOURCE}: ${response.status}`);
const body = await response.text();
const digest = createHash("sha256").update(body).digest("hex");
if (digest !== SOURCE_SHA256) throw new Error(`${SOURCE}: SHA-256 ${digest}, expected ${SOURCE_SHA256}`);

const glyphOf = new Map<string, string>();
for (const emoji of JSON.parse(body) as Emoji[]) {
	if (!emoji.tags?.length || emoji.label.startsWith("regional indicator")) continue;
	const item = asPickerItem(emoji);
	if (!glyphOf.has(item)) glyphOf.set(item, emoji.emoji);
}
const corpus: string[] = JSON.parse(readFileSync(join(repoRoot, "bench/corpus-emoji.json"), "utf8"));
deepStrictEqual([...glyphOf.keys()], corpus, "the pinned source no longer rebuilds bench/corpus-emoji.json");

writeFileSync(join(repoRoot, "site/src/components/emoji-glyphs.json"), JSON.stringify([...glyphOf.values()]));
console.log(`emoji-glyphs: ${glyphOf.size} glyphs`);
