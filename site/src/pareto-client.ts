import raw from "./data/pareto.json";
import {
	captionOf,
	chartSvg,
	constructorNote,
	CORPORA,
	CORPUS_DEFINITIONS,
	corpusOf,
	MEASURES,
	SCALES,
	type Corpus,
	type Measure,
	type ParetoData,
	type ParetoState,
	type Scale,
	pointsOf,
	sizeFor,
	sizeNote,
	tableHtml,
	tooltipHtml,
	viewFrontier,
} from "./pareto.ts";

const data = raw as ParetoData;
const TIP_GAP = 14;
const NARROW_PX = 480;
const HIT_PX = 14;
// Half of --tap-target, so a finger's target is 2.75rem across.
const TOUCH_HIT_PX = 22;
// Points this close draw over each other, so the tooltip lists them all.
const COINCIDENT_PX = 4;

const radios = (form: HTMLFormElement, control: string) =>
	[...form.querySelectorAll<HTMLInputElement>(`input[name$="-${control}"]`)];

const checkedValue = (form: HTMLFormElement, control: string) =>
	radios(form, control).find((input) => input.checked)?.value;

const constructorField = (state: ParetoState) =>
	state.constructorCounted ? "counted" : "not-counted";

// A link can open the chart on a view: ?pareto=one-shot,not-counted,en,100000,linear.
// Anything it doesn't recognise, or leaves off the end, keeps the page's own choice.
const initialOverride = (state: ParetoState): ParetoState => {
	const asked = new URLSearchParams(location.search).get("pareto")?.split(",") ?? [];
	const [measure = "", constructor = "", corpus = "", size = "", scale = ""] = asked;
	const chosenCorpus = (CORPORA as readonly string[]).includes(corpus)
		? (corpus as Corpus)
		: state.corpus;
	const coldQuery = measure === "cold-query";
	return {
		measure: coldQuery
			? "one-shot"
			: (MEASURES as readonly string[]).includes(measure)
				? (measure as Measure)
				: state.measure,
		constructorCounted:
			!coldQuery && (constructor === "counted" || constructor === "not-counted")
				? constructor === "counted"
				: coldQuery
					? false
					: state.constructorCounted,
		corpus: chosenCorpus,
		size: sizeFor(data, chosenCorpus, size || state.size),
		scale: (SCALES as readonly string[]).includes(scale) ? (scale as Scale) : state.scale,
	};
};

/** The `pareto` parameter for `state`, leaving off the trailing fields that match the page's own view. */
const viewParam = (state: ParetoState, initial: ParetoState): string => {
	const fields = [state.measure, constructorField(state), state.corpus, state.size, state.scale];
	const defaults = [
		initial.measure,
		constructorField(initial),
		initial.corpus,
		sizeFor(data, state.corpus, initial.size),
		initial.scale,
	];
	let length = fields.length;
	while (length > 0 && fields[length - 1] === defaults[length - 1]) length--;
	return fields.slice(0, length).join(",");
};

const writeUrl = (param: string) => {
	const url = new URL(location.href);
	if (param) url.searchParams.set("pareto", param);
	else url.searchParams.delete("pareto");
	url.search = url.search.replaceAll("%2C", ",");
	if (url.href !== location.href) history.replaceState(history.state, "", url);
};

export const hydrate = (figure: HTMLElement): void => {
	const form = figure.querySelector<HTMLFormElement>(".pareto-controls")!;
	const scaleForm = figure.querySelector<HTMLFormElement>(".pareto-scale")!;
	const plot = figure.querySelector<HTMLElement>(".pareto-plot")!;
	const tip = figure.querySelector<HTMLElement>(".pareto-tip")!;
	const caption = figure.querySelector<HTMLElement>("figcaption")!;
	const table = figure.querySelector<HTMLElement>(".pareto-numbers .table-scroll")!;
	const pageView = JSON.parse(figure.dataset.pareto!) as ParetoState;
	let state = initialOverride(pageView);
	let rankedSize = corpusOf(data, state.corpus).ranked ? state.size : pageView.size;
	let width = 0;
	let active: string[] = [];
	let focused: string | null = null;

	const points = () => [...plot.querySelectorAll<SVGGElement>(".pt")];
	const pointOf = (config: string) =>
		points().find((point) => point.dataset.config === config) ?? null;
	const inXOrder = () =>
		points().sort(
			(a, b) =>
				Number(a.dataset.x) - Number(b.dataset.x) || Number(a.dataset.y) - Number(b.dataset.y),
		);

	const note = (control: string, text: string) => {
		for (const variant of form.querySelectorAll(`[id$="-${control}-note"] > span`)) {
			variant.toggleAttribute("data-active", variant.textContent === text);
		}
	};

	const syncControls = () => {
		const sizes = corpusOf(data, state.corpus).sizes;
		const constructorOff = constructorNote(state);
		for (const input of radios(form, "measure")) input.checked = input.value === state.measure;
		for (const input of radios(scaleForm, "scale")) input.checked = input.value === state.scale;
		for (const input of radios(form, "corpus")) input.checked = input.value === state.corpus;
		for (const input of radios(form, "size")) {
			input.disabled = !sizes.includes(input.value);
			input.checked = !input.disabled && input.value === state.size;
		}
		for (const input of radios(form, "constructor")) {
			input.disabled = constructorOff !== "";
			input.checked =
				!input.disabled && input.value === constructorField(state);
		}
		note("constructor", constructorOff);
		note("corpus", CORPUS_DEFINITIONS[state.corpus]);
		note("size", sizeNote(data, state));
		const front = viewFrontier(data, state, pointsOf(data, state));
		figure.dataset.frontier = front.length > 1 ? "line" : front.length === 1 ? "point" : "none";
	};

	const hideTip = () => {
		tip.hidden = true;
		active = [];
		figure.querySelector(".pt[aria-describedby]")?.removeAttribute("aria-describedby");
		for (const element of plot.querySelectorAll(".is-active")) element.classList.remove("is-active");
	};

	const showTip = (configs: string[]) => {
		const point = pointOf(configs[0]!);
		if (!point) return;
		hideTip();
		active = configs;
		for (const config of configs) {
			pointOf(config)?.classList.add("is-active");
			plot.querySelector(`.label[data-config="${CSS.escape(config)}"]`)?.classList.add("is-active");
		}
		tip.innerHTML = tooltipHtml(data, state, configs);
		tip.hidden = false;
		const docked = plot.clientWidth < NARROW_PX;
		tip.classList.toggle("docked", docked);
		if (docked) {
			tip.style.left = "";
			tip.style.top = "";
			return;
		}
		const svg = plot.querySelector("svg")!;
		const scale = svg.clientWidth / svg.viewBox.baseVal.width;
		const at = tipPlacement(
			Number(point.dataset.x) * scale,
			Number(point.dataset.y) * scale,
			tip.offsetWidth,
			tip.offsetHeight,
		);
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

	/** The configs under the pointer: the nearest point in reach, and every point drawn on top of it. */
	const pointsUnder = (event: PointerEvent): string[] => {
		const svg = plot.querySelector("svg");
		if (!svg) return [];
		const box = svg.getBoundingClientRect();
		const scale = box.width / svg.viewBox.baseVal.width;
		const x = (event.clientX - box.left) / scale;
		const y = (event.clientY - box.top) / scale;
		const reach = (event.pointerType === "touch" ? TOUCH_HIT_PX : HIT_PX) / scale;
		const centres = points().map((point) => ({
			config: point.dataset.config!,
			x: Number(point.dataset.x),
			y: Number(point.dataset.y),
		}));
		const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
			Math.hypot(a.x - b.x, a.y - b.y);
		const nearest = centres
			.filter((centre) => distance(centre, { x, y }) <= reach)
			.sort((a, b) => distance(a, { x, y }) - distance(b, { x, y }))[0];
		if (!nearest) return [];
		return [
			nearest.config,
			...centres
				.filter((c) => c !== nearest && distance(c, nearest) <= COINCIDENT_PX / scale)
				.map((c) => c.config),
		];
	};

	const setRovingStop = () => {
		const ordered = inXOrder();
		const stop = (focused && pointOf(focused)) || ordered[0];
		for (const point of ordered) point.tabIndex = point === stop ? 0 : -1;
	};

	const render = (moved: boolean) => {
		const before = new Map(
			points().map((point) => [
				point.dataset.config!,
				[Number(point.dataset.x), Number(point.dataset.y)],
			]),
		);
		const hadFocus = focused !== null && figure.contains(document.activeElement);
		const shown = active;
		for (const stale of plot.querySelectorAll(".pareto-static, svg")) stale.remove();
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
		if (shown.length > 0) showTip(shown);
	};

	const update = (moved: boolean) => {
		syncControls();
		const sentences = captionOf(data, state);
		// The caption is a live region, so it changes only when the view does.
		if (caption.textContent !== sentences.map((sentence) => `${sentence.text} `).join("")) {
			caption.replaceChildren(
				...sentences.map((sentence) => {
					const span = document.createElement("span");
					if (sentence.tone) span.className = sentence.tone;
					span.textContent = `${sentence.text} `;
					return span;
				}),
			);
		}
		table.innerHTML = tableHtml(data, state);
		render(moved);
	};

	form.addEventListener("change", () => {
		const corpus = (checkedValue(form, "corpus") as Corpus | undefined) ?? state.corpus;
		const constructor = checkedValue(form, "constructor");
		const size = sizeFor(data, corpus, checkedValue(form, "size") ?? rankedSize);
		if (corpusOf(data, corpus).ranked) rankedSize = size;
		state = {
			measure: (checkedValue(form, "measure") as Measure | undefined) ?? state.measure,
			constructorCounted: constructor ? constructor === "counted" : state.constructorCounted,
			corpus,
			size,
			scale: state.scale,
		};
		hideTip();
		update(true);
		writeUrl(viewParam(state, pageView));
	});

	const pointAt = (event: PointerEvent) => {
		const under = pointsUnder(event);
		if (under.length === 0) {
			if (!focused) hideTip();
			return;
		}
		if (under.join() !== active.join()) showTip(under);
	};
	plot.addEventListener("pointermove", pointAt);
	plot.addEventListener("pointerdown", pointAt);
	// A finger leaves as it lifts, so a tapped tooltip stays until the next tap.
	plot.addEventListener("pointerleave", (event) => {
		if (event.pointerType !== "touch" && !focused) hideTip();
	});
	document.addEventListener("pointerdown", (event) => {
		if (!plot.contains(event.target as Node)) hideTip();
	});
	plot.addEventListener("focusin", (event) => {
		const point = (event.target as Element).closest<SVGGElement>(".pt");
		if (!point) return;
		focused = point.dataset.config!;
		setRovingStop();
		showTip([focused]);
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

	scaleForm.addEventListener("change", () => {
		const scale = checkedValue(scaleForm, "scale") as Scale | undefined;
		state = { ...state, scale: scale ?? state.scale };
		hideTip();
		update(true);
		writeUrl(viewParam(state, pageView));
	});

	form.hidden = false;
	scaleForm.hidden = false;
	width = Math.round(plot.clientWidth);
	update(false);
};
