// Hand-maintained: every `features` cell is verified against that library's
// current source. Sizes are measured from `api` (bench/size.ts).

type Features = {
	ranges: "yes" | "opt-in" | "partial" | "no";
	tier: "yes" | "no";
	diacritics: "yes" | "opt-in" | "no";
	multiWord: "yes" | "opt-in" | "no";
	perField: "yes" | "no";
	typos: "yes" | "opt-in" | "partial" | "no";
};

export type LibraryMeta = {
	/** The primary API the size is measured from: `name` is an export of `from`, or `default`. */
	api: { from: string; name: string };
	deps: number;
	type: string;
	module: "esm" | "cjs" | "dual";
	updated: string | null;
	features: Features;
	/** How far its typo correction reaches, as README.md's comparison says it; null when it corrects none. */
	typoReach: "≤ 2 edits" | "≤ 1 edit" | "any" | null;
};

export const META: Record<string, LibraryMeta> = {
	ekrina: {
		api: { from: "ekrina", name: "createSearcher" },
		deps: 0,
		type: "subsequence (tiered)",
		module: "dual",
		updated: null,
		features: {
			ranges: "yes",
			tier: "yes",
			diacritics: "yes",
			multiWord: "yes",
			perField: "yes",
			typos: "yes",
		},
		typoReach: "≤ 2 edits",
	},
	"@nozbe/microfuzz": {
		api: { from: "@nozbe/microfuzz", name: "default" },
		deps: 0,
		type: "subsequence",
		module: "cjs",
		updated: "2023-07-18",
		features: {
			ranges: "yes",
			tier: "no",
			diacritics: "yes",
			multiWord: "yes",
			perField: "yes",
			typos: "no",
		},
		typoReach: null,
	},
	fuzzysort: {
		api: { from: "fuzzysort", name: "default" },
		deps: 0,
		type: "subsequence",
		module: "cjs",
		updated: "2024-10-14",
		features: {
			ranges: "yes",
			tier: "no",
			diacritics: "yes",
			multiWord: "yes",
			perField: "yes",
			typos: "no",
		},
		typoReach: null,
	},
	"match-sorter": {
		api: { from: "match-sorter", name: "matchSorter" },
		deps: 2,
		type: "subsequence (tiered)",
		module: "dual",
		updated: "2026-04-15",
		features: {
			ranges: "no",
			tier: "yes",
			diacritics: "yes",
			multiWord: "no",
			perField: "yes",
			typos: "no",
		},
		typoReach: null,
	},
	uFuzzy: {
		api: { from: "@leeoniya/ufuzzy", name: "default" },
		deps: 0,
		type: "subsequence",
		module: "dual",
		updated: "2025-08-22",
		features: {
			ranges: "yes",
			tier: "no",
			diacritics: "opt-in",
			multiWord: "opt-in",
			perField: "no",
			typos: "opt-in",
		},
		typoReach: "≤ 1 edit",
	},
	fuzzy: {
		api: { from: "fuzzy", name: "default" },
		deps: 0,
		type: "substring",
		module: "cjs",
		updated: "2016-10-01",
		features: {
			ranges: "partial",
			tier: "no",
			diacritics: "no",
			multiWord: "no",
			perField: "no",
			typos: "no",
		},
		typoReach: null,
	},
	"fuse.js": {
		api: { from: "fuse.js", name: "default" },
		deps: 0,
		type: "typo-tolerant",
		module: "dual",
		updated: "2026-07-13",
		features: {
			ranges: "opt-in",
			tier: "no",
			diacritics: "opt-in",
			multiWord: "opt-in",
			perField: "yes",
			typos: "yes",
		},
		typoReach: "any",
	},
	"fast-fuzzy": {
		api: { from: "fast-fuzzy", name: "Searcher" },
		deps: 1,
		type: "typo-tolerant",
		module: "dual",
		updated: "2022-11-05",
		features: {
			ranges: "partial",
			tier: "no",
			diacritics: "no",
			multiWord: "no",
			perField: "yes",
			typos: "yes",
		},
		typoReach: "any",
	},
};

/** Published sizes are kB of 1,000 bytes to one decimal, as in `~7.7 kB`. */
export const gzipKB = (bytes: number): number => Number((bytes / 1000).toFixed(1));

// "ekrina (acronym)", "<lib> (all opts)" and "<lib> (tuned)" are configurations of a base library
// and share its size, deps and type.
/** @public Read by site/src/bench.ts, outside knip's workspaces. */
export const baseName = (name: string): string => name.replace(/ \([^)]+\)$/, "");

const metaFor = (name: string): LibraryMeta | undefined => META[name] ?? META[baseName(name)];

const DISPLAY: Record<string, string> = { ekrina: "Ekrina", "fuse.js": "Fuse.js" };

/** Prose spelling of a configuration name, suffix preserved: `fuse.js (all opts)` → `Fuse.js (all opts)`. */
export const displayName = (name: string): string => {
	const base = baseName(name);
	return (DISPLAY[base] ?? base) + name.slice(base.length);
};

/**
 * Whether a configuration actually does the corpus's task. The accented corpus
 * requires diacritic folding; a row that skips it is timing a different, easier
 * job, so it is omitted from that corpus's table rather than flagged in it.
 */
export const foldsFor = (corpus: string, name: string): boolean => {
	if (corpus !== "native") return true;
	const diacritics = metaFor(name)?.features.diacritics;
	return diacritics === "yes" || (diacritics === "opt-in" && / \((all opts|tuned)\)$/.test(name));
};
