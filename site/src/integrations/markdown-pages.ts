import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import type { Element, ElementContent, Root, Text } from "hast";
import { matches, select, selectAll } from "hast-util-select";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { remove } from "unist-util-remove";
import { markdownPath } from "../markdown-path.ts";

const NOISE = [
	".sl-anchor-link",
	".sr-only",
	"script",
	"style",
	// Each chart ships in both themes; the copy needs one.
	".chart-dark",
	".decoration",
	"starlight-tabs-restore",
];

const textOf = (node: ElementContent): string =>
	node.type === "text"
		? node.value
		: node.type === "element"
			? node.children.map(textOf).join("")
			: "";

// Expressive Code renders each line as a block, which converts to doubled blank
// lines, and puts the language on <pre> where hast-util-to-mdast doesn't look.
// A file title in the frame header becomes a line above the block.
const prepareCodeBlocks = (tree: Root) => {
	for (const frame of selectAll(".expressive-code", tree)) {
		const pre = select("pre", frame);
		const code = select("code", frame);
		const language = pre?.properties.dataLanguage;
		if (code) {
			const lines = selectAll(".ec-line", code);
			const isDiff = lines.some((line) => matches(".ins, .del", line));
			const source = lines.map((line) => (isDiff ? diffLine(line) : lineText(line)));
			code.children = [text(source.join("\n"))];
			code.properties.className = isDiff
				? ["language-diff"]
				: typeof language === "string"
					? [`language-${language}`]
					: [];
		}
		const title = select("figcaption .title", frame);
		const titleText = title?.children.find((child) => child.type === "text")?.value.trim();
		frame.tagName = "div";
		frame.children = [
			...(titleText ? [element("p", element("code", text(titleText)))] : []),
			...(pre ? [pre] : []),
		];
	}
};

// An empty line holds a lone "\n" to keep its height.
const lineText = (line: Element) => textOf(line).replace(/\n$/, "");

// Expressive Code moves a diff's +/- markers into line classes, so the text alone
// prints removed and added lines the same. This puts back the "- " column the
// source wrote, which Expressive Code strips as the block's common indentation.
const diffLine = (line: Element) => {
	const marker = matches(".ins", line) ? "+" : matches(".del", line) ? "-" : " ";
	const content = lineText(line);
	return content === "" ? marker.trim() : `${marker} ${content}`;
};

// Tabs become a list: each tab's label, then its panel.
const prepareTabs = (tree: Root) => {
	for (const tabs of selectAll("starlight-tabs", tree)) {
		const labels = selectAll('[role="tab"]', tabs).map((tab) =>
			tab.children
				.filter((child) => child.type === "text")
				.map((child) => child.value.trim())
				.join(""),
		);
		const panels = selectAll('[role="tabpanel"]', tabs);
		tabs.tagName = "ul";
		tabs.properties = {};
		tabs.children = panels.map((panel, index): Element => ({
			type: "element",
			tagName: "li",
			properties: {},
			children: [element("p", element("strong", text(labels[index] ?? ""))), panel],
		}));
	}
};

// A splash page's tagline, install command, action links and demo sit in its hero, outside the content.
const heroOf = (page: Root): ElementContent[] => {
	const tagline = select(".hero .tagline > p", page);
	const actions = selectAll(".hero .actions a", page);
	const install = select(".install code", page);
	const demoSample = select(".search-demo .sample", page);
	return [
		...(tagline ? [element("p", ...tagline.children)] : []),
		...(demoSample ? [element("p", ...demoSample.children)] : []),
		...(install
			? [element("pre", { ...install, properties: { className: ["language-sh"] } })]
			: []),
		...(actions.length > 0
			? [element("ul", ...actions.map((action) => element("li", action)))]
			: []),
	];
};

const element = (tagName: string, ...children: ElementContent[]): Element => ({
	type: "element",
	tagName,
	properties: {},
	children,
});

const text = (value: string): Text => ({ type: "text", value });

// A link from one Markdown copy leads to another, as a full URL, so an agent that
// follows it stays in Markdown and pasted text still knows its host.
const linkToMarkdown = (tree: Root, site: Site, pageUrl: URL) => {
	for (const link of selectAll("a[href]", tree)) {
		const url = new URL(String(link.properties.href), pageUrl);
		if (url.origin !== site.home.origin || !url.pathname.startsWith(site.home.pathname)) {
			continue;
		}
		const pathname = url.pathname.slice(site.home.pathname.length);
		link.properties.href = site.pages.has(pathname)
			? new URL(markdownPath(pathname) + url.hash, site.home).href
			: url.href;
	}
};

type Site = { home: URL; pages: Set<string> };

const toMarkdown = async (
	html: string,
	site: Site,
	pathname: string,
): Promise<string | undefined> => {
	const page = unified().use(rehypeParse).parse(html);
	const title = select("h1#_top", page);
	const content = select(".sl-markdown-content", page);
	if (!title || !content) {
		return undefined;
	}
	const tree: Root = {
		type: "root",
		children: [title, ...heroOf(page), ...(content.children as ElementContent[])],
	};
	remove(
		tree,
		(node) => node.type === "comment" || NOISE.some((selector) => matches(selector, node)),
	);
	prepareCodeBlocks(tree);
	prepareTabs(tree);
	linkToMarkdown(tree, site, new URL(pathname, site.home));
	const processor = unified()
		.use(rehypeRemark)
		.use(remarkGfm)
		.use(remarkStringify);
	return processor.stringify(await processor.run(tree));
};

/**
 * Writes `<page>.md` beside each built page, converted from the rendered HTML, so
 * MDX components arrive as their output: code from `?raw` imports, every tab's panel.
 */
export const markdownPages = (): AstroIntegration => {
	let home: URL | undefined;
	return {
		name: "markdown-pages",
		hooks: {
			"astro:config:done": ({ config }) => {
				home = config.site ? new URL(config.base.replace(/\/?$/, "/"), config.site) : undefined;
			},
			"astro:build:done": async ({ dir, pages }) => {
				if (!home) {
					throw new Error("markdownPages() needs `site` set, to write full link URLs");
				}
				const outDir = fileURLToPath(dir);
				const written = pages.filter(({ pathname }) => pathname !== "404/");
				const site: Site = { home, pages: new Set(written.map(({ pathname }) => pathname)) };
				await Promise.all(
					written.map(async ({ pathname }) => {
						const html = await readFile(`${outDir}${pathname}index.html`, "utf8");
						const markdown = await toMarkdown(html, site, pathname);
						if (markdown) {
							await writeFile(`${outDir}${markdownPath(pathname)}`, markdown);
						}
					}),
				);
			},
		},
	};
};
