/**
 * One-shot generator for corpus-en.json, corpus-native.json and misspellings.json. Wikidata
 * changes daily, so these files, not this script, are the corpus: running it
 * again redraws every item and every query sampled from them. Gated:
 *   GEN_WIKIDATA=1 pnpm --filter=ekrina-bench exec vitest run corpus-wikidata-gen
 *
 * Items are the best-known Wikidata entities of five kinds, by sitelink count,
 * through the QLever mirror (query.wikidata.org times out on a sort this
 * size). Wikidata is CC0. The misspellings are Wikipedia's list for machines
 * at a pinned revision, CC BY-SA 4.0, so misspellings.json carries its source
 * and licence with it.
 */
import { writeFileSync } from "node:fs";
import { it } from "vite-plus/test";

const SIZE = 100_000;
const USER_AGENT = "ekrina-bench/0.1 (https://github.com/MMMikeM/ekrina; benchmark corpus)";
const ENDPOINT = "https://qlever.dev/api/wikidata";
const MISSPELLINGS_REVISION = 1199637275;

type Kind = { name: string; types: string[]; nativeName: string; fetch: number };

const KINDS: Kind[] = [
	{ name: "people", types: ["Q5"], nativeName: "P1559", fetch: 40_000 },
	{ name: "places", types: ["Q515", "Q1549591", "Q3957", "Q532"], nativeName: "P1705", fetch: 24_000 },
	{ name: "works", types: ["Q11424", "Q7725634", "Q482994", "Q7889", "Q5398426"], nativeName: "P1476", fetch: 24_000 },
	{ name: "organisations", types: ["Q4830453", "Q783794", "Q163740", "Q3918", "Q476028"], nativeName: "P1448", fetch: 18_000 },
	{ name: "products", types: ["Q431289", "Q10929058", "Q7397"], nativeName: "P1705", fetch: 12_000 },
];

// Every 20 items hold 7 people, 4 places, 4 works, 3 organisations and 2
// products, so any prefix of the corpus keeps the mix (1k ⊂ 10k ⊂ 100k).
const PATTERN = [0, 1, 2, 0, 3, 0, 1, 2, 4, 0, 3, 1, 0, 2, 0, 3, 1, 2, 0, 4];

const query = ({ types, nativeName, fetch }: Kind): string => `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?item (SAMPLE(?en) AS ?label) (SAMPLE(?nat) AS ?native) (MAX(?s) AS ?links) WHERE {
	VALUES ?type { ${types.map((type) => `wd:${type}`).join(" ")} }
	?item wdt:P31 ?type ; wikibase:sitelinks ?s ; rdfs:label ?en .
	FILTER(LANG(?en) = "en")
	OPTIONAL { ?item wdt:${nativeName} ?nat }
} GROUP BY ?item ORDER BY DESC(?links) ?item LIMIT ${fetch}`;

const parseCsv = (text: string): string[][] => {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		if (quoted) {
			if (char !== '"') field += char;
			else if (text[i + 1] === '"') field += text[i++];
			else quoted = false;
		} else if (char === '"') {
			quoted = true;
		} else if (char === "," || char === "\n") {
			row.push(field);
			field = "";
			if (char === "\n") {
				rows.push(row);
				row = [];
			}
		} else if (char !== "\r") {
			field += char;
		}
	}
	if (field || row.length) rows.push([...row, field]);
	return rows.slice(1);
};

const shuffled = <T>(xs: T[], seed: number): T[] => {
	const out = [...xs];
	let state = seed;
	for (let i = out.length - 1; i > 0; i--) {
		state = (state * 1103515245 + 12345) & 0x7fffffff;
		const j = state % (i + 1);
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
};

const get = async (url: string): Promise<string> => {
	const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/csv" } });
	if (!response.ok) throw new Error(`${url}: ${response.status}`);
	return response.text();
};

const misspellingsOf = (page: string): Record<string, string[]> => {
	const out: Record<string, string[]> = {};
	for (const line of page.split("\n")) {
		const pair = /^\s*([^\s>-][^>]*?)->(.+)$/.exec(line);
		if (!pair) continue;
		for (const correct of pair[2].split(",").map((word) => word.trim().toLowerCase())) {
			if (/^[a-z]+$/.test(correct)) (out[correct] ??= []).push(pair[1].trim().toLowerCase());
		}
	}
	return out;
};

it.skipIf(!process.env.GEN_WIKIDATA)("regenerates the Wikidata corpus and misspelling snapshots", { timeout: 600_000 }, async () => {
	const queues: string[][][] = [];
	for (const [k, kind] of KINDS.entries()) {
		const rows = parseCsv(await get(`${ENDPOINT}?${new URLSearchParams({ query: query(kind) })}`));
		queues.push(shuffled(rows, 7 + k));
	}
	const en: string[] = [];
	const native: string[] = [];
	const seen = new Set<string>();
	for (let i = 0; en.length < SIZE; i++) {
		const queue = queues[PATTERN[i % PATTERN.length]];
		let row = queue.shift();
		while (row && seen.has(row[1])) row = queue.shift();
		if (!row) throw new Error(`ran out of ${KINDS[PATTERN[i % PATTERN.length]].name}`);
		seen.add(row[1]);
		en.push(row[1]);
		native.push(row[2] || row[1]);
	}
	writeFileSync(new URL("./corpus-en.json", import.meta.url), JSON.stringify(en));
	writeFileSync(new URL("./corpus-native.json", import.meta.url), JSON.stringify(native));

	const page = await get(`https://en.wikipedia.org/w/index.php?oldid=${MISSPELLINGS_REVISION}&action=raw`);
	const source = `https://en.wikipedia.org/w/index.php?title=Wikipedia:Lists_of_common_misspellings/For_machines&oldid=${MISSPELLINGS_REVISION}`;
	writeFileSync(
		new URL("./misspellings.json", import.meta.url),
		JSON.stringify({ source, licence: "CC BY-SA 4.0", misspellings: misspellingsOf(page) }),
	);
});
