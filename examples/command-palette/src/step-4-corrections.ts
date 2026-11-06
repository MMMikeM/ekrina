import { createFuzzySearch, SCORES } from "ekrina";
import type { FuzzyResult, HighlightRanges, MatchResult } from "ekrina";
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

const bestField = (result: FuzzyResult<Command>): MatchResult =>
	result.fields.find((field) => field?.score === result.score)!;

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

const option = (result: FuzzyResult<Command>): HTMLLIElement => {
	const { title, category, keywords } = result.item;
	const [titleMatch, keywordMatch] = result.fields;
	const text = element("span", "text", element("span", "title", ...highlighted(title, titleMatch?.ranges ?? [])));
	if (!titleMatch && keywordMatch && keywords) {
		text.append(element("span", "keywords", ...highlighted(keywords, keywordMatch.ranges)));
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

	const notice = element("p", "notice");
	notice.setAttribute("aria-live", "polite");

	const list = element("ul", "options");
	list.setAttribute("aria-label", "Commands");

	root.classList.add("palette");
	root.append(input, notice, list);

	let results: FuzzyResult<Command>[] = [];

	const noticeText = (query: string): string => {
		if (query === "") return "";
		const top = results[0];
		if (!top) return `No commands match “${query}”`;
		const match = bestField(top);
		return match.tier === "corrected" ? `Showing results for “${match.corrected}”` : "";
	};

	const update = (): void => {
		const query = input.value.trim();
		results = query === "" ? [] : search(query);
		list.replaceChildren(...results.map((result) => option(result)));
		notice.textContent = noticeText(query);
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
