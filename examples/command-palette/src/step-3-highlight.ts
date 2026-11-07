import { createSearcher, SCORES } from "ekrina";
import type { HighlightRanges, SearchResultOf } from "ekrina";
import type { Command } from "./commands";

const LIMIT = 8;

const createSearch = (commands: Command[]) => {
	const search = createSearcher(commands, {
		title: { selectField: (command) => command.title, acronym: true },
		keywords: { selectField: (command) => command.keywords ?? null, demoteBy: SCORES.CONTAINS },
	});
	search.buildIndex();
	return (query: string) => search(query, { limit: LIMIT });
};

type Result = SearchResultOf<typeof createSearch>;

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

const option = (result: Result): HTMLLIElement => {
	const { title, category, keywords } = result.item;
	const keywordsMatched = result.field === "keywords";
	const text = element(
		"span",
		"text",
		element("span", "title", ...highlighted(title, keywordsMatched ? [] : result.ranges)),
	);
	if (keywordsMatched && keywords) {
		text.append(element("span", "keywords", ...highlighted(keywords, result.ranges)));
	}
	return element("li", "option", text, element("span", "category", category));
};

export const createPalette = (
	root: HTMLElement,
	commands: Command[],
	run: (command: Command) => void,
): void => {
	const search = createSearch(commands);

	const input = element("input", "query");
	input.type = "text";
	input.placeholder = "Type a command";
	input.autocomplete = "off";
	input.spellcheck = false;
	input.setAttribute("aria-label", "Command");

	const list = element("ul", "options");
	list.setAttribute("aria-label", "Commands");

	root.classList.add("palette");
	root.append(input, list);

	let results: Result[] = [];

	const update = (): void => {
		const query = input.value.trim();
		results = query === "" ? [] : search(query);
		list.replaceChildren(...results.map((result) => option(result)));
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
		if (event.key === "Enter") choose(0);
	});
	list.addEventListener("click", (event) => {
		const row = (event.target as Element).closest("li");
		if (row) choose([...list.children].indexOf(row));
	});
};
