import type { Artifact, ColdCell, ProbeTable } from "./artifact.ts";
import { PUBLISHED_SIZE } from "./artifact.ts";
import { META, displayName, foldsFor, gzipKB } from "./libraries.ts";
import { headlineMrr } from "./mrr.ts";

type Align = "left" | "right" | "center";

const mdTable = (header: string[], rows: string[][], align: Align[]): string => {
	const width = header.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
	const pad = (cell: string, i: number): string => {
		if (align[i] === "right") return cell.padStart(width[i]);
		if (align[i] === "left") return cell.padEnd(width[i]);
		const before = Math.floor((width[i] - cell.length) / 2);
		return cell.padStart(cell.length + before).padEnd(width[i]);
	};
	const line = (cells: string[]): string => `| ${cells.map(pad).join(" | ")} |`;
	const ruleOf = (w: number, i: number): string =>
		align[i] === "right"
			? `${"-".repeat(w + 1)}:`
			: align[i] === "center"
				? `:${"-".repeat(w)}:`
				: "-".repeat(w + 2);
	const rule = width.map(ruleOf).join("|");
	return [line(header), `|${rule}|`, ...rows.map(line)].join("\n");
};

const ms = (v: number): string => v.toFixed(2);
const pct = (num: number, den: number): string => `${Math.round((num / den) * 100)}%`;

// Ekrina leads its own table; the rest are alphabetical, which keeps each
// library's base and (all opts) rows adjacent and orders nothing by result.
// Code-unit order on the lowercased label, not localeCompare: collation folds
// the `@` in `@nozbe/microfuzz` away and moves it out of first place.
const speedOrder = (a: string, b: string): number => {
	const ekrina = Number(b.startsWith("ekrina")) - Number(a.startsWith("ekrina"));
	if (ekrina !== 0) return ekrina;
	const [x, y] = [displayName(a).toLowerCase(), displayName(b).toLowerCase()];
	return x < y ? -1 : x > y ? 1 : 0;
};

// Per-library times span three orders of magnitude, so an arithmetic mean would
// only describe the slowest library; the geomean is the standard aggregate for
// multiplicative spreads, and the only valid way to average ratios.
const geomean = (xs: number[]): number =>
	Math.exp(xs.reduce((a, v) => a + Math.log(v), 0) / xs.length);

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/** The library a configuration belongs to: its name without the option suffix. */
/** @public Read by site/scripts/explorer-data.ts, outside knip's workspaces. */
export const libraryOf = (config: string): string =>
	config.replace(/ \((all opts|acronym|indexed|tuned)\)$/, "");

// Unrounded, from the families: the scorecard's two decimals tie configurations
// that the families tell apart.
const mrrOf = (a: Artifact, config: string): number =>
	mean(Object.values(a.families ?? {}).map((families) => headlineMrr(families, config)));

/**
 * The configurations the main pages show: each library at its best-scoring
 * configuration across every scored corpus, its defaults on a tie, plus every Ekrina
 * row. The others are on each library's page in docs/libraries/.
 */
export const headlineConfigs = (a: Artifact): Set<string> => {
	const configs = Object.values(a.scorecard.corpora)[0]?.map((row) => row.library) ?? [];
	const best = new Map<string, string>();
	for (const config of configs) {
		const library = libraryOf(config);
		if (library === "ekrina") {
			best.set(config, config);
			continue;
		}
		const incumbent = best.get(library);
		const better =
			incumbent === undefined ||
			mrrOf(a, config) > mrrOf(a, incumbent) ||
			(mrrOf(a, config) === mrrOf(a, incumbent) && config === library);
		if (better) best.set(library, config);
	}
	return new Set(best.values());
};

/** Every configuration of one library, defaults first. */
const configsOf = (a: Artifact, library: string): string[] =>
	(Object.values(a.scorecard.corpora)[0] ?? [])
		.map((row) => row.library)
		.filter((config) => libraryOf(config) === library)
		.sort((x, y) => Number(x !== library) - Number(y !== library) || (x < y ? -1 : 1));

/** The page slug of a library with more than one configuration. */
const librarySlug = (library: string): string =>
	library
		.replace(/^@nozbe\//, "")
		.replace(/\.js$/, "")
		.toLowerCase();

/** Corpus the per-probe tables are drawn from; the docs say so in prose. */
const PROBE_CORPUS = "native";
const PROBE_SIZE = "10000";

const cellOf = (
	a: Artifact,
	corpus: string,
	kind: string,
	size: string,
	lib: string,
): ColdCell | undefined => a.coldMatrix[corpus]?.[kind]?.[size]?.[lib];

const probeKinds = (a: Artifact, corpus: string): string[] =>
	Object.keys(a.coldMatrix[corpus] ?? {}).filter((k) => k !== "batch");

/** Mean first-answer time across every timed kind — the average cold query. */
const meanColdOf = (a: Artifact, corpus: string, size: string, lib: string): number | null => {
	const cells = probeKinds(a, corpus)
		.map((k) => cellOf(a, corpus, k, size, lib)?.queryMs)
		.filter((v): v is number => v != null);
	return cells.length ? mean(cells) : null;
};

/** Mean one-shot (constructor + first answer, summed per child) across every probe kind. */
export const meanOneShotOf = (
	a: Artifact,
	corpus: string,
	size: string,
	lib: string,
): number | null => {
	const cells = probeKinds(a, corpus)
		.map((k) => cellOf(a, corpus, k, size, lib)?.oneShotMs)
		.filter((v): v is number => v != null);
	return cells.length ? mean(cells) : null;
};

const variantsOf = (a: Artifact, corpus: string): string[] =>
	Object.keys(Object.values(a.coldMatrix[corpus]?.batch ?? {})[0] ?? {});

// A list too short for the published size is timed at its own length, and is
// then shown without a geomean row and kept off the library pages' rankings.
const timedSizeOf = (a: Artifact, corpus: string): string => {
	const sizes = Object.keys(a.coldMatrix[corpus]?.batch ?? {});
	return sizes.includes(String(PUBLISHED_SIZE)) ? String(PUBLISHED_SIZE) : (sizes[0] ?? "");
};
const isRanked = (a: Artifact, corpus: string): boolean =>
	timedSizeOf(a, corpus) === String(PUBLISHED_SIZE);

const BUILD_COLUMNS: Array<[library: string, label: string]> = [
	["ekrina", "Ekrina"],
	["ekrina (indexed)", "Ekrina (indexed)"],
	["@nozbe/microfuzz", "@nozbe/microfuzz"],
	["fast-fuzzy", "fast-fuzzy"],
	["fuse.js", "Fuse.js"],
	["uFuzzy (all opts)", "uFuzzy (all opts)"],
];

// Constructor time alone, from the batch cells (the constructor is timed in
// every child; the batch cell's median is as good as any). fuzzysort has no
// constructor at all — its prepare-all pass lands in its cold query.
const buildTable = (a: Artifact): string => {
	const sizes = Object.keys(a.coldMatrix[PROBE_CORPUS]?.batch ?? {});
	const columns = BUILD_COLUMNS.filter(([lib]) =>
		sizes.some((s) => cellOf(a, PROBE_CORPUS, "batch", s, lib)),
	);
	const rows = sizes.map((size) => [
		Number(size) >= 1000 ? `${Number(size) / 1000}k` : size,
		...columns.map(([lib]) => {
			const cell = cellOf(a, PROBE_CORPUS, "batch", size, lib);
			return cell == null ? "—" : `${ms(cell.indexMs)} ms`;
		}),
	]);
	return mdTable(["build", ...columns.map(([, label]) => label)], rows, [
		"left",
		...columns.map((): Align => "right"),
	]);
};

const gzipBytesOf = (a: Artifact, library: string): number => {
	const bytes = a.gzipBytes?.[library];
	if (bytes === undefined) {
		throw new Error(`no measured size for '${library}': run \`pnpm vpr bench --size --all\``);
	}
	return bytes;
};

const gzipLabel = (a: Artifact, library: string): string =>
	`~${gzipKB(gzipBytesOf(a, library))} kB`;

// Ekrina first, then ascending size.
const bySize = (a: Artifact): string[] =>
	Object.keys(META).sort(
		(x, y) =>
			Number(y === "ekrina") - Number(x === "ekrina") || gzipBytesOf(a, x) - gzipBytesOf(a, y),
	);

const librariesTable = (a: Artifact): string =>
	mdTable(
		["Library", "Gzip", "Deps", "Type"],
		bySize(a).map((name) => {
			const m = META[name];
			const label = name === "ekrina" ? "**Ekrina**" : displayName(name);
			return [label, gzipLabel(a, name), String(m.deps), m.type];
		}),
		["left", "left", "left", "left"],
	);

const COUNTS = ["none", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const ORDINALS = ["", "second-", "third-", "fourth-", "fifth-", "sixth-", "seventh-", "eighth-"];

const ekrinaSizeStanding = (a: Artifact): string => {
	const ekrina = gzipBytesOf(a, "ekrina");
	const larger = bySize(a).filter((name) => gzipBytesOf(a, name) > ekrina);
	const named = larger.map((name) => `${displayName(name)}, at ${gzipLabel(a, name)}`);
	const standing = `${gzipLabel(a, "ekrina")} gzip it is the ${ORDINALS[larger.length]}largest of the ${COUNTS[Object.keys(META).length]}`;
	if (named.length === 0) return standing;
	const list =
		named.length === 1 ? named[0] : `${named.slice(0, -1).join(", ")}, and ${named.at(-1)}`;
	return `${standing}, and only ${list}, ${named.length === 1 ? "is" : "are"} larger`;
};

const isEkrinaVariant = (config: string): boolean =>
	libraryOf(config) === "ekrina" && config !== "ekrina";

const percent = (share: number): string => `${Math.round(100 * share)}%`;

// README.md's comparison: each library once, at its headline configuration,
// on the corpus and list size the per-probe tables use. ms/query is the batch
// cell's per-query time after the warm-up, the search-as-you-type number.
const compareTable = (a: Artifact): string => {
	const rows = a.scorecard.corpora[PROBE_CORPUS];
	if (!rows)
		throw new Error(`no scorecard for corpus '${PROBE_CORPUS}' — run the quality stage first`);
	const headline = headlineConfigs(a);
	const shown = rows
		.filter((r) => headline.has(r.library) && !isEkrinaVariant(r.library))
		.sort(
			(x, y) => Number(y.library === "ekrina") - Number(x.library === "ekrina") || y.mrr - x.mrr,
		);
	return mdTable(
		["Library", "MRR", "ms", "Gzip kB", "Junk", "Typos", "Tiers", "Ranges", "Deps"],
		shown.map((r) => {
			const meta = META[libraryOf(r.library)];
			if (!meta) throw new Error(`no metadata for '${r.library}' in bench/libraries.ts`);
			const batch = cellOf(a, PROBE_CORPUS, "batch", PROBE_SIZE, r.library);
			return [
				r.library === "ekrina" ? "**Ekrina**" : displayName(r.library),
				r.mrr.toFixed(2),
				batch ? ms(batch.restMs ?? batch.queryMs) : "—",
				gzipKB(gzipBytesOf(a, libraryOf(r.library))).toFixed(1),
				r.junk === undefined ? "—" : percent(r.junk),
				meta.typoReach ?? "none",
				meta.features.tier,
				meta.features.ranges,
				String(meta.deps),
			];
		}),
		["left", "right", "right", "right", "right", "left", "center", "center", "right"],
	);
};

const speedRowsOf = (a: Artifact, corpus: string, configs: Set<string>): string[] =>
	variantsOf(a, corpus)
		.filter((name) => foldsFor(corpus, name) && configs.has(name))
		.sort(speedOrder);

// The 100k tables: every cell process-cold. The scale table is the one-shot
// measurement (constructor, mean first answer, and their measured sum); the
// batch table is the session (warmup match + 24 probes, one process).
const scaleTable = (
	a: Artifact,
	corpus: string,
	configs: Set<string>,
	aggregate = true,
): string => {
	const size = timedSizeOf(a, corpus);
	const shown = speedRowsOf(a, corpus, configs);
	const ekrinaBatch = cellOf(a, corpus, "batch", size, "ekrina");
	if (!ekrinaBatch)
		throw new Error(`no ekrina batch cell for '${corpus}' — run the cold stage first`);

	const ekrinaOneShot = meanOneShotOf(a, corpus, size, "ekrina") as number;
	const rows = shown.map((lib) => {
		const batch = cellOf(a, corpus, "batch", size, lib) as ColdCell;
		const cold = meanColdOf(a, corpus, size, lib) as number;
		const oneShot = meanOneShotOf(a, corpus, size, lib) as number;
		const emphasise = (v: string): string => (lib === "ekrina" ? `**${v}**` : v);
		return [
			lib === "ekrina" ? "**Ekrina**" : displayName(lib),
			`${ms(batch.indexMs)} ms`,
			`${ms(cold)} ms`,
			`${ms(oneShot)} ms`,
			emphasise(pct(oneShot, ekrinaOneShot)),
		];
	});

	const agg = {
		index: geomean(
			shown.map((l) => (cellOf(a, corpus, "batch", size, l) as ColdCell).indexMs || 0.01),
		),
		cold: geomean(shown.map((l) => meanColdOf(a, corpus, size, l) as number)),
		oneShot: geomean(shown.map((l) => meanOneShotOf(a, corpus, size, l) as number)),
	};
	// geomean-of-ratios is the ratio-of-geomeans, so the rel cell is equally
	// the geomean of the rel column and field-geomean ÷ ekrina.
	if (aggregate)
		rows.push([
			"_all libraries (geomean)_",
			`${ms(agg.index)} ms`,
			`${ms(agg.cold)} ms`,
			`${ms(agg.oneShot)} ms`,
			pct(agg.oneShot, ekrinaOneShot),
		]);

	return mdTable(["Library", "index", "cold query", "total", "total rel"], rows, [
		"left",
		"right",
		"right",
		"right",
		"right",
	]);
};

// Construction plus every answer: one session from \`new\` to its last result,
// charging each design for its setup wherever that design pays it.
const sessionMsOf = (batch: ColdCell): number => batch.indexMs + batch.queryMs;

const batchTable = (
	a: Artifact,
	corpus: string,
	configs: Set<string>,
	aggregate = true,
): string => {
	const size = timedSizeOf(a, corpus);
	const shown = speedRowsOf(a, corpus, configs);
	const ekrinaBatch = cellOf(a, corpus, "batch", size, "ekrina");
	if (!ekrinaBatch)
		throw new Error(`no ekrina batch cell for '${corpus}' — run the cold stage first`);

	const batches = shown.map((lib) => cellOf(a, corpus, "batch", size, lib) as ColdCell);
	const ekrinaSession = sessionMsOf(ekrinaBatch);
	const columns = (b: {
		build: number;
		first: number;
		rest: number;
		session: number;
	}): string[] => [
		`${ms(b.build)} ms`,
		`${ms(b.first)} ms`,
		`${ms(b.rest)} ms`,
		`${ms(b.session)} ms`,
	];
	const partsOf = (batch: ColdCell) => ({
		build: batch.indexMs,
		first: batch.firstMs,
		rest: batch.restMs ?? batch.queryMs,
		session: sessionMsOf(batch),
	});
	const rows = shown.map((lib, i) => {
		const parts = partsOf(batches[i]);
		const emphasise = (v: string): string => (lib === "ekrina" ? `**${v}**` : v);
		return [
			lib === "ekrina" ? "**Ekrina**" : displayName(lib),
			...columns(parts),
			emphasise(pct(parts.session, ekrinaSession)),
		];
	});

	if (aggregate) {
		const geo = (part: keyof ReturnType<typeof partsOf>): number =>
			geomean(batches.map((batch) => partsOf(batch)[part]));
		const session = geo("session");
		rows.push([
			"_all libraries (geomean)_",
			...columns({ build: geo("build"), first: geo("first"), rest: geo("rest"), session }),
			pct(session, ekrinaSession),
		]);
	}

	return mdTable(
		["Library", "build", "first answer", "per query", "session total", "session rel"],
		rows,
		["left", "right", "right", "right", "right", "right"],
	);
};

export const omittedFrom = (a: Artifact, corpus: string): string[] =>
	variantsOf(a, corpus).filter((name) => !foldsFor(corpus, name));

const scorecardTable = (
	a: Artifact,
	corpus: string,
	shown: Set<string>,
	emphasised: Set<string> = new Set(),
): string => {
	const rows = a.scorecard.corpora[corpus];
	if (!rows) throw new Error(`no scorecard for corpus '${corpus}' — run the quality stage first`);
	return mdTable(
		["Library", "MRR", "Junk", "index ms", "cold ms", "session ms", "per query"],
		rows
			.filter((r) => shown.has(r.library))
			.map((r) => {
				const batch = cellOf(a, corpus, "batch", PROBE_SIZE, r.library);
				const cold = meanColdOf(a, corpus, PROBE_SIZE, r.library);
				const name = displayName(r.library);
				return [
					emphasised.has(r.library) ? `**${name}**` : name,
					r.mrr.toFixed(2),
					r.junk === undefined ? "—" : percent(r.junk),
					batch ? ms(batch.indexMs) : "—",
					cold == null ? "—" : ms(cold),
					batch ? ms(sessionMsOf(batch)) : "—",
					batch ? ms(batch.restMs ?? batch.queryMs) : "—",
				];
			}),
		["left", "right", "right", "right", "right", "right", "right"],
	);
};

// Ekrina's base and acronym rows first, then each other library at its
// headline configuration, best MRR first. Ekrina (indexed) ranks exactly as
// base Ekrina, so it would only repeat a column.
const familyColumns = (a: Artifact): string[] =>
	[...headlineConfigs(a)]
		.filter((config) => config !== "ekrina (indexed)")
		.sort(
			(x, y) =>
				Number(libraryOf(y) === "ekrina") - Number(libraryOf(x) === "ekrina") ||
				mrrOf(a, y) - mrrOf(a, x),
		);

// Scored families show MRR@10 under their group; refusal rows show the share
// of their queries each library answered at all, which a result cap cannot
// shrink the way it shrinks a row count.
const familyTable = (a: Artifact, corpus: string, scored: boolean, columns: string[]): string => {
	const families = (a.families?.[corpus] ?? []).filter((family) => family.scored === scored);
	const cell = (family: (typeof families)[number], lib: string): string =>
		scored ? (family.mrr[lib] ?? 0).toFixed(2) : (family.answered?.[lib]?.toFixed(2) ?? "—");
	return mdTable(
		[
			...(scored ? ["Group"] : []),
			scored ? "Family" : "Query nothing answers",
			...columns.map(displayName),
		],
		families.map((family) => [
			...(scored ? [family.group ?? ""] : []),
			family.kind,
			...columns.map((lib) => cell(family, lib)),
		]),
		[...(scored ? ["left" as Align] : []), "left", ...columns.map((): Align => "right")],
	);
};

/**
 * The guaranteed-miss probe has no rank to report, so its table times the
 * refusal instead: each library's cold time for a hopeless query against its
 * own cold time for one that matches.
 */
const missTable = (a: Artifact, probes: ProbeTable[]): string => {
	const miss = probes.find((p) => p.kind === "miss");
	const reference = probes.find((p) => p.kind === "short-word");
	if (!miss || !reference) throw new Error("probe set is missing the miss or short-word query");
	return mdTable(
		["Library", "matches", "cold ms", `vs \`${reference.query}\``],
		familyColumns(a)
			.filter((lib) => lib !== "ekrina (acronym)")
			.map((lib) => {
				const missCold = cellOf(a, PROBE_CORPUS, "miss", PROBE_SIZE, lib);
				const refCold = cellOf(a, PROBE_CORPUS, "short-word", PROBE_SIZE, lib);
				return [
					displayName(lib),
					String(miss.cells[lib].count),
					missCold ? missCold.queryMs.toFixed(3) : "—",
					missCold && refCold ? pct(missCold.queryMs, refCold.queryMs) : "—",
				];
			}),
		["left", "right", "right", "right"],
	);
};

const sessionTable = (a: Artifact): string => {
	const session = a.session;
	if (!session) throw new Error("no session data — run the quality stage first");
	return mdTable(
		["Library", ...session.steps.map((s) => `\`${s}\``), "session"],
		session.rows.map((r) => [displayName(r.library), ...r.stepMs.map(ms), ms(r.sessionMs)]),
		["left", ...session.steps.map((): Align => "right"), "right"],
	);
};

const longtextTable = (a: Artifact): string => {
	const longtext = a.longtext;
	if (!longtext) throw new Error("no long-text data — run the quality stage first");
	return mdTable(
		["doc chars", "fuzzy junk", "corrected", "present hits", "miss ms"],
		longtext.rows.map((r) => [
			String(r.docChars),
			`${(100 * r.junkRate).toFixed(1)}%`,
			`${(100 * r.correctedRate).toFixed(1)}%`,
			`${r.presentHits}/${r.presentProbes}`,
			r.missMs.toFixed(3),
		]),
		["right", "right", "right", "right", "right"],
	);
};

const mb = (bytes: number): string => (bytes / 2 ** 20).toFixed(2);

const MEMORY_STEPS = [
	["match", "short-word"],
	["miss", "miss"],
	["long", "long-word"],
] as const;

const memoryTable = (a: Artifact): string => {
	const cells = a.memory?.[PROBE_CORPUS];
	if (!cells) throw new Error(`no ${PROBE_CORPUS} memory data — run the memory stage first`);
	const stepLabel = (kind: string): string => {
		const query = a.probes[PROBE_CORPUS]?.find((p) => p.kind === kind)?.query;
		return query ? `+ \`${query}\`` : `+ ${kind}`;
	};
	const headline = headlineConfigs(a);
	return mdTable(
		["Library", "built MB", ...MEMORY_STEPS.map(([, kind]) => stepLabel(kind)), "dropped MB"],
		Object.keys(cells)
			.filter((lib) => headline.has(lib))
			.sort(speedOrder)
			.map((lib) => {
				const cell = cells[lib];
				return [
					displayName(lib),
					mb(cell.built.totalBytes),
					...MEMORY_STEPS.map(([step]) => mb(cell[step].totalBytes)),
					cell.collected ? mb(cell.residueBytes) : `${mb(cell.residueBytes)} (not collected)`,
				];
			}),
		["left", "right", ...MEMORY_STEPS.map((): Align => "right"), "right"],
	);
};

/** Every injectable region, keyed by the id its marker carries. */
export const regions = (a: Artifact): Record<string, string> => {
	const out: Record<string, string> = {};
	if (Object.keys(a.coldMatrix).length) out.build = buildTable(a);
	out.libraries = librariesTable(a);
	out["ekrina-gzip"] = gzipLabel(a, "ekrina");
	out["ekrina-size-standing"] = ekrinaSizeStanding(a);
	if (a.scorecard.corpora[PROBE_CORPUS]) out.compare = compareTable(a);
	const headline = headlineConfigs(a);
	for (const corpus of Object.keys(a.coldMatrix)) {
		out[`speed-${corpus}`] = scaleTable(a, corpus, headline, isRanked(a, corpus));
		out[`batch-${corpus}`] = batchTable(a, corpus, headline, isRanked(a, corpus));
	}
	for (const corpus of Object.keys(a.scorecard.corpora)) {
		out[`scorecard-${corpus}`] = scorecardTable(a, corpus, headline);
	}

	for (const corpus of Object.keys(a.families ?? {})) {
		out[`families-${corpus}`] = familyTable(a, corpus, true, familyColumns(a));
		out[`refusals-${corpus}`] = familyTable(a, corpus, false, familyColumns(a));
	}

	// One page per library with more than one configuration (docs/libraries/).
	const libraries = new Set(
		(Object.values(a.scorecard.corpora)[0] ?? []).map((r) => libraryOf(r.library)),
	);
	for (const library of libraries) {
		const configs = configsOf(a, library);
		if (configs.length < 2) continue;
		const slug = librarySlug(library);
		for (const corpus of Object.keys(a.scorecard.corpora)) {
			const marked = library === "ekrina" ? new Set<string>() : headline;
			out[`library-${slug}-scorecard-${corpus}`] = scorecardTable(
				a,
				corpus,
				new Set(configs),
				marked,
			);
		}
		for (const corpus of Object.keys(a.families ?? {})) {
			out[`library-${slug}-families-${corpus}`] = familyTable(a, corpus, true, configs);
		}
		// Ekrina's base row is the 100% every rel cell is measured against.
		const timed = new Set([...configs, "ekrina"]);
		for (const corpus of Object.keys(a.coldMatrix)) {
			if (!isRanked(a, corpus) || speedRowsOf(a, corpus, new Set(configs)).length < 2) continue;
			out[`library-${slug}-speed-${corpus}`] = scaleTable(a, corpus, timed, false);
			out[`library-${slug}-batch-${corpus}`] = batchTable(a, corpus, timed, false);
		}
	}
	const probes = a.probes[PROBE_CORPUS] ?? [];
	if (probes.some((probe) => probe.kind === "miss")) out["probe-miss"] = missTable(a, probes);

	if (a.session) out.session = sessionTable(a);
	if (a.longtext) out.longtext = longtextTable(a);
	if (a.memory) out.memory = memoryTable(a);
	return out;
};
