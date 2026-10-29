// Pareto-frontier charts: accuracy (MRR) vs time, one chart per workload.
// - pareto-query-*.svg — query ms with the index prebuilt (frontend workload:
//   the index is built eagerly at load, keystrokes run the query only).
// - pareto-total-*.svg — total ms = index + first (cold) query (backend one-shot workload).
// All styling is inlined because GitHub strips <style> blocks from SVGs.
import { writeFileSync } from "node:fs";
import type { Artifact } from "../bench/artifact.ts";
import { displayName } from "../bench/libraries.ts";
import { headlineConfigs } from "../bench/tables.ts";

type Anchor = "start" | "middle" | "end";
type Placement = { a: Anchor; dy: number };
type Metric = "query" | "total";

const lab = (a: Anchor, dy: number): Placement => ({ a, dy });

// Tried around each dot in order: beside it, then above and below, then the
// diagonals. The first that clears every dot, every placed label and the plot
// edge wins, so labels follow the points when a rerun moves them.
const CANDIDATES: Placement[] = [
	lab("start", 4),
	lab("end", 4),
	lab("middle", -12),
	lab("middle", 22),
	lab("start", -10),
	lab("start", 18),
	lab("end", -10),
	lab("end", 18),
];

type Box = { x0: number; y0: number; x1: number; y1: number };

const overlapArea = (a: Box, b: Box): number =>
	Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
	Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

const LABEL_SIZE = 12.5;
// system-ui averages about 0.55em per character at this size, a little more in bold.
const labelWidth = (text: string, bold: boolean): number =>
	text.length * LABEL_SIZE * (bold ? 0.6 : 0.55);

type Point = { name: string; mrr: number; query: number; total: number };

const METRICS: Record<
	Metric,
	{
		file: string;
		X0: number;
		X1: number;
		ticks: number[];
		heading: string;
		subtitle: (families: number, queries: number) => string;
		axis: string;
		title: string;
		tail: string;
	}
> = {
	query: {
		file: "pareto-query",
		X0: 0.2,
		X1: 30,
		ticks: [0.2, 0.5, 1, 2, 5, 10, 20],
		heading: "Ranking quality vs. per-query session time",
		subtitle: (families, queries) =>
			`MRR over ${families} query families · mixed 10k corpus · one searcher, ${queries} queries once (batch)`,
		axis: "Batch per-query: searcher built once, 24 distinct queries. Log scale, lower is better",
		title: "Fuzzy search libraries: MRR vs per-query time across a 24-query session",
		tail: "Ekrina owns the accurate end of the frontier; the faster points on it are markedly less accurate, and every other configuration, including Fuse.js, is dominated.",
	},
	total: {
		file: "pareto-total",
		X0: 1,
		X1: 120,
		ticks: [1, 2, 5, 10, 20, 50, 100],
		heading: "Ranking quality vs. cold search time",
		subtitle: (families) => `MRR over ${families} query families · mixed 10k corpus · fresh process per search`,
		axis: "Cold one-shot: constructor + first answer, fresh process. Log scale, lower is better",
		title: "Fuzzy search libraries: MRR vs cold one-shot time",
		tail: "The no-index engines own the fastest cold one-shots; base Ekrina and Ekrina (acronym) share a near-zero build and differ only in query time, Ekrina (indexed) moves the mask build into construction and still comes out faster than both, fuzzysort's prepare-all pass lands in its cold query and moves it off this frontier, and Fuse.js is dominated.",
	},
};

const LIGHT = {
	surface: "#fcfcfb",
	ink: "#0b0b0b",
	ink2: "#52514e",
	muted: "#898781",
	grid: "#e1e0d9",
	axis: "#c3c2b7",
	ekrina: "#2a78d6",
	frontier: "#1baf7a",
	dom: "#898781",
};
const DARK = {
	surface: "#1a1a19",
	ink: "#ffffff",
	ink2: "#c3c2b7",
	muted: "#898781",
	grid: "#2c2c2a",
	axis: "#383835",
	ekrina: "#3987e5",
	frontier: "#199e70",
	dom: "#8f8d86",
};
type Palette = typeof LIGHT;

const W = 820,
	H = 524,
	ML = 66,
	MR = 30,
	MT = 62;
const plotW = W - ML - MR,
	plotH = 372; // plot bottom fixed at y=434
const Y0 = 0.1,
	Y1 = 1;
const lx = Math.log10;
const Y = (mrr: number): number => MT + ((Y1 - mrr) / (Y1 - Y0)) * plotH;
const f = (v: number): number => Number(v.toFixed(1));
const DOT_R = 6.5;
const yTicks = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const tnum = 'font-variant-numeric="tabular-nums"';

// Non-dominated set: sweep by time ascending, keep strict MRR improvements.
const frontierOf = <T extends { mrr: number; ms: number }>(pts: T[]): T[] => {
	const sorted = [...pts].sort((a, b) => a.ms - b.ms || b.mrr - a.mrr);
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

const render = (
	C: Palette,
	metric: Metric,
	data: Point[],
	families: number,
	queries: number,
): string => {
	const M = METRICS[metric];
	const X = (ms: number): number => ML + ((lx(ms) - lx(M.X0)) / (lx(M.X1) - lx(M.X0))) * plotW;
	const pts = data.map((d) => ({
		n: displayName(d.name),
		mrr: d.mrr,
		ms: d[metric],
		x: f(X(d[metric])),
		y: f(Y(d.mrr)),
		isEkrina: d.name.startsWith("ekrina"),
	}));
	const front = frontierOf(pts);
	const onFrontier = new Set(front.map((p) => p.n));
	const color = (p: (typeof pts)[number]): string =>
		p.isEkrina ? C.ekrina : onFrontier.has(p.n) ? C.frontier : C.dom;
	const emphasized = (p: (typeof pts)[number]): boolean => p.isEkrina || onFrontier.has(p.n);
	const frontierPath = front.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");
	const desc =
		`Scatter plot of eight JavaScript fuzzy search libraries, each at its best-scoring configuration and Ekrina in three, comparing MRR ` +
		`(how highly each ranks the queried item) against ${metric === "query" ? "query milliseconds with indexes prebuilt" : "total milliseconds for one cold search (index build plus the first, cold query)"}, ` +
		`on a log scale, on the mixed 10k corpus over ${families} query families. ` +
		`The Pareto frontier runs ${front.map((p) => `${p.n} (${p.mrr.toFixed(2)} MRR at ${p.ms.toFixed(2)} ms)`).join(" to ")}. ` +
		M.tail;

	const grid = [
		...M.ticks.map(
			(t) =>
				`<line x1="${f(X(t))}" y1="${MT}" x2="${f(X(t))}" y2="${MT + plotH}" stroke="${C.grid}"/>`,
		),
		...yTicks.map(
			(t) =>
				`<line x1="${ML}" y1="${f(Y(t))}" x2="${ML + plotW}" y2="${f(Y(t))}" stroke="${C.grid}"/>`,
		),
	].join("\n    ");
	const xLabels = M.ticks
		.map(
			(t) =>
				`<text x="${f(X(t))}" y="${MT + plotH + 18}" text-anchor="middle" fill="${C.muted}" font-size="12" ${tnum}>${t}</text>`,
		)
		.join("\n    ");
	const yLabels = yTicks
		.map(
			(t) =>
				`<text x="${ML - 12}" y="${f(Y(t)) + 4}" text-anchor="end" fill="${C.muted}" font-size="12" ${tnum}>${t.toFixed(1)}</text>`,
		)
		.join("\n    ");
	const dots = [...pts]
		.sort((a, b) => a.y - b.y)
		.map(
			(p) =>
				`<circle cx="${p.x}" cy="${p.y}" r="${DOT_R}" fill="${color(p)}" fill-opacity="0.9" stroke="${C.surface}" stroke-width="1.5"/>`,
		)
		.join("\n    ");
	const plot: Box = { x0: ML, y0: MT, x1: ML + plotW, y1: MT + plotH };
	const taken: Box[] = [
		{ x0: ML + 12, y0: MT + 8, x1: ML + 202, y1: MT + 32 },
		...pts.map((p) => ({ x0: p.x - DOT_R, y0: p.y - DOT_R, x1: p.x + DOT_R, y1: p.y + DOT_R })),
		// The frontier line, sampled every few pixels, so no label sits across it.
		...front.slice(1).flatMap((to, i) => {
			const from = front[i];
			const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 4);
			return Array.from({ length: steps + 1 }, (_, k) => {
				const x = from.x + ((to.x - from.x) * k) / steps;
				const y = from.y + ((to.y - from.y) * k) / steps;
				return { x0: x - 2, y0: y - 2, x1: x + 2, y1: y + 2 };
			});
		}),
	];
	const textAt = (p: (typeof pts)[number], at: Placement): { x: number; y: number; box: Box } => {
		const x = at.a === "middle" ? p.x : at.a === "end" ? p.x - DOT_R - 7 : p.x + DOT_R + 7;
		const y = p.y + at.dy;
		const w = labelWidth(p.n, emphasized(p));
		const x0 = at.a === "middle" ? x - w / 2 : at.a === "end" ? x - w : x;
		return { x, y, box: { x0, y0: y - 10, x1: x0 + w, y1: y + 3 } };
	};
	const clash = (box: Box): number =>
		taken.reduce((sum, other) => sum + overlapArea(box, other), 0) +
		(box.x1 - box.x0) * (box.y1 - box.y0) -
		overlapArea(box, plot);
	const labels = [...pts]
		.sort((a, b) => Number(emphasized(b)) - Number(emphasized(a)) || b.mrr - a.mrr)
		.map((p) => {
			const tries = CANDIDATES.map((at) => ({ at, ...textAt(p, at) }));
			const best =
				tries.find((t) => clash(t.box) === 0) ??
				tries.reduce((x, y) => (clash(y.box) < clash(x.box) ? y : x));
			taken.push(best.box);
			const ink = emphasized(p) ? C.ink : C.muted;
			const weight = emphasized(p) ? ' font-weight="600"' : "";
			return `<text x="${f(best.x)}" y="${f(best.y)}" text-anchor="${best.at.a}" fill="${ink}" font-size="${LABEL_SIZE}"${weight}>${p.n}</text>`;
		})
		.join("\n    ");

	const LY = H - 16;
	const legend = `<g>
    <line x1="66" y1="${LY}" x2="92" y2="${LY}" stroke="${C.frontier}" stroke-width="2.5" stroke-linecap="round" opacity="0.85"/>
    <text x="100" y="${LY + 4}" fill="${C.ink2}" font-size="12.5">Pareto frontier</text>
    <circle cx="222" cy="${LY}" r="${DOT_R}" fill="${C.ekrina}"/>
    <text x="234" y="${LY + 4}" fill="${C.ink2}" font-size="12.5">ekrina</text>
    <circle cx="310" cy="${LY}" r="${DOT_R}" fill="${C.frontier}"/>
    <text x="322" y="${LY + 4}" fill="${C.ink2}" font-size="12.5">other Pareto-optimal</text>
    <circle cx="480" cy="${LY}" r="${DOT_R}" fill="${C.dom}"/>
    <text x="492" y="${LY + 4}" fill="${C.ink2}" font-size="12.5">dominated</text>
  </g>`;

	const better = `<g transform="translate(${ML + 12},${MT + 8})">
    <line x1="34" y1="24" x2="4" y2="4" stroke="${C.muted}" stroke-width="1.5" marker-end="url(#arrow)"/>
    <text x="40" y="20" fill="${C.muted}" font-size="12" font-style="italic">faster &amp; more accurate</text>
  </g>`;

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" role="img" aria-labelledby="${M.file}-title ${M.file}-desc">
  <title id="${M.file}-title">${M.title}</title>
  <desc id="${M.file}-desc">${desc}</desc>
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="${C.muted}"/>
    </marker>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="${C.surface}"/>
  <text x="${ML}" y="28" fill="${C.ink}" font-size="18" font-weight="600">${M.heading}</text>
  <text x="${ML}" y="47" fill="${C.ink2}" font-size="13">${M.subtitle(families, queries)}</text>
  <g>
    ${grid}
  </g>
  <line x1="${ML}" y1="${MT + plotH}" x2="${ML + plotW}" y2="${MT + plotH}" stroke="${C.axis}"/>
  <line x1="${ML}" y1="${MT}" x2="${ML}" y2="${MT + plotH}" stroke="${C.axis}"/>
  <g>
    ${xLabels}
  </g>
  <g>
    ${yLabels}
  </g>
  <text x="${ML + plotW / 2}" y="${MT + plotH + 45}" text-anchor="middle" fill="${C.ink2}" font-size="13">${M.axis}</text>
  <text transform="translate(18,${MT + plotH / 2}) rotate(-90)" text-anchor="middle" fill="${C.ink2}" font-size="13">Rank of queried item: 1st = 1.0, 10th = 0.1</text>
  <path d="${frontierPath}" fill="none" stroke="${C.frontier}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>
  ${better}
  <g>
    ${dots}
  </g>
  <g>
    ${labels}
  </g>
  ${legend}
</svg>
`;
};

/** Both charts draw mixed 10k: MRR from the scorecard, times from the cold matrix. */
export const renderPareto = (artifact: Artifact): void => {
	const scorecard = artifact.scorecard.corpora.mixed;
	if (!scorecard?.length) throw new Error("no mixed scorecard — run the quality stage first");
	const kinds = Object.keys(artifact.coldMatrix.mixed ?? {}).filter((k) => k !== "batch");
	const headline = headlineConfigs(artifact);
	const data: Point[] = scorecard.filter((r) => headline.has(r.library)).map((r) => {
		const batch = artifact.coldMatrix.mixed?.batch?.["10000"]?.[r.library];
		if (!batch) throw new Error(`no batch cell for '${r.library}' — run the cold stage first`);
		const oneShots = kinds.map((k) => artifact.coldMatrix.mixed[k]["10000"][r.library].oneShotMs);
		return {
			name: r.library,
			mrr: r.mrr,
			query: batch.restMs ?? batch.queryMs,
			total: oneShots.reduce((a, b) => a + b, 0) / oneShots.length,
		};
	});
	const families = artifact.families?.mixed?.filter((family) => family.scored).length ?? 0;
	const queries = artifact.probes.mixed?.length ?? 0;
	for (const metric of Object.keys(METRICS) as Metric[]) {
		const { file } = METRICS[metric];
		writeFileSync(
			new URL(`./${file}-light.svg`, import.meta.url),
			render(LIGHT, metric, data, families, queries),
		);
		writeFileSync(
			new URL(`./${file}-dark.svg`, import.meta.url),
			render(DARK, metric, data, families, queries),
		);
		const front = frontierOf(
			data.map((d) => ({ n: displayName(d.name), mrr: d.mrr, ms: d[metric] })),
		);
		console.error(`${file}: frontier = ${front.map((p) => p.n).join(" -> ")}`);
	}
};
