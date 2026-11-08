import raw from "./data/pareto.json";
import {
	captionOf,
	chartSvg,
	CORPORA,
	corpusOf,
	MEASURES,
	constructorNote,
	type Corpus,
	type Measure,
	type ParetoData,
	type ParetoState,
	tableHtml,
	tooltipHtml,
} from "./pareto.ts";

const data = raw as ParetoData;
const TIP_GAP = 14;
const NARROW_PX = 480;

const radios = (form: HTMLFormElement, control: string) =>
	[...form.querySelectorAll<HTMLInputElement>(`input[name$="-${control}"]`)];

const checkedValue = (form: HTMLFormElement, control: string) =>
	radios(form, control).find((input) => input.checked)?.value;

// A link can open the chart on a view: ?pareto=one-shot,not-counted,en,100000.
// Anything it doesn't recognise keeps the page's own choice.
const initialOverride = (state: ParetoState): ParetoState => {
	const asked = new URLSearchParams(location.search).get("pareto")?.split(",") ?? [];
	const [measure = "", constructor = "", corpus = "", size = ""] = asked;
	const chosenCorpus = (CORPORA as readonly string[]).includes(corpus)
		? (corpus as Corpus)
		: state.corpus;
	return {
		measure: (MEASURES as readonly string[]).includes(measure) ? (measure as Measure) : state.measure,
		constructorCounted:
			constructor === "counted" || constructor === "not-counted"
				? constructor === "counted"
				: state.constructorCounted,
		corpus: chosenCorpus,
		size: corpusOf(data, chosenCorpus).sizes.includes(size) ? size : state.size,
	};
};

export const hydrate = (figure: HTMLElement): void => {
	const form = figure.querySelector<HTMLFormElement>(".pareto-controls")!;
	const plot = figure.querySelector<HTMLElement>(".pareto-plot")!;
	const tip = figure.querySelector<HTMLElement>(".pareto-tip")!;
	const caption = figure.querySelector<HTMLElement>("figcaption")!;
	const table = figure.querySelector<HTMLElement>(".pareto-numbers .table-scroll")!;
	let state = initialOverride(JSON.parse(figure.dataset.pareto!) as ParetoState);
	let width = 0;
	let active: string | null = null;
	let focused: string | null = null;

	const points = () => [...plot.querySelectorAll<SVGGElement>(".pt")];
	const pointOf = (config: string) =>
		points().find((point) => point.dataset.config === config) ?? null;
	const inXOrder = () =>
		points().sort((a, b) => Number(a.dataset.x) - Number(b.dataset.x) || Number(a.dataset.y) - Number(b.dataset.y));

	const syncControls = () => {
		const note = constructorNote(state);
		for (const input of radios(form, "measure")) input.checked = input.value === state.measure;
		for (const input of radios(form, "corpus")) input.checked = input.value === state.corpus;
		for (const input of radios(form, "size")) input.checked = input.value === state.size;
		for (const input of radios(form, "constructor")) {
			input.disabled = note !== "";
			input.checked = !input.disabled && (input.value === "counted") === state.constructorCounted;
		}
		form.querySelector('[id$="-constructor-note"]')!.textContent = note;
	};

	const hideTip = () => {
		tip.hidden = true;
		active = null;
		figure.querySelector(".pt[aria-describedby]")?.removeAttribute("aria-describedby");
		for (const element of plot.querySelectorAll(".is-active")) element.classList.remove("is-active");
	};

	const showTip = (config: string) => {
		const point = pointOf(config);
		if (!point) return;
		hideTip();
		active = config;
		point.classList.add("is-active");
		plot.querySelector(`.label[data-config="${CSS.escape(config)}"]`)?.classList.add("is-active");
		tip.innerHTML = tooltipHtml(data, state, config);
		tip.hidden = false;
		const svg = plot.querySelector("svg")!;
		const scale = svg.clientWidth / svg.viewBox.baseVal.width;
		const x = Number(point.dataset.x) * scale;
		const y = Number(point.dataset.y) * scale;
		// A phone's chart is too small to share with the tooltip, so it docks under the plot.
		const at =
			plot.clientWidth < NARROW_PX
				? { left: 0, top: plot.clientHeight + 4 }
				: tipPlacement(x, y, tip.offsetWidth, tip.offsetHeight);
		tip.style.left = `${at.left}px`;
		tip.style.top = `${at.top}px`;
	};

	// Beside the point if that covers nothing, else wherever covers the fewest labels and dots.
	const tipPlacement = (x: number, y: number, w: number, h: number) => {
		const origin = plot.getBoundingClientRect();
		const marks = [...plot.querySelectorAll(".labels text, .pt .mark")].map((element) => {
			const r = element.getBoundingClientRect();
			// Hiding the point the tooltip describes is worse than hiding any number of others.
			const weight = element.closest(".pt.is-active") ? 1e6 : 1;
			return {
				x0: r.left - origin.left,
				y0: r.top - origin.top,
				x1: r.right - origin.left,
				y1: r.bottom - origin.top,
				weight,
			};
		});
		const clamp = (left: number, top: number) => ({
			left: Math.min(Math.max(0, left), plot.clientWidth - w),
			top: Math.min(Math.max(0, top), plot.clientHeight - h),
		});
		const tries = [
			clamp(x + TIP_GAP, y - h / 2),
			clamp(x - TIP_GAP - w, y - h / 2),
			clamp(x - w / 2, y + TIP_GAP),
			clamp(x - w / 2, y - TIP_GAP - h),
			clamp(x + TIP_GAP, y + TIP_GAP),
			clamp(x - TIP_GAP - w, y + TIP_GAP),
			clamp(x + TIP_GAP, y - TIP_GAP - h),
			clamp(x - TIP_GAP - w, y - TIP_GAP - h),
		];
		const covered = (at: { left: number; top: number }) =>
			marks.reduce(
				(sum, m) =>
					sum +
					m.weight *
						Math.max(0, Math.min(m.x1, at.left + w) - Math.max(m.x0, at.left)) *
						Math.max(0, Math.min(m.y1, at.top + h) - Math.max(m.y0, at.top)),
				0,
			);
		return tries.reduce((a, b) => (covered(b) < covered(a) ? b : a));
	};

	const setRovingStop = () => {
		const ordered = inXOrder();
		const stop = (focused && pointOf(focused)) || ordered[0];
		for (const point of ordered) point.tabIndex = point === stop ? 0 : -1;
	};

	const render = (moved: boolean) => {
		const before = new Map(
			points().map((point) => [point.dataset.config!, [Number(point.dataset.x), Number(point.dataset.y)]]),
		);
		const hadFocus = focused !== null && figure.contains(document.activeElement);
		const shown = active;
		plot.querySelector("svg")?.remove();
		plot.insertAdjacentHTML("afterbegin", chartSvg(data, state, width));
		setRovingStop();
		plot.classList.remove("is-moving");
		if (moved) {
			for (const point of points()) {
				const from = before.get(point.dataset.config!);
				if (!from) continue;
				const dx = from[0]! - Number(point.dataset.x);
				const dy = from[1]! - Number(point.dataset.y);
				point.style.transform = `translate(${dx}px, ${dy}px)`;
			}
			void plot.offsetWidth;
			plot.classList.add("is-moving");
			for (const point of points()) point.style.transform = "";
		}
		if (hadFocus && focused) pointOf(focused)?.focus({ preventScroll: true });
		if (shown) showTip(shown);
	};

	const update = (moved: boolean) => {
		syncControls();
		const sentences = captionOf(data, state);
		// The caption is a live region, so it changes only when the view does.
		if (caption.textContent !== sentences.map((sentence) => `${sentence} `).join("")) {
			caption.replaceChildren(
				...sentences.map((sentence) => {
					const span = document.createElement("span");
					span.textContent = `${sentence} `;
					return span;
				}),
			);
		}
		table.innerHTML = tableHtml(data, state);
		render(moved);
	};

	form.addEventListener("change", () => {
		const constructor = checkedValue(form, "constructor");
		state = {
			measure: (checkedValue(form, "measure") as Measure | undefined) ?? state.measure,
			constructorCounted: constructor ? constructor === "counted" : state.constructorCounted,
			corpus: (checkedValue(form, "corpus") as Corpus | undefined) ?? state.corpus,
			size: checkedValue(form, "size") ?? state.size,
		};
		update(true);
	});

	plot.addEventListener("pointerover", (event) => {
		const target = (event.target as Element).closest<SVGElement>("[data-config]");
		if (target) showTip(target.dataset.config!);
	});
	plot.addEventListener("pointerleave", () => {
		if (!focused) hideTip();
	});
	document.addEventListener("pointerdown", (event) => {
		if (!plot.contains(event.target as Node)) hideTip();
	});
	plot.addEventListener("focusin", (event) => {
		const point = (event.target as Element).closest<SVGGElement>(".pt");
		if (!point) return;
		focused = point.dataset.config!;
		setRovingStop();
		showTip(focused);
		point.setAttribute("aria-describedby", tip.id);
	});
	plot.addEventListener("focusout", (event) => {
		if (plot.contains(event.relatedTarget as Node)) return;
		focused = null;
		hideTip();
	});
	plot.addEventListener("keydown", (event) => {
		const ordered = inXOrder();
		const at = ordered.findIndex((point) => point.dataset.config === focused);
		if (at < 0) return;
		const next =
			event.key === "ArrowRight" || event.key === "ArrowDown"
				? ordered[Math.min(at + 1, ordered.length - 1)]
				: event.key === "ArrowLeft" || event.key === "ArrowUp"
					? ordered[Math.max(at - 1, 0)]
					: event.key === "Home"
						? ordered[0]
						: event.key === "End"
							? ordered.at(-1)
							: undefined;
		if (event.key === "Escape") {
			hideTip();
			return;
		}
		if (!next) return;
		event.preventDefault();
		next.focus();
	});

	new ResizeObserver(() => {
		const next = Math.round(plot.clientWidth);
		if (next === width || next === 0) return;
		width = next;
		render(false);
	}).observe(plot);

	form.hidden = false;
	width = Math.round(plot.clientWidth);
	update(false);
};
