import { createFuzzySearch, SCORES } from "ekrina";
import type { FuzzyResult } from "ekrina";
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

const option = (result: FuzzyResult<Command>): HTMLLIElement => {
	const { title, category, keywords } = result.item;
	const [titleMatch, keywordMatch] = result.fields;
	const text = element("span", "text", element("span", "title", title));
	if (!titleMatch && keywordMatch && keywords) {
		text.append(element("span", "keywords", keywords));
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

	let results: FuzzyResult<Command>[] = [];

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
	list.addEventListener("click", (event) => {
		const row = (event.target as Element).closest("li");
		if (row) choose([...list.children].indexOf(row));
	});
};
