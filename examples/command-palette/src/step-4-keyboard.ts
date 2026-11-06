import { createFuzzySearch, SCORES } from "ekrina";
import type { FuzzyResult, HighlightRanges } from "ekrina";
import type { Command } from "./commands";

const LIMIT = 8;

const createSearch = (commands: Command[]) => {
	const search = createFuzzySearch(commands, [
		{ selectField: (command) => command.title, acronym: true },
		{ selectField: (command) => command.keywords ?? null, demoteBy: SCORES.CONTAINS },
	]);
	search.buildIndex();
	return (query: string) => search(query, { limit: LIMIT });
};

const highlighted = (text: string, ranges: HighlightRanges): (string | HTMLElement)[] => {
	const nodes: (string | HTMLElement)[] = [];
	let cursor = 0;
	for (const [start, end] of ranges) {
		if (start > cursor) nodes.push(text.slice(cursor, start));
		const mark = document.createElement("mark");
		mark.textContent = text.slice(start, end + 1);
		nodes.push(mark);
		cursor = end + 1;
	}
	if (cursor < text.length) nodes.push(text.slice(cursor));
	return nodes;
};

const element = <K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className: string,
	...children: (string | HTMLElement)[]
): HTMLElementTagNameMap[K] => {
	const node = document.createElement(tag);
	node.className = className;
	node.append(...children);
	return node;
};

const option = (result: FuzzyResult<Command>, id: string): HTMLLIElement => {
	const { title, category, keywords } = result.item;
	const [titleMatch, keywordMatch] = result.fields;
	const text = element("span", "text", element("span", "title", ...highlighted(title, titleMatch?.ranges ?? [])));
	if (!titleMatch && keywordMatch && keywords) {
		text.append(element("span", "keywords", ...highlighted(keywords, keywordMatch.ranges)));
	}
	const row = element("li", "option", text, element("span", "category", category));
	row.id = id;
	row.setAttribute("role", "option");
	return row;
};

export const createPalette = (
	root: HTMLElement,
	commands: Command[],
	run: (command: Command) => void,
): void => {
	const search = createSearch(commands);
	const listId = `${root.id || "palette"}-options`;

	const input = element("input", "query");
	input.type = "text";
	input.placeholder = "Type a command";
	input.autocomplete = "off";
	input.spellcheck = false;
	input.setAttribute("role", "combobox");
	input.setAttribute("aria-label", "Command");
	input.setAttribute("aria-controls", listId);
	input.setAttribute("aria-autocomplete", "list");
	input.setAttribute("aria-expanded", "false");

	const list = element("ul", "options");
	list.id = listId;
	list.setAttribute("role", "listbox");
	list.setAttribute("aria-label", "Commands");

	root.classList.add("palette");
	root.append(input, list);

	let results: FuzzyResult<Command>[] = [];
	let active = 0;

	const highlightActive = (): void => {
		[...list.children].forEach((row, i) => row.setAttribute("aria-selected", String(i === active)));
		const row = list.children[active];
		if (row) input.setAttribute("aria-activedescendant", row.id);
		else input.removeAttribute("aria-activedescendant");
		row?.scrollIntoView({ block: "nearest" });
	};

	const update = (): void => {
		const query = input.value.trim();
		results = query === "" ? [] : search(query);
		active = 0;
		list.replaceChildren(...results.map((result, i) => option(result, `${listId}-${i}`)));
		input.setAttribute("aria-expanded", String(results.length > 0));
		highlightActive();
	};

	const choose = (index: number): void => {
		const result = results[index];
		if (!result) return;
		run(result.item);
		input.value = "";
		update();
	};

	input.addEventListener("input", update);
	input.addEventListener("keydown", (event) => {
		const moves: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
		const move = moves[event.key];
		if (move && results.length > 0) {
			event.preventDefault();
			active = (active + move + results.length) % results.length;
			highlightActive();
		} else if (event.key === "Enter") {
			event.preventDefault();
			choose(active);
		} else if (event.key === "Escape") {
			input.value = "";
			update();
		}
	});
	// Keeps focus in the input, so typing carries on after a click.
	list.addEventListener("mousedown", (event) => event.preventDefault());
	list.addEventListener("click", (event) => {
		const row = (event.target as Element).closest("li");
		if (row) choose([...list.children].indexOf(row));
	});
};
