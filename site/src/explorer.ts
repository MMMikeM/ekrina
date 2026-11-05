import * as Plot from "@observablehq/plot";
import { geoCircle } from "d3-geo";
import { scalePoint } from "d3-scale";
import { JSDOM } from "jsdom";

export type CorpusView = "all" | "en" | "native" | "emoji";

export type ExplorerLibrary = {
	config: string;
	slug: string;
	name: string;
	/** One value per axis, 0 to 1, higher is better. */
	values: Record<CorpusView, number[]>;
	/** Whether the configuration the page shows corrects typos at all. */
	correctsTypos: boolean;
	/** The scorecard's group-weighted MRR on each corpus, and their mean. */
	headline: Record<CorpusView, number>;
	/** The headline MRR, and the 24 timed queries summarised per list size. */
	timing: Record<TimedCorpus, CorpusTiming>;
};

export type TimedCorpus = "en" | "native";
export type ListSize = "10000" | "100000";

export type SizeTiming = {
	medianMs: number;
	slowestMs: number;
	/** How many of the timed queries answered within one frame. */
	withinFrame: number;
	queries: number;
	/** Constructor plus first answer, in a fresh process. */
	firstMs: number;
	/** Each timed query's median time, in the order of `ExplorerData.queries`. */
	perQueryMs: number[];
};

export type CorpusTiming = { mrr: number; sizes: Record<ListSize, SizeTiming> };

export type ExplorerData = {
	frameMs: number;
	/** The timed queries, in the order every `perQueryMs` follows. */
	queries: Record<TimedCorpus, string[]>;
	axes: string[];
	corpora: { id: Exclude<CorpusView, "all">; families: number }[];
	libraries: ExplorerLibrary[];
};

const EKRINA = "ekrina";
// Tags each library's marks so radarSvg can find them in Plot's output.
const LIBRARY_LABEL = "library:";

// Plot's radar recipe: an azimuthal-equidistant projection centred on the
// pole, longitude for the axis and distance from the pole for the value. This
// close to the pole the projection is effectively flat, so the edges between
// axes draw straight.
const RADIUS_DEGREES = 0.5;
const latitude = (value: number) => 90 - value * RADIUS_DEGREES;
const ring = (value: number) =>
	geoCircle()
		.center([0, 90])
		.radius(value * RADIUS_DEGREES)();

// Moves each library tag from the elements Plot drew onto their mark's group,
// as `data-lib`, and swaps the tag for the library's name.
const tagLibraries = (svg: SVGSVGElement, data: ExplorerData) => {
	for (const element of svg.querySelectorAll(`[aria-label^="${LIBRARY_LABEL}"]`)) {
		const slug = element.getAttribute("aria-label")!.slice(LIBRARY_LABEL.length);
		const library = data.libraries.find((candidate) => candidate.slug === slug);
		element.setAttribute("aria-label", library?.name ?? slug);
		if (slug !== EKRINA) {
			element.parentElement?.setAttribute("data-lib", slug);
		}
	}
};

let plotStylesheet = "";

// Plot puts the same stylesheet in every chart it draws; the page ships it once.
const takeStylesheet = (svg: SVGSVGElement) => {
	for (const style of svg.querySelectorAll("style")) {
		plotStylesheet ||= style.textContent ?? "";
		style.remove();
	}
};

/** The stylesheet every chart this module drew shares, for the page to include once. */
export const chartStylesheet = (): string => plotStylesheet;

// Axis labels anchor away from the centre, so none sits on a vertex: start on
// the right half, end on the left, above the top axis and below the bottom one.
type LabelSide = "right" | "left" | "top" | "bottom";
const sideOf = (longitude: number): LabelSide => {
	const radians = (longitude * Math.PI) / 180;
	const across = Math.sin(radians);
	if (across > 0.2) return "right";
	if (across < -0.2) return "left";
	return Math.cos(radians) < 0 ? "top" : "bottom";
};
const LABEL_PLACEMENTS: { side: LabelSide; dx: number; dy: number; textAnchor: "start" | "middle" | "end" }[] = [
	{ side: "right", dx: 8, dy: 0, textAnchor: "start" },
	{ side: "left", dx: -8, dy: 0, textAnchor: "end" },
	{ side: "top", dx: 0, dy: -10, textAnchor: "middle" },
	{ side: "bottom", dx: 0, dy: 12, textAnchor: "middle" },
];

type Vertex = { library: ExplorerLibrary; axis: string; value: number };

const libraryMarks = (
	library: ExplorerLibrary,
	vertices: Vertex[],
	longitude: (axis: string) => number | undefined,
): Plot.Markish[] => {
	const isEkrina = library.config === EKRINA;
	const colour = isEkrina ? "var(--chart-ekrina)" : "var(--chart-subject)";
	// A channel, not a constant: Plot puts it on each path and dot it draws.
	const ariaLabel = () => `${LIBRARY_LABEL}${library.slug}`;
	const at = { x: (d: Vertex) => longitude(d.axis), y: (d: Vertex) => latitude(d.value) };
	const marks = [
		...(isEkrina
			? []
			: [
					Plot.area(vertices, {
						x1: at.x,
						y1: at.y,
						x2: 0,
						y2: 90,
						fill: colour,
						fillOpacity: 0.16,
						curve: "linear-closed",
						ariaLabel,
					}),
				]),
		Plot.line(vertices, {
			...at,
			stroke: colour,
			strokeWidth: isEkrina ? 2 : 2.5,
			strokeLinejoin: "round",
			curve: "linear-closed",
			ariaLabel,
		}),
		Plot.dot(vertices, {
			...at,
			r: isEkrina ? 3.5 : 4.5,
			fill: colour,
			stroke: "var(--paper)",
			strokeWidth: 2,
			title: (d: Vertex) => `${d.library.name}\n${d.axis}: ${d.value.toFixed(2)}`,
			ariaLabel,
		}),
	];
	return marks;
};

/**
 * One radar per corpus view, holding every library's outline; the page's CSS
 * shows Ekrina and the picked library. Each library's marks carry `data-lib`.
 */
export const radarSvg = (data: ExplorerData, view: CorpusView): string => {
	const document = new JSDOM("").window.document;
	const longitude = scalePoint(data.axes, [180, -180]).padding(0.5).align(1);
	const verticesOf = (library: ExplorerLibrary): Vertex[] =>
		data.axes.map((axis, k) => ({ library, axis, value: library.values[view][k] ?? 0 }));
	const ekrina = data.libraries.find((library) => library.config === EKRINA);
	const others = data.libraries.filter((library) => library !== ekrina);
	const drawn = [...others, ...(ekrina ? [ekrina] : [])];

	const svg = Plot.plot({
		document,
		width: 440,
		height: 380,
		marginTop: 28,
		marginBottom: 28,
		marginLeft: 70,
		marginRight: 70,
		style: {
			background: "none",
			color: "var(--ink-muted)",
			fontFamily: "var(--__sl-font-mono)",
			fontSize: "13px",
			overflow: "visible",
		},
		projection: {
			type: "azimuthal-equidistant",
			rotate: [0, -90],
			domain: ring(1.3),
		},
		marks: [
			Plot.geo([0.25, 0.5, 0.75, 1], { geometry: ring, stroke: "var(--line)", fill: "none" }),
			Plot.link(data.axes, {
				x1: (axis: string) => longitude(axis),
				y1: latitude(1),
				x2: 0,
				y2: 90,
				stroke: "var(--line)",
			}),
			...LABEL_PLACEMENTS.map(({ side, dx, dy, textAnchor }) =>
				Plot.text(
					data.axes.filter((axis) => sideOf(longitude(axis) ?? 0) === side),
					{
						x: (axis: string) => longitude(axis),
						y: latitude(1.08),
						dx,
						dy,
						textAnchor,
						text: Plot.identity,
						fill: "var(--ink)",
					},
				),
			),
			...drawn.flatMap((library) => libraryMarks(library, verticesOf(library), longitude)),
		],
	}) as SVGSVGElement;

	tagLibraries(svg, data);
	takeStylesheet(svg);
	svg.removeAttribute("width");
	svg.removeAttribute("height");
	svg.setAttribute("role", "img");
	svg.setAttribute("aria-label", `Ekrina against the picked library, MRR@10 by query group, ${view === "all" ? "mean of three corpora" : `${view} corpus`}`);
	return svg.outerHTML;
};

const STRIP_DOMAIN: [number, number] = [0.07, 300];
const STRIP_TICKS = [0.1, 1, 10, 100];

const SIZE_LABEL: Record<ListSize, string> = { "10000": "10k items", "100000": "100k items" };

const ratio = (a: number, b: number) => {
	const r = a / b;
	return r >= 10 ? r.toFixed(0) : r.toFixed(1);
};

export const formatMrr = (x: number): string => x.toFixed(2);
export const formatMs = (x: number): string =>
	x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2);

export type Side = "ekrina" | "picked";

/** One measure, Ekrina against the picked library, with the winner's margin. */
export type ScoreColumn = {
	label: string;
	/** The header where the table is narrow. */
	shortLabel: string;
	ekrina: string;
	picked: string;
	/** Null when the two are too close to call; the margin then says so. */
	winner: Side | null;
	margin: string;
};

// Medians within 15% of each other trade places between runs.
export const SPEED_TIE = 1.15;

const medianColumn = (
	label: string,
	shortLabel: string,
	ekrina: SizeTiming,
	picked: SizeTiming,
): ScoreColumn => {
	const slower = Math.max(ekrina.medianMs, picked.medianMs);
	const faster = Math.min(ekrina.medianMs, picked.medianMs);
	const tied = slower / faster < SPEED_TIE;
	return {
		label,
		shortLabel,
		ekrina: formatMs(ekrina.medianMs),
		picked: formatMs(picked.medianMs),
		winner: tied ? null : ekrina.medianMs < picked.medianMs ? "ekrina" : "picked",
		margin: tied ? "about as fast" : `${ratio(slower, faster)}× faster`,
	};
};

/** Higher wins; equal as displayed is a tie. */
const higherColumn = (
	label: string,
	shortLabel: string,
	ekrina: string,
	picked: string,
	margin: string,
): ScoreColumn => ({
	label,
	shortLabel,
	ekrina,
	picked,
	winner: ekrina === picked ? null : Number(ekrina) > Number(picked) ? "ekrina" : "picked",
	margin: ekrina === picked ? "level" : margin,
});

/** Ekrina against the picked library: MRR on the viewed corpus, times from the timed one. */
export const scoreline = (
	data: ExplorerData,
	picked: ExplorerLibrary,
	corpus: TimedCorpus,
	view: CorpusView,
): ScoreColumn[] => {
	const ekrina = data.libraries.find((library) => library.config === EKRINA)!;
	const mine = picked.timing[corpus].sizes;
	const theirs = ekrina.timing[corpus].sizes;
	const mrr = { ekrina: formatMrr(ekrina.headline[view]), picked: formatMrr(picked.headline[view]) };
	const frame = { ekrina: theirs["100000"].withinFrame, picked: mine["100000"].withinFrame };
	const queries = mine["100000"].queries;
	return [
		higherColumn(
			"MRR",
			"MRR",
			mrr.ekrina,
			mrr.picked,
			`+${formatMrr(Math.abs(Number(mrr.ekrina) - Number(mrr.picked)))}`,
		),
		medianColumn("Median at 10k, ms", "10k ms", theirs["10000"], mine["10000"]),
		medianColumn("Median at 100k, ms", "100k ms", theirs["100000"], mine["100000"]),
		{
			...higherColumn(
				"In a frame at 100k",
				"In frame",
				String(frame.ekrina),
				String(frame.picked),
				`+${Math.abs(frame.ekrina - frame.picked)}`,
			),
			ekrina: `${frame.ekrina}/${queries}`,
			picked: `${frame.picked}/${queries}`,
		},
	];
};

type QueryTime = { query: string; ms: number; library: ExplorerLibrary; row: string };

const rowKey = (size: ListSize, isEkrina: boolean) => `${size}-${isEkrina ? "ekrina" : "picked"}`;

const queryTimes = (data: ExplorerData, library: ExplorerLibrary, corpus: TimedCorpus, size: ListSize) =>
	library.timing[corpus].sizes[size].perQueryMs.map(
		(ms, k): QueryTime => ({
			query: data.queries[corpus][k] ?? "",
			ms,
			library,
			row: rowKey(size, library.config === EKRINA),
		}),
	);

/**
 * Every timed query at one list size as a dot, Ekrina's row above the picked
 * library's, on the time axis every size shares, with a line at one frame.
 * Each library's marks carry `data-lib` for the page's CSS to show one.
 */
export const stripSvg = (
	data: ExplorerData,
	corpus: TimedCorpus,
	size: ListSize,
	layout: "wide" | "narrow",
): string => {
	const document = new JSDOM("").window.document;
	const wide = layout === "wide";
	const first = size === "10000";
	const rows = [rowKey(size, true), rowKey(size, false)];
	const ekrina = data.libraries.find((library) => library.config === EKRINA)!;
	const others = data.libraries.filter((library) => library !== ekrina);
	const colour = (library: ExplorerLibrary) =>
		library === ekrina ? "var(--chart-ekrina)" : "var(--chart-subject)";
	const tag = (library: ExplorerLibrary) => () => `${LIBRARY_LABEL}${library.slug}`;

	const dotsFor = (library: ExplorerLibrary): Plot.Markish =>
		Plot.dot(
			queryTimes(data, library, corpus, size),
			Plot.dodgeY("middle", {
				x: "ms",
				fy: "row",
				r: wide ? 2.75 : 2.5,
				fill: colour(library),
				title: (d: QueryTime) => `${d.library.name}, ${SIZE_LABEL[size]}\n${d.query}: ${d.ms.toFixed(2)} ms`,
				ariaLabel: tag(library),
			}),
		);

	const rowLabel = (library: ExplorerLibrary): Plot.Markish =>
		Plot.text([library.name], {
			fy: () => rowKey(size, library === ekrina),
			frameAnchor: "left",
			textAnchor: "end",
			dx: -10,
			fill: "var(--ink)",
			ariaLabel: tag(library),
		});

	const svg = Plot.plot({
		document,
		width: wide ? 760 : 360,
		// A narrow strip has less room to spread a cluster sideways, so it piles higher.
		height: wide ? 200 : 280,
		marginLeft: wide ? 128 : 112,
		marginRight: 12,
		marginTop: first ? 26 : 6,
		marginBottom: first ? 6 : 28,
		style: {
			background: "none",
			color: "var(--ink-muted)",
			fontFamily: "var(--__sl-font-mono)",
			fontSize: "12px",
			overflow: "visible",
		},
		x: {
			type: "log",
			domain: STRIP_DOMAIN,
			ticks: STRIP_TICKS,
			tickFormat: (ms: number) => (ms === STRIP_TICKS.at(-1) ? `${ms} ms` : `${ms}`),
			tickSize: 0,
			label: null,
			axis: first ? null : "bottom",
		},
		fy: { domain: rows, axis: null, padding: 0.08 },
		marks: [
			Plot.ruleX([data.frameMs], { stroke: "var(--ink-muted)" }),
			...(first
				? [
						Plot.text([`one frame, ${data.frameMs} ms`], {
							fy: () => rows[0],
							x: data.frameMs,
							frameAnchor: "top",
							dy: -14,
							textAnchor: "middle",
							fill: "currentColor",
						}),
					]
				: []),
			rowLabel(ekrina),
			dotsFor(ekrina),
			...others.flatMap((library) => [rowLabel(library), dotsFor(library)]),
		],
	}) as SVGSVGElement;

	tagLibraries(svg, data);
	takeStylesheet(svg);
	svg.removeAttribute("width");
	svg.removeAttribute("height");
	svg.setAttribute("role", "img");
	svg.setAttribute(
		"aria-label",
		`Each timed query's time for Ekrina and the picked library at ${SIZE_LABEL[size]}, ${corpus} corpus, with a line at one frame`,
	);
	return svg.outerHTML;
};
