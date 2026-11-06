// Hand-maintained, not measured: sizes are `esbuild --bundle --minify`
// (tree-shaken to the primary API) piped through gzip, in kB of 1,000 bytes,
// and every `features` cell is verified against that library's current source.

export type Features = {
	ranges: "yes" | "opt-in" | "partial" | "no";
	tier: "yes" | "no";
	diacritics: "yes" | "opt-in" | "no";
	multiWord: "yes" | "opt-in" | "no";
	perField: "yes" | "no";
	typos: "yes" | "opt-in" | "partial" | "no";
};

export type LibraryMeta = {
	gzipKB: number;
	deps: number;
	type: string;
	module: "esm" | "cjs" | "dual";
	updated: string | null;
	features: Features;
	/** How far its typo correction reaches, as README.md's comparison says it; null when it corrects none. */
	typoReach: "two edits" | "one edit" | "full" | null;
};

export const META: Record<string, LibraryMeta> = {
	ekrina: {
		gzipKB: 7.7,
		deps: 0,
		type: "subsequence (tiered)",
		module: "esm",
		updated: null,
		features: {
			ranges: "yes",
			tier: "yes",
			diacritics: "yes",
			multiWord: "yes",
			perField: "yes",
			typos: "partial",
		},
		typoReach: "two edits",
	},
	"@nozbe/microfuzz": {
		gzipKB: 1.7,
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
		gzipKB: 3.7,
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
		gzipKB: 3.5,
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
		gzipKB: 4.2,
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
		typoReach: "one edit",
	},
	fuzzy: {
		gzipKB: 0.8,
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
		gzipKB: 9.6,
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
		typoReach: "full",
	},
	"fast-fuzzy": {
		gzipKB: 11,
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
		typoReach: "full",
	},
};

// "ekrina (acronym)", "<lib> (all opts)" and "<lib> (tuned)" are configurations of a base library
// and share its size, deps and type.
export const baseName = (name: string): string => name.replace(/ \([^)]+\)$/, "");

export const metaFor = (name: string): LibraryMeta | undefined =>
	META[name] ?? META[baseName(name)];

const DISPLAY: Record<string, string> = { ekrina: "Ekrina", "fuse.js": "Fuse.js" };

/** Prose spelling of a configuration name, suffix preserved: `fuse.js (all opts)` → `Fuse.js (all opts)`. */
export const displayName = (name: string): string => {
	const base = baseName(name);
	return (DISPLAY[base] ?? base) + name.slice(base.length);
};

/** Size-table order: ekrina first, then ascending gzip. */
export const bySize = (a: string, b: string): number =>
	Number(b === "ekrina") - Number(a === "ekrina") || (META[a]?.gzipKB ?? 0) - (META[b]?.gzipKB ?? 0);

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
