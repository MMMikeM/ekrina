export const CORPORA = ["native", "en", "emoji"] as const;
export type Corpus = (typeof CORPORA)[number];
export type Marker = "circle" | "square" | "diamond";

export const CORPUS_LABELS: Record<Corpus, string> = {
	native: "Native",
	en: "English",
	emoji: "Emoji",
};

/** What each corpus holds, said beside the Corpus control; docs/benchmarks/method.md has the full account. */
export const CORPUS_DEFINITIONS: Record<Corpus, string> = {
	native: "Wikidata items under their native names, where Wikidata has one.",
	en: "The same Wikidata items under their English labels.",
	emoji: "Every emoji's name and tags, as a picker searches them.",
};

/** Every time in ms, as `bench/results.json` holds it for one corpus at one list size. */
export type ParetoTiming = {
	/** The batch: one searcher, a warm-up answer, then the timed queries once each. */
	build: number;
	firstAnswer: number;
	perQuery: number;
	/** The warm-up plus every timed query. */
	answers: number;
	/** The probe cells: each probe query's median over its fresh processes, then the mean over the probe queries. */
	probeBuild: number;
	coldQuery: number;
	oneShot: number;
};

export type ParetoRow = {
	config: string;
	name: string;
	marker: Marker;
	ekrina: boolean;
	/** The scorecard's headline MRR, which does not depend on list size. */
	mrr: Record<Corpus, number>;
	timings: Record<Corpus, Record<string, ParetoTiming>>;
};

export type ParetoCorpus = {
	id: Corpus;
	families: number;
	sizes: string[];
	timedQueries: number;
	probeKinds: number;
	/** Rows the corpus's speed tables leave out, because they skip the folding it needs. */
	unfolded: string[];
	/** False for a list too short for the published size, whose timings the bench does not rank. */
	ranked: boolean;
};

export type ParetoData = {
	corpora: ParetoCorpus[];
	rows: ParetoRow[];
};

export const MEASURES = ["per-query", "session", "one-shot"] as const;
export type Measure = (typeof MEASURES)[number];

export type ParetoState = {
	measure: Measure;
	constructorCounted: boolean;
	corpus: Corpus;
	size: string;
};

export const MEASURE_LABELS: Record<Measure, string> = {
	"per-query": "Per query",
	session: "Session",
	"one-shot": "One-shot",
};

type Part = { label: string; ms: number; counted: boolean };

export const corpusOf = (data: ParetoData, id: Corpus): ParetoCorpus =>
	data.corpora.find((corpus) => corpus.id === id)!;

/** The size to show `corpus` at: `size` when it is timed there, else its first. */
export const sizeFor = (data: ParetoData, corpus: Corpus, size: string): string => {
	const sizes = corpusOf(data, corpus).sizes;
	return sizes.includes(size) ? size : sizes[0]!;
};

/** One-shot without its constructor is the cold query. */
type Timing = Measure | "cold-query";

const timingKind = (state: ParetoState): Timing =>
	state.measure === "one-shot" && !state.constructorCounted ? "cold-query" : state.measure;

export const sizeLabel = (size: string): string => {
	const n = Number(size);
	return n % 1000 === 0 ? `${n / 1000}k` : n.toLocaleString("en-GB");
};

export const formatMs = (x: number): string =>
	x >= 1000
		? Math.round(x).toLocaleString("en-GB")
		: x >= 100
			? x.toFixed(0)
			: x >= 10
				? x.toFixed(1)
				: x.toFixed(2);
export const formatMrr = (x: number): string => x.toFixed(2);

const timingOf = (row: ParetoRow, state: ParetoState): ParetoTiming =>
	row.timings[state.corpus][state.size]!;

const sessionMs = (t: ParetoTiming): number => t.build + t.answers;

export const msOf = (row: ParetoRow, state: ParetoState): number => {
	const t = timingOf(row, state);
	switch (timingKind(state)) {
		case "per-query":
			return t.perQuery;
		case "session":
			return state.constructorCounted ? sessionMs(t) : t.answers;
		case "one-shot":
			return t.oneShot;
		case "cold-query":
			return t.coldQuery;
	}
};

const partsOf = (row: ParetoRow, state: ParetoState, queries: number): Part[] => {
	const t = timingOf(row, state);
	switch (timingKind(state)) {
		case "per-query":
			return [
				{ label: "constructor", ms: t.build, counted: false },
				{ label: "warm-up", ms: t.firstAnswer, counted: false },
			];
		case "session":
			return [
				{ label: "constructor", ms: t.build, counted: state.constructorCounted },
				{ label: "warm-up", ms: t.firstAnswer, counted: true },
				{ label: `${queries} queries`, ms: t.answers - t.firstAnswer, counted: true },
			];
		case "one-shot":
			return [
				{ label: "constructor", ms: t.probeBuild, counted: true },
				{ label: "cold query", ms: t.coldQuery, counted: true },
			];
		case "cold-query":
			return [{ label: "constructor", ms: t.probeBuild, counted: false }];
	}
};

// Longest first; the chart takes the longest that fits its width.
const AXIS_TITLES: Record<Timing, string[]> = {
	"per-query": ["ms per query, after a warm-up", "ms per query"],
	session: ["ms per session, constructor counted", "ms per session"],
	"one-shot": ["ms per one-shot, constructor counted", "ms per one-shot"],
	"cold-query": [
		"ms per cold query: the one-shot without its constructor",
		"ms per cold query, no constructor",
	],
};

const axisTitles = (state: ParetoState): string[] =>
	timingKind(state) === "session" && !state.constructorCounted
		? ["ms per session, constructor not counted", "ms per session, no constructor"]
		: AXIS_TITLES[timingKind(state)];

const UNITS: Record<Timing, string> = {
	"per-query": "per query",
	session: "per session",
	"one-shot": "one-shot",
	"cold-query": "cold query",
};

const unitOf = (state: ParetoState): string => UNITS[timingKind(state)];

export type Point = { row: ParetoRow; mrr: number; ms: number };

export const pointsOf = (data: ParetoData, state: ParetoState): Point[] =>
	data.rows.map((row) => ({ row, mrr: row.mrr[state.corpus], ms: msOf(row, state) }));

// The non-dominated set, by the same rule as docs/pareto.ts: sweep by time
// ascending and keep each strict MRR improvement.
export const frontierOf = <T extends { mrr: number; ms: number }>(points: T[]): T[] => {
	const sorted = [...points].sort((a, b) => a.ms - b.ms || b.mrr - a.mrr);
	const out: T[] = [];
	let best = -1;
	for (const p of sorted) {
		if (p.mrr > best) {
			out.push(p);
			best = p.mrr;
		}
	}
	return out;
};

/** The frontier the view may claim: none on a corpus whose timings the bench does not rank. */
export const viewFrontier = <T extends { mrr: number; ms: number }>(
	data: ParetoData,
	state: ParetoState,
	points: T[],
): T[] => (corpusOf(data, state.corpus).ranked ? frontierOf(points) : []);

const dominates = (a: Point, b: Point): boolean =>
	a !== b && a.ms <= b.ms && a.mrr >= b.mrr && (a.ms < b.ms || a.mrr > b.mrr);

const dominatorOf = (point: Point, points: Point[]): Point | undefined =>
	points
		.filter((other) => dominates(other, point))
		.sort((a, b) => b.mrr - a.mrr || a.ms - b.ms)[0];

export const escapeHtml = (text: string): string =>
	text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

/** Why the constructor control is off for the current view, said beside it; empty when it is on. */
export const constructorNote = (state: ParetoState): string =>
	state.measure === "per-query"
		? "Per query never counts it: the constructor runs once, before the warm-up answer."
		: "";

/** Why the size control is off for the current corpus, said beside it; empty when it is on. */
export const sizeNote = (data: ParetoData, state: ParetoState): string => {
	const corpus = corpusOf(data, state.corpus);
	return corpus.sizes.length === 1
		? `The ${CORPUS_LABELS[corpus.id]} corpus is timed only at its whole ${sizeLabel(corpus.sizes[0]!)} items.`
		: "";
};

const listNames = (names: string[]): string =>
	names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

const PROBES = "each probe query's median over its fresh processes, averaged over the";

// The wording follows docs/benchmarks.md's "What each number includes".
const timeSentences = (state: ParetoState, corpus: ParetoCorpus): string[] => {
	const items = `${sizeLabel(state.size)} items`;
	const queries = `${corpus.timedQueries} timed queries`;
	const probes = `${PROBES} ${corpus.probeKinds} probe queries`;
	switch (timingKind(state)) {
		case "per-query":
			return [
				`Time is the mean of the ${queries} one searcher answers over ${items} after a warm-up answer, which absorbs first-contact setup; the constructor is left out.`,
				"Lazy Ekrina builds its whole-list mask on the first query that needs it, inside this time; Ekrina (indexed) builds it in the constructor.",
			];
		case "session":
			return state.constructorCounted
				? [
						`Time is the whole session over ${items}: the constructor, a warm-up answer and ${queries}, every setup cost included wherever each design pays it.`,
					]
				: [
						`Time is a warm-up answer and ${queries} over ${items}, without the constructor.`,
						"Lazy Ekrina's whole-list mask build is inside it; Ekrina (indexed) builds its mask in the constructor, left out here.",
					];
		case "one-shot":
			return [
				`Time is the constructor plus the first answer over ${items} in a fresh process: ${probes}.`,
			];
		case "cold-query":
			return [
				`Time is the cold query, the first answer over ${items} in a fresh process without the constructor: ${probes}.`,
				"Lazy Ekrina's mask build is inside it when the query needs one; Ekrina (indexed)'s is in its constructor, left out here.",
			];
	}
};

const at = (p: Point) => `${p.row.name} (${formatMrr(p.mrr)} MRR at ${formatMs(p.ms)} ms)`;

const frontierSentence = (front: Point[]): string =>
	front.length === 1
		? `${at(front[0]!)} is the whole frontier: the fastest row is also the most accurate.`
		: `The frontier runs from ${front.map(at).join(" to ")}.`;

/** Where the default Ekrina stands against the frontier, when it is not on it. */
const ekrinaGapSentence = (points: Point[], front: Point[]): string[] => {
	const ekrina = points.find((p) => p.row.config === "ekrina");
	if (!ekrina || front.includes(ekrina)) return [];
	// The frontier is monotone, so the slowest point dominating Ekrina is the nearest to it.
	const nearest = front.filter((p) => dominates(p, ekrina)).sort((a, b) => b.ms - a.ms)[0];
	if (!nearest) return [`${at(ekrina)} is off the frontier.`];
	const faster = ekrina.ms - nearest.ms;
	const time =
		faster > 0
			? `${formatMs(faster)} ms (${Math.round((faster / ekrina.ms) * 100)}%) faster`
			: "as fast";
	const quality =
		formatMrr(nearest.mrr) === formatMrr(ekrina.mrr)
			? "the same MRR"
			: `${formatMrr(nearest.mrr - ekrina.mrr)} higher MRR`;
	return [`${at(ekrina)} is off it: ${nearest.row.name} is ${time} at ${quality}.`];
};

// The wording follows docs/benchmarks.md's warning over the emoji scorecard.
const unrankedSentences = (
	data: ParetoData,
	state: ParetoState,
	corpus: ParetoCorpus,
): CaptionSentence[] => {
	const quickest = Math.min(...data.rows.map((row) => sessionMs(timingOf(row, state))));
	return [
		{ text: "These timings cannot rank the libraries.", tone: "warning" },
		{
			text: `The ${CORPUS_LABELS[corpus.id]} corpus is only ${sizeLabel(state.size)} items, and a whole session here takes as little as ${formatMs(quickest)} ms, short enough that run-to-run noise can reorder neighbouring rows, so this view draws no frontier.`,
			tone: "lead",
		},
	];
};

export type CaptionSentence = { text: string; tone?: "lead" | "warning" };

/** The caption under the chart: the takeaway first, then what it plots and what the time includes. */
export const captionOf = (data: ParetoData, state: ParetoState): CaptionSentence[] => {
	const corpus = corpusOf(data, state.corpus);
	const points = pointsOf(data, state);
	const front = viewFrontier(data, state, points);
	const lead: CaptionSentence[] = corpus.ranked
		? [frontierSentence(front), ...ekrinaGapSentence(points, front)].map((text) => ({
				text,
				tone: "lead",
			}))
		: unrankedSentences(data, state, corpus);
	const notes =
		corpus.unfolded.length > 0
			? [
					`${listNames(corpus.unfolded)} skip the diacritic folding this corpus needs, so its speed tables leave ${corpus.unfolded.length > 1 ? "them" : "it"} out; ${corpus.unfolded.length > 1 ? "they are" : "it is"} drawn here all the same.`,
				]
			: [];
	return [
		...lead,
		{
			text: `MRR is the scorecard headline on the ${CORPUS_LABELS[corpus.id]} corpus, over ${corpus.families} query families, and does not depend on list size.`,
		},
		...[...timeSentences(state, corpus), ...notes].map((text) => ({ text })),
	];
};

/** The table twin: the plotted values and the parts the tooltip shows, for the current view. */
export const tableHtml = (data: ParetoData, state: ParetoState): string => {
	const corpus = corpusOf(data, state.corpus);
	const points = pointsOf(data, state).sort((a, b) => b.mrr - a.mrr || a.ms - b.ms);
	const front = new Set(viewFrontier(data, state, points));
	const parts = partsOf(points[0]!.row, state, corpus.timedQueries);
	const counted = parts.filter((part) => part.counted);
	const shownParts = [...(counted.length > 1 ? counted : []), ...parts.filter((p) => !p.counted)];
	const right = ' style="text-align:right"';
	// One header row, so the Markdown copy's table keeps its columns.
	const head = [
		"<th>Library</th>",
		`<th${right}>MRR</th>`,
		`<th${right}>${escapeHtml(unitOf(state))}, ms</th>`,
		...shownParts.map(
			(part) =>
				`<th${right}>${escapeHtml(part.label)} ms${part.counted ? "" : ", left out"}</th>`,
		),
		corpus.ranked ? "<th>Frontier</th>" : "",
	].join("");
	const body = points
		.map((p) => {
			const name = escapeHtml(p.row.name);
			const partMs = new Map(
				partsOf(p.row, state, corpus.timedQueries).map((part) => [part.label, part.ms]),
			);
			const cells = [
				`<td>${p.row.ekrina ? `<strong>${name}</strong>` : name}</td>`,
				`<td${right}>${formatMrr(p.mrr)}</td>`,
				`<td${right}>${formatMs(p.ms)}</td>`,
				...shownParts.map((part) => `<td${right}>${formatMs(partMs.get(part.label)!)}</td>`),
				corpus.ranked ? (front.has(p) ? "<td>yes</td>" : '<td class="quiet">no</td>') : "",
			];
			return `<tr>${cells.join("")}</tr>`;
		})
		.join("");
	return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
};

const pointTipHtml = (
	data: ParetoData,
	state: ParetoState,
	points: Point[],
	front: Point[],
	point: Point,
): string => {
	const corpus = corpusOf(data, state.corpus);
	const parts = partsOf(point.row, state, corpus.timedQueries);
	const counted = parts.filter((part) => part.counted);
	const left = parts.filter((part) => !part.counted);
	const row = (label: string, value: string, className = "") =>
		`<div class="${className}"><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;
	const partRows = (list: Part[]) =>
		list.map((part) => row(part.label, `${formatMs(part.ms)} ms`)).join("");
	const unsummed =
		timingKind(state) === "one-shot"
			? '<p class="tip-note">Each part is its own median, averaged over the probe queries, so the parts need not add up.</p>'
			: "";
	const onFrontier = front.includes(point);
	const dominator = onFrontier ? undefined : dominatorOf(point, points);
	const standing = !corpus.ranked
		? ""
		: onFrontier
			? "On the frontier."
			: dominator
				? `Off the frontier: ${escapeHtml(dominator.row.name)} is ${dominator.ms < point.ms ? "faster" : "as fast"} at ${dominator.mrr > point.mrr ? "a higher" : "the same"} MRR.`
				: "Off the frontier.";
	return [
		'<div class="tip-point">',
		`<p class="tip-name">${escapeHtml(point.row.name)}</p>`,
		"<dl>",
		row("MRR", formatMrr(point.mrr)),
		row(unitOf(state), `${formatMs(point.ms)} ms`, "tip-plotted"),
		counted.length > 1 ? `<div class="tip-group">made of</div>${partRows(counted)}` : "",
		left.length > 0 ? `<div class="tip-group">left out</div>${partRows(left)}` : "",
		"</dl>",
		unsummed,
		standing ? `<p class="tip-note">${standing}</p>` : "",
		"</div>",
	].join("");
};

/** What the tooltip says about the points under the pointer, one section each. */
export const tooltipHtml = (data: ParetoData, state: ParetoState, configs: string[]): string => {
	const points = pointsOf(data, state);
	const front = viewFrontier(data, state, points);
	return configs
		.map((config) => points.find((p) => p.row.config === config))
		.filter((point): point is Point => point !== undefined)
		.map((point) => pointTipHtml(data, state, points, front, point))
		.join("");
};

export const ariaLabelOf = (point: Point, onFrontier: boolean, state: ParetoState): string =>
	`${point.row.name}: MRR ${formatMrr(point.mrr)}, ${formatMs(point.ms)} ms ${unitOf(state)}${onFrontier ? ", on the frontier" : ""}`;

const LABEL_PX = 13;
// IBM Plex Mono advances every glyph 0.6em, so a label's width is exact.
const CHAR_PX = LABEL_PX * 0.6;
const LINE_PX = 16;
const DOT_R = 5.5;
// Dots nearer than this across can't each fit a side label, so they share a stack.
const CLUSTER_X_PX = 40;
const CLUSTER_Y_PX = 14;

type Box = { x0: number; y0: number; x1: number; y1: number };
type Anchor = "start" | "middle" | "end";
type Label = { x: number; y: number; anchor: Anchor; box: Box; leader?: [number, number, number, number] };
type Placed = Point & { x: number; y: number; onFrontier: boolean; label?: Label };

const overlapArea = (a: Box, b: Box): number =>
	Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
	Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

const textWidth = (text: string): number => text.length * CHAR_PX;

const labelAt = (text: string, x: number, y: number, anchor: Anchor): Label => {
	const w = textWidth(text);
	const x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
	return { x, y, anchor, box: { x0: x0 - 2, y0: y - 11, x1: x0 + w + 2, y1: y + 4 } };
};

/** A leader from the dot's edge to the label box's nearest point, short of both. */
const leaderTo = (p: { x: number; y: number }, box: Box): [number, number, number, number] => {
	const tx = Math.min(Math.max(p.x, box.x0), box.x1);
	const ty = Math.min(Math.max(p.y, box.y0 + 3), box.y1 - 3);
	const d = Math.hypot(tx - p.x, ty - p.y) || 1;
	const ux = (tx - p.x) / d;
	const uy = (ty - p.y) / d;
	return [p.x + ux * (DOT_R + 2), p.y + uy * (DOT_R + 2), tx - ux * 2, ty - uy * 2];
};

const NEAR: [number, number, Anchor][] = [
	[DOT_R + 5, 4, "start"],
	[-(DOT_R + 5), 4, "end"],
	[0, -(DOT_R + 6), "middle"],
	[0, DOT_R + 15, "middle"],
	[DOT_R + 3, -(DOT_R + 3), "start"],
	[-(DOT_R + 3), -(DOT_R + 3), "end"],
	[DOT_R + 3, DOT_R + 13, "start"],
	[-(DOT_R + 3), DOT_R + 13, "end"],
];

const FAR = [24, 40, 60].flatMap((r): [number, number, Anchor][] => [
	[r, 4, "start"],
	[-r, 4, "end"],
	[r * 0.75, -r * 0.75, "start"],
	[-r * 0.75, -r * 0.75, "end"],
	[r * 0.75, r * 0.75 + 8, "start"],
	[-r * 0.75, r * 0.75 + 8, "end"],
	[0, -r, "middle"],
	[0, r + 10, "middle"],
]);

// The frontier's labels are the result, so they get the clearest spots; Ekrina's
// default is next because the caption measures it against the frontier.
const priorityOf = (p: Placed): number => (p.onFrontier ? 3 : p.row.config === "ekrina" ? 2 : 1);

const clustersOf = (points: Placed[]): Placed[][] => {
	const parent = points.map((_, i) => i);
	const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
	points.forEach((a, i) =>
		points.forEach((b, j) => {
			if (j > i && Math.abs(a.x - b.x) < CLUSTER_X_PX && Math.abs(a.y - b.y) < CLUSTER_Y_PX) {
				parent[find(i)] = find(j);
			}
		}),
	);
	const groups = new Map<number, Placed[]>();
	points.forEach((p, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), p]));
	return [...groups.values()];
};

const placeLabels = (points: Placed[], bounds: Box, obstacles: Box[]): void => {
	const taken = [...obstacles];
	const clash = (box: Box): number =>
		taken.reduce((sum, other) => sum + overlapArea(box, other), 0) +
		(box.x1 - box.x0) * (box.y1 - box.y0) -
		overlapArea(box, bounds);
	const best = <T extends { boxes: Box[] }>(tries: T[]): T =>
		tries.find((t) => t.boxes.every((box) => clash(box) === 0)) ??
		tries.reduce((a, b) =>
			b.boxes.reduce((s, box) => s + clash(box), 0) < a.boxes.reduce((s, box) => s + clash(box), 0)
				? b
				: a,
		);

	const clusters = clustersOf(points).sort(
		(a, b) =>
			Math.max(...b.map(priorityOf)) - Math.max(...a.map(priorityOf)) ||
			Math.max(...b.map((p) => p.mrr)) - Math.max(...a.map((p) => p.mrr)),
	);
	for (const cluster of clusters) {
		if (cluster.length === 1) {
			const p = cluster[0]!;
			const near = NEAR.map(([dx, dy, anchor]) => labelAt(p.row.name, p.x + dx, p.y + dy, anchor));
			const far = FAR.map(([dx, dy, anchor]) => {
				const label = labelAt(p.row.name, p.x + dx, p.y + dy, anchor);
				return { ...label, leader: leaderTo(p, label.box) };
			});
			const chosen = best([...near, ...far].map((label) => ({ label, boxes: [label.box] }))).label;
			p.label = chosen;
			taken.push(chosen.box);
			continue;
		}
		const chosen = best([...stairsFor(cluster), ...stacksFor(cluster)]);
		cluster.forEach((p) => {
			p.label = chosen.labels.get(p)!;
			taken.push(p.label.box);
		});
		taken.push(...chosen.boxes.filter((box) => !cluster.some((p) => p.label!.box === box)));
	}
};

type ClusterLabels = { labels: Map<Placed, Label>; boxes: Box[] };

// Each label hangs off a vertical leader from its own dot, the rightmost dot's
// nearest, so no leader crosses another label.
const stairsFor = (cluster: Placed[]): ClusterLabels[] => {
	const byX = [...cluster].sort((a, b) => b.x - a.x || a.y - b.y);
	return ([1, -1] as const).map((down) => {
		const edge = down > 0 ? Math.max(...byX.map((p) => p.y)) : Math.min(...byX.map((p) => p.y));
		const labels = new Map<Placed, Label>();
		const boxes: Box[] = [];
		byX.forEach((p, k) => {
			const baseline =
				down > 0 ? edge + DOT_R + 16 + k * LINE_PX : edge - DOT_R - 8 - k * LINE_PX;
			const label = labelAt(p.row.name, p.x + 5, baseline, "start");
			const from = p.y + down * (DOT_R + 2);
			const to = baseline - 4;
			labels.set(p, { ...label, leader: [p.x, from, p.x, to] });
			boxes.push(label.box, {
				x0: p.x - 1,
				y0: Math.min(from, to),
				x1: p.x + 1,
				y1: Math.max(from, to),
			});
		});
		return { labels, boxes };
	});
};

const stacksFor = (cluster: Placed[]): ClusterLabels[] => {
	const rows = [...cluster].sort((a, b) => a.y - b.y || a.x - b.x);
	const cx0 = Math.min(...rows.map((p) => p.x));
	const cx1 = Math.max(...rows.map((p) => p.x));
	const cy = rows.reduce((s, p) => s + p.y, 0) / rows.length;
	const offsets = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6].map((k) => k * 8);
	return [24, 40].flatMap((gap) =>
		(["right", "left"] as const).flatMap((side) =>
			offsets.map((offset) => {
				const top = cy + offset - ((rows.length - 1) * LINE_PX) / 2 + 4;
				const labels = new Map<Placed, Label>();
				rows.forEach((p, k) => {
					const label =
						side === "right"
							? labelAt(p.row.name, cx1 + gap, top + k * LINE_PX, "start")
							: labelAt(p.row.name, cx0 - gap, top + k * LINE_PX, "end");
					labels.set(p, { ...label, leader: leaderTo(p, label.box) });
				});
				return { labels, boxes: [...labels.values()].map((label) => label.box) };
			}),
		),
	);
};

const logTicks = (lo: number, hi: number, plotW: number): number[] => {
	const steps = [[1, 2, 5], [1, 3], [1]];
	for (const mantissas of steps) {
		const ticks: number[] = [];
		for (let e = Math.floor(Math.log10(lo)) - 1; e <= Math.ceil(Math.log10(hi)); e++) {
			for (const m of mantissas) {
				const t = Number((m * 10 ** e).toPrecision(6));
				if (t >= lo && t <= hi) ticks.push(t);
			}
		}
		const widest = Math.max(...ticks.map((t) => textWidth(tickLabel(t))));
		if (ticks.length <= 1 || plotW / ticks.length >= widest + 18) return ticks;
	}
	return [];
};

const tickLabel = (t: number): string => (t >= 1000 ? t.toLocaleString("en-GB") : String(t));

const markerPath = (marker: Marker, x: number, y: number, grow = 0): string => {
	switch (marker) {
		case "circle":
			return `<circle cx="${x}" cy="${y}" r="${DOT_R + grow}"/>`;
		case "square": {
			const h = DOT_R + 1 + grow;
			return `<rect class="hollow" x="${x - h}" y="${y - h}" width="${2 * h}" height="${2 * h}"/>`;
		}
		case "diamond": {
			const h = DOT_R + 3 + grow;
			return `<path class="hollow" d="M${x} ${y - h}L${x + h} ${y}L${x} ${y + h}L${x - h} ${y}Z"/>`;
		}
	}
};

const r1 = (v: number): number => Math.round(v * 10) / 10;

/** The chart as an SVG string laid out at `width` CSS pixels, so its text is never scaled. */
export const chartSvg = (data: ParetoData, state: ParetoState, width: number): string => {
	const W = Math.max(280, Math.round(width));
	const H = Math.round(W < 520 ? Math.min(W * 1.15, 420) : Math.min(Math.max(W * 0.6, 340), 440));
	const M = { left: 40, right: 12, top: 30, bottom: 46 };
	const plotW = W - M.left - M.right;
	const plotH = H - M.top - M.bottom;
	const points = pointsOf(data, state);
	const front = viewFrontier(data, state, points);

	const mrrs = points.map((p) => p.mrr);
	const yLo = Math.max(0, Math.floor((Math.min(...mrrs) - 0.04) * 10) / 10);
	const yHi = Math.min(1, Math.ceil((Math.max(...mrrs) + 0.04) * 10) / 10);
	const logs = points.map((p) => Math.log10(p.ms));
	const span = Math.max(...logs) - Math.min(...logs);
	const pad = Math.max(0.12, span * 0.07);
	const xLo = Math.min(...logs) - pad;
	const xHi = Math.max(...logs) + pad;
	const X = (ms: number) => r1(M.left + ((Math.log10(ms) - xLo) / (xHi - xLo)) * plotW);
	const Y = (mrr: number) => r1(M.top + ((yHi - mrr) / (yHi - yLo)) * plotH);

	const placed: Placed[] = points.map((p) => ({
		...p,
		x: X(p.ms),
		y: Y(p.mrr),
		onFrontier: front.includes(p),
	}));
	const frontPlaced = placed
		.filter((p) => p.onFrontier)
		.sort((a, b) => a.x - b.x);
	const frontierSamples = frontPlaced.slice(1).flatMap((to, i) => {
		const from = frontPlaced[i]!;
		const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 4);
		return Array.from({ length: steps + 1 }, (_, k) => {
			const x = from.x + ((to.x - from.x) * k) / steps;
			const y = from.y + ((to.y - from.y) * k) / steps;
			return { x0: x - 1.5, y0: y - 1.5, x1: x + 1.5, y1: y + 1.5 };
		});
	});
	placeLabels(
		placed,
		{ x0: M.left + 2, y0: M.top - 6, x1: W - 2, y1: M.top + plotH - 2 },
		[
			...placed.map((p) => ({
				x0: p.x - DOT_R - 1,
				y0: p.y - DOT_R - 1,
				x1: p.x + DOT_R + 1,
				y1: p.y + DOT_R + 1,
			})),
			...frontierSamples,
		],
	);

	const xTicks = logTicks(10 ** xLo, 10 ** xHi, plotW);
	const yStep = plotH / ((yHi - yLo) / 0.1) >= 26 ? 0.1 : 0.2;
	const yTicks: number[] = [];
	for (let t = Math.ceil(yLo / yStep - 1e-9) * yStep; t <= yHi + 1e-9; t += yStep) {
		yTicks.push(Number(t.toFixed(1)));
	}

	const grid = [
		...xTicks.map((t) => `<line x1="${X(t)}" y1="${M.top}" x2="${X(t)}" y2="${M.top + plotH}"/>`),
		...yTicks.map((t) => `<line x1="${M.left}" y1="${Y(t)}" x2="${M.left + plotW}" y2="${Y(t)}"/>`),
	].join("");
	const xLabels = xTicks
		.map((t) => `<text x="${X(t)}" y="${M.top + plotH + 18}" text-anchor="middle">${tickLabel(t)}</text>`)
		.join("");
	const yLabels = yTicks
		.map((t) => `<text x="${M.left - 8}" y="${Y(t) + 4}" text-anchor="end">${t.toFixed(1)}</text>`)
		.join("");
	const titles = axisTitles(state);
	const xTitle =
		titles
			.flatMap((title) => [`${title}, log scale, lower is better`, `${title}, log scale`, title])
			.find((text) => textWidth(text) <= plotW + M.left - 8) ?? titles.at(-1)!;
	const frontierPath = frontPlaced.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join("");

	// Ekrina's three rows can share a spot, so its default draws last, inside the hollow variants' outlines.
	const layerOf = (p: Placed) => (p.row.config === "ekrina" ? 2 : p.row.ekrina ? 1 : 0);
	const drawOrder = [...placed].sort((a, b) => layerOf(a) - layerOf(b));
	const leaders = placed
		.filter((p) => p.label?.leader)
		.map((p) => {
			const [x1, y1, x2, y2] = p.label!.leader!;
			return `<line class="leader" x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}"/>`;
		})
		.join("");
	const marks = drawOrder
		.map((p) => {
			const kind = p.row.ekrina ? "ekrina" : "field";
			return [
				`<g class="pt ${kind}${p.onFrontier ? " front" : ""}" data-config="${escapeHtml(p.row.config)}" data-x="${p.x}" data-y="${p.y}" tabindex="-1" role="img" aria-label="${escapeHtml(ariaLabelOf(p, p.onFrontier, state))}">`,
				`<g class="ring">${markerPath(p.row.marker, p.x, p.y, 4)}</g>`,
				`<g class="mark">${markerPath(p.row.marker, p.x, p.y)}</g>`,
				"</g>",
			].join("");
		})
		.join("");
	const labels = placed
		.filter((p) => p.label)
		.map((p) => {
			const l = p.label!;
			const config = escapeHtml(p.row.config);
			const text = `<text class="label${p.onFrontier ? " front" : ""}" data-config="${config}" x="${r1(l.x)}" y="${r1(l.y)}" text-anchor="${l.anchor}">${escapeHtml(p.row.name)}</text>`;
			if (!p.onFrontier) return text;
			const { x0, y0, x1, y1 } = l.box;
			return `<rect class="label-mark" data-config="${config}" x="${r1(x0)}" y="${r1(y0)}" width="${r1(x1 - x0)}" height="${r1(y1 - y0)}"/>${text}`;
		})
		.join("");

	return [
		`<svg class="pareto-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="${escapeHtml(`MRR against ${titles[0]}, log scale`)}">`,
		`<g class="grid" aria-hidden="true">${grid}</g>`,
		`<g class="axis" aria-hidden="true">`,
		`<line x1="${M.left}" y1="${M.top + plotH}" x2="${M.left + plotW}" y2="${M.top + plotH}"/>`,
		`<line x1="${M.left}" y1="${M.top}" x2="${M.left}" y2="${M.top + plotH}"/>`,
		`</g>`,
		`<g class="ticks" aria-hidden="true">${xLabels}${yLabels}</g>`,
		`<text class="title" x="${M.left - 8}" y="${M.top - 14}" aria-hidden="true">MRR, higher is better</text>`,
		`<text class="title" x="${M.left + plotW}" y="${H - 6}" text-anchor="end" aria-hidden="true">${escapeHtml(xTitle)}</text>`,
		frontPlaced.length > 1 ? `<path class="frontier" d="${frontierPath}" aria-hidden="true"/>` : "",
		`<g class="leaders" aria-hidden="true">${leaders}</g>`,
		`<g class="marks">${marks}</g>`,
		`<g class="labels" aria-hidden="true">${labels}</g>`,
		"</svg>",
	].join("");
};
