import type { Element, ElementContent, Root, RootContent } from "hast";

type Node = RootContent | ElementContent;

type Panel = { corpus: string; note: string; label: Element; content: Node[] };

const CORPUS_LABEL = /^(\S+) corpus:?$/;

const textOf = (node: Node): string =>
	node.type === "text"
		? node.value
		: node.type === "element"
			? node.children.map(textOf).join("")
			: "";

const isFiller = (node: Node) =>
	node.type === "raw" || node.type === "comment" || (node.type === "text" && node.value.trim() === "");

const isTable = (node: Node): node is Element => node.type === "element" && node.tagName === "table";

/** `**native corpus:**`, optionally followed by a note such as "(quality only; …):". */
const corpusLabel = (node: Node): Omit<Panel, "content"> | undefined => {
	if (node.type !== "element" || node.tagName !== "p") {
		return undefined;
	}
	const [first, ...rest] = node.children.filter((child) => !isFiller(child));
	if (first?.type !== "element" || first.tagName !== "strong") {
		return undefined;
	}
	const corpus = CORPUS_LABEL.exec(textOf(first).trim())?.[1];
	if (!corpus) {
		return undefined;
	}
	const note = rest
		.map(textOf)
		.join("")
		.trim()
		.replace(/^\((.*)\):?$/, "$1")
		.replace(/:$/, "");
	return { corpus, note, label: node };
};

const element = (tagName: string, properties: Element["properties"], children: ElementContent[]): Element => ({
	type: "element",
	tagName,
	properties,
	children,
});

const text = (value: string): ElementContent => ({ type: "text", value });

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

let switches = 0;

const elementsOf = (node: Element, tagName: string): Element[] =>
	node.children.filter((child): child is Element => child.type === "element" && child.tagName === tagName);

const rowsOf = (table: Element, section: "thead" | "tbody") =>
	elementsOf(table, section).flatMap((part) => elementsOf(part, "tr"));

const cellsOf = (row: Element) =>
	row.children.filter((child): child is Element => child.type === "element" && /^t[dh]$/.test(child.tagName));

// Tables whose first column is the query group, as the family tables are: each
// row is tagged with its group's position in `groups`, so the CSS can match it
// to the nth button without knowing the group names.
const tagGroups = (tables: Element[]): string[] => {
	const groups: string[] = [];
	for (const table of tables) {
		const header = rowsOf(table, "thead")[0];
		if (!header || textOf(cellsOf(header)[0]!).trim() !== "Group") {
			continue;
		}
		table.properties = { ...table.properties, className: ["grouped"] };
		for (const row of rowsOf(table, "tbody")) {
			const group = textOf(cellsOf(row)[0]!).trim();
			if (!groups.includes(group)) {
				groups.push(group);
			}
			row.properties = { ...row.properties, dataGroup: String(groups.indexOf(group) + 1) };
		}
	}
	return groups;
};

const segmented = (className: string, legend: string, name: string, values: string[]): Element =>
	element("fieldset", { className: ["segmented", className, "decoration", "not-content"] }, [
		element("legend", { className: ["sr-only"] }, [text(legend)]),
		...values.map((value, k) =>
			element("label", {}, [
				element("input", { type: "radio", name, value, checked: k === 0 }, []),
				text(value),
			]),
		),
	]);

const panelOf = (panel: Panel): Element =>
	element("div", { className: ["corpus-panel"], dataCorpus: panel.corpus }, [
		// The label stays for the Markdown copy, and for a table that lacks the picked corpus.
		{ ...panel.label, properties: { ...panel.label.properties, className: ["corpus-label"] } },
		...(panel.note
			? [element("p", { className: ["corpus-note", "decoration"] }, [text(`${capitalise(panel.note)}.`)])]
			: []),
		...(panel.content as ElementContent[]),
	]);

const switchOf = (panels: Panel[]): Element => {
	const id = ++switches;
	const groups = tagGroups(panels.flatMap((panel) => panel.content.filter(isTable)));
	return element("div", { className: ["corpus-switch"] }, [
		...(groups.length > 1
			? [segmented("group-control", "Query group", `group-${id}`, groups)]
			: []),
		...panels.map(panelOf),
	]);
};

// One control for the page, so every table shows the same corpus.
const corpusBar = (corpora: string[]): Element =>
	element("fieldset", { className: ["corpus-bar", "decoration", "not-content"] }, [
		element("legend", {}, [text("Corpus")]),
		element(
			"div",
			{ className: ["segmented"] },
			corpora.map((corpus, k) =>
				element("label", {}, [
					element("input", { type: "radio", name: "corpus", value: corpus, checked: k === 0 }, []),
					text(corpus),
				]),
			),
		),
	]);

const switchCorpusRuns = (children: Node[]): { out: Node[]; panels: Panel[] } => {
	const out: Node[] = [];
	const all: Panel[] = [];
	let k = 0;
	while (k < children.length) {
		const panels: Panel[] = [];
		let next = k;
		for (;;) {
			let at = next;
			while (at < children.length && isFiller(children[at]!)) at++;
			const label = at < children.length ? corpusLabel(children[at]!) : undefined;
			if (!label) break;
			const content: Node[] = [];
			let end = at + 1;
			for (;;) {
				let probe = end;
				while (probe < children.length && isFiller(children[probe]!)) probe++;
				if (probe < children.length && isTable(children[probe]!)) {
					content.push(children[probe]!);
					end = probe + 1;
				} else break;
			}
			if (content.length === 0) break;
			panels.push({ ...label, content });
			next = end;
		}
		if (panels.length >= 2) {
			out.push(switchOf(panels));
			all.push(...panels);
			k = next;
		} else {
			out.push(children[k]!);
			k++;
		}
	}
	return { out, panels: all };
};

const isSwitch = (node: Node) =>
	node.type === "element" && (node.properties.className as string[] | undefined)?.includes("corpus-switch");

export const corpusSwitch = () => (tree: Root) => {
	const { out, panels } = switchCorpusRuns(tree.children);
	const corpora = [...new Set(panels.map((panel) => panel.corpus))];
	// Panels carry their corpus's position in the bar, so the CSS can pair the
	// nth button with its panels without knowing the corpus names.
	for (const node of out) {
		if (isSwitch(node)) {
			for (const panel of (node as Element).children) {
				if (panel.type === "element" && panel.properties.dataCorpus) {
					panel.properties.dataCorpusIndex = String(corpora.indexOf(String(panel.properties.dataCorpus)) + 1);
				}
			}
		}
	}
	const first = out.findIndex(isSwitch);
	const last = out.findLastIndex(isSwitch);
	if (first >= 0) {
		// The bar sticks only while its scope, the first switch to the last, is on screen.
		const scope = element("div", { className: ["corpus-scope"] }, [
			corpusBar(corpora),
			...(out.slice(first, last + 1) as ElementContent[]),
		]);
		out.splice(first, last + 1 - first, scope);
	}
	tree.children = out as RootContent[];
};
