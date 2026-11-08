// Emoji is timed only at its own length, which docs/benchmarks.md keeps out of
// the speed rankings and the Pareto charts.
export const CORPORA = ["native", "en"] as const;
export type Corpus = (typeof CORPORA)[number];
export type Marker = "circle" | "square" | "diamond";

/** Every time in ms, as `bench/results.json` holds it for one corpus at one list size. */
export type ParetoTiming = {
	/** The batch: one searcher, a warm-up answer, then the timed queries once each. */
	build: number;
	firstAnswer: number;
	perQuery: number;
	/** The warm-up plus every timed query. */
	answers: number;
	/** The probe cells, each in its own fresh process, averaged over the probe kinds. */
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
};

export type ParetoData = {
	corpora: ParetoCorpus[];
	/** A timed corpus the chart leaves out, and the one size it is timed at. */
	untimed: { id: string; size: string };
	rows: ParetoRow[];
};

export const MEASURES = ["per-query", "session", "one-shot", "cold-query"] as const;
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
	"cold-query": "Cold query",
};

type Part = { label: string; ms: number; counted: boolean };

export const corpusOf = (data: ParetoData, id: Corpus): ParetoCorpus =>
	data.corpora.find((corpus) => corpus.id === id)!;

/** One-shot without its constructor is the cold query, so both share every word that follows. */
const effectiveMeasure = (state: ParetoState): Measure =>
	state.measure === "one-shot" && !state.constructorCounted ? "cold-query" : state.measure;

export const countsConstructor = (state: ParetoState): boolean =>
	(state.measure === "session" || state.measure === "one-shot") && state.constructorCounted;

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

export const msOf = (row: ParetoRow, state: ParetoState): number => {
	const t = timingOf(row, state);
	switch (effectiveMeasure(state)) {
		case "per-query":
			return t.perQuery;
		case "session":
			return state.constructorCounted ? t.build + t.answers : t.answers;
		case "one-shot":
			return t.oneShot;
		case "cold-query":
			return t.coldQuery;
	}
};

const partsOf = (row: ParetoRow, state: ParetoState, queries: number): Part[] => {
	const t = timingOf(row, state);
	switch (effectiveMeasure(state)) {
		case "per-query":
			return [
				{ label: "constructor", ms: t.build, counted: false },
				{ label: "warm-up answer", ms: t.firstAnswer, counted: false },
			];
		case "session":
			return [
				{ label: "constructor", ms: t.build, counted: state.constructorCounted },
				{ label: "warm-up answer", ms: t.firstAnswer, counted: true },
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

const AXIS_TITLES: Record<Measure, string> = {
	"per-query": "ms per query",
	session: "ms per session",
	"one-shot": "ms per one-shot",
	"cold-query": "ms per cold query",
};

const axisTitle = (state: ParetoState): string =>
	effectiveMeasure(state) === "session" && !state.constructorCounted
		? "ms per session, no constructor"
		: AXIS_TITLES[effectiveMeasure(state)];

const unitOf = (state: ParetoState): string => {
	const measure = effectiveMeasure(state);
	return measure === "per-query" ? "per query" : measure === "session" ? "per session" : measure;
};

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

const dominatorOf = (point: Point, points: Point[]): Point | undefined =>
	points
		.filter(
			(other) =>
				other !== point &&
				other.ms <= point.ms &&
				other.mrr >= point.mrr &&
				(other.ms < point.ms || other.mrr > point.mrr),
		)
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
		: state.measure === "cold-query"
			? "The cold query never counts it; counted, it is the one-shot."
			: "";

const listNames = (names: string[]): string =>
	names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

// The wording follows docs/benchmarks.md's "What each number includes".
const measureSentences = (state: ParetoState, corpus: ParetoCorpus): string[] => {
	const items = `${sizeLabel(state.size)} items`;
	const queries = corpus.timedQueries;
	const probes = `each of the ${corpus.probeKinds} timed queries in its own fresh process, averaged`;
	switch (effectiveMeasure(state)) {
		case "per-query":
			return [
				`Time is the mean of the ${queries} queries one searcher answers after a warm-up answer, over ${items}.`,
				"It leaves out the constructor and the first-contact setup the warm-up absorbs (the JIT, fuzzysort's prepare-all, Ekrina preparing what it matches).",
				"Lazy Ekrina's whole-list mask build falls inside it, on the first query that needs it; Ekrina (indexed) builds it in the constructor, which is left out.",
				"Each query runs after the warm-up and every query before it.",
			];
		case "session":
			return state.constructorCounted
				? [
						`Time is the session total: the constructor, a warm-up answer and ${queries} queries, one searcher over ${items}.`,
						"It includes first-contact setup and Ekrina's whole-list mask build, wherever each design pays it.",
					]
				: [
						`Time is a warm-up answer and ${queries} queries, one searcher over ${items}, without the constructor.`,
						"First-contact setup is in it, and so is lazy Ekrina's whole-list mask build; Ekrina (indexed) builds its mask in the constructor, which is left out.",
					];
		case "one-shot":
			return [
				`Time is the one-shot: the constructor plus the first answer over ${items}, ${probes}.`,
				"It includes first-contact setup and Ekrina's whole-list mask build when the query needs it, and no earlier query warms anything.",
			];
		case "cold-query":
			return [
				`Time is the cold query: the first answer over ${items} without the constructor, ${probes}.`,
				"It includes first-contact setup and lazy Ekrina's whole-list mask build when the query needs it; Ekrina (indexed) builds its mask in the constructor, which is left out.",
			];
	}
};

const frontierSentence = (points: Point[]): string => {
	const front = frontierOf(points);
	const at = (p: Point) => `${p.row.name} (${formatMrr(p.mrr)} MRR at ${formatMs(p.ms)} ms)`;
	return front.length === 1
		? `${at(front[0]!)} is the whole frontier: the fastest row is also the most accurate.`
		: `The frontier runs from ${front.map(at).join(" to ")}.`;
};

/** The caption under the chart: what it plots, what the time includes and leaves out, and the frontier. */
export const captionOf = (data: ParetoData, state: ParetoState): string[] => {
	const corpus = corpusOf(data, state.corpus);
	const notes: string[] = [];
	if (corpus.unfolded.length > 0) {
		notes.push(
			`${listNames(corpus.unfolded)} skip the diacritic folding the ${corpus.id} corpus needs, so its speed tables leave ${corpus.unfolded.length > 1 ? "their" : "its"} times out; they are drawn here all the same.`,
		);
	}
	notes.push(
		`The ${data.untimed.id} corpus is timed only at its own ${sizeLabel(data.untimed.size)} items, too short to rank speed on, so it stays off this chart.`,
	);
	return [
		`MRR is the scorecard's headline on the ${corpus.id} corpus, over ${corpus.families} query families, and does not depend on list size.`,
		...measureSentences(state, corpus),
		frontierSentence(pointsOf(data, state)),
		...notes,
	];
};

/** The table twin: the plotted values and the parts the tooltip shows, for the current view. */
export const tableHtml = (data: ParetoData, state: ParetoState): string => {
	const corpus = corpusOf(data, state.corpus);
	const points = pointsOf(data, state).sort((a, b) => b.mrr - a.mrr || a.ms - b.ms);
	const front = new Set(frontierOf(points));
	const parts = partsOf(points[0]!.row, state, corpus.timedQueries);
	const right = ' style="text-align:right"';
	const head = [
		"<th>Library</th>",
		`<th${right}>MRR</th>`,
		`<th${right}>${escapeHtml(axisTitle(state))}</th>`,
		...parts.map(
			(part) =>
				`<th${right}>${escapeHtml(part.label)} ms${part.counted ? "" : " (left out)"}</th>`,
		),
		"<th>Frontier</th>",
	].join("");
	const body = points
		.map((p) => {
			const name = escapeHtml(p.row.name);
			const cells = [
				`<td>${p.row.ekrina ? `<strong>${name}</strong>` : name}</td>`,
				`<td${right}>${formatMrr(p.mrr)}</td>`,
				`<td${right}>${formatMs(p.ms)}</td>`,
				...partsOf(p.row, state, corpus.timedQueries).map(
					(part) => `<td${right}>${formatMs(part.ms)}</td>`,
				),
				front.has(p) ? "<td>yes</td>" : '<td class="quiet">no</td>',
			];
			return `<tr>${cells.join("")}</tr>`;
		})
		.join("");
	return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
};

/** What the tooltip says about one point. */
export const tooltipHtml = (data: ParetoData, state: ParetoState, config: string): string => {
	const corpus = corpusOf(data, state.corpus);
	const points = pointsOf(data, state);
	const point = points.find((p) => p.row.config === config)!;
	const onFrontier = frontierOf(points).includes(point);
	const dominator = onFrontier ? undefined : dominatorOf(point, points);
	const parts = partsOf(point.row, state, corpus.timedQueries);
	const counted = parts.filter((part) => part.counted);
	const left = parts.filter((part) => !part.counted);
	const row = (label: string, value: string, className = "") =>
		`<div class="${className}"><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;
	const partRows = (list: Part[]) =>
		list.map((part) => row(part.label, `${formatMs(part.ms)} ms`)).join("");
	const unsummed =
		effectiveMeasure(state) === "one-shot"
			? '<p class="tip-note">The parts are separate medians, so they need not add up.</p>'
			: "";
	return [
		`<p class="tip-name">${escapeHtml(point.row.name)}</p>`,
		"<dl>",
		row("MRR", formatMrr(point.mrr)),
		row(unitOf(state), `${formatMs(point.ms)} ms`, "tip-plotted"),
		counted.length > 1 ? `<div class="tip-group">made of</div>${partRows(counted)}` : "",
		left.length > 0 ? `<div class="tip-group">left out</div>${partRows(left)}` : "",
		"</dl>",
		unsummed,
		`<p class="tip-note">${
			onFrontier
				? "On the frontier."
				: dominator
					? `Off the frontier: ${escapeHtml(dominator.row.name)} is ${dominator.ms < point.ms ? "faster" : "as fast"} at ${dominator.mrr > point.mrr ? "a higher" : "the same"} MRR.`
					: "Off the frontier."
		}</p>`,
	].join("");
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

const priorityOf = (p: Placed): number => (p.row.ekrina ? 3 : p.onFrontier ? 2 : 1);

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
			const h = DOT_R - 0.5 + grow;
			return `<rect x="${x - h}" y="${y - h}" width="${2 * h}" height="${2 * h}"/>`;
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
	const front = frontierOf(points);

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
	const title = axisTitle(state);
	const xTitle =
		[`${title}, log scale, lower is better`, `${title}, log scale`].find(
			(text) => textWidth(text) <= plotW + M.left - 8,
		) ?? title;
	const frontierPath = frontPlaced.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join("");

	// Ekrina's three rows can share a spot: the hollow diamond draws last, around whatever it covers.
	const MARKER_LAYER: Record<Marker, number> = { square: 0, circle: 1, diamond: 2 };
	const drawOrder = [...placed].sort(
		(a, b) =>
			Number(a.row.ekrina) - Number(b.row.ekrina) ||
			MARKER_LAYER[a.row.marker] - MARKER_LAYER[b.row.marker],
	);
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
				`<circle class="hit" cx="${p.x}" cy="${p.y}" r="13"/>`,
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
			const strong = p.row.ekrina || p.onFrontier;
			return `<text class="label${strong ? " strong" : ""}" data-config="${escapeHtml(p.row.config)}" x="${r1(l.x)}" y="${r1(l.y)}" text-anchor="${l.anchor}">${escapeHtml(p.row.name)}</text>`;
		})
		.join("");

	return [
		`<svg class="pareto-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="${escapeHtml(`MRR against ${axisTitle(state)}, log scale`)}">`,
		`<g class="grid" aria-hidden="true">${grid}</g>`,
		`<g class="axis" aria-hidden="true">`,
		`<line x1="${M.left}" y1="${M.top + plotH}" x2="${M.left + plotW}" y2="${M.top + plotH}"/>`,
		`<line x1="${M.left}" y1="${M.top}" x2="${M.left}" y2="${M.top + plotH}"/>`,
		`</g>`,
		`<g class="ticks" aria-hidden="true">${xLabels}${yLabels}</g>`,
		`<text class="title" x="${M.left - 8}" y="${M.top - 14}" aria-hidden="true">MRR, higher is better</text>`,
		`<text class="title" x="${M.left + plotW}" y="${H - 6}" text-anchor="end" aria-hidden="true">${escapeHtml(xTitle)}</text>`,
		`<path class="frontier" d="${frontierPath}" aria-hidden="true"/>`,
		`<g class="leaders" aria-hidden="true">${leaders}</g>`,
		`<g class="marks">${marks}</g>`,
		`<g class="labels" aria-hidden="true">${labels}</g>`,
		"</svg>",
	].join("");
};
