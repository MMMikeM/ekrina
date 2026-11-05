import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Element, Root } from "hast";
import { select, selectAll } from "hast-util-select";
import rehypeParse from "rehype-parse";
import { unified } from "unified";
import { markdownUrl } from "../src/markdown-path.ts";

// Runs after `astro build` and reads dist/, not the build code, so it catches
// what the build actually shipped: every sitemap page carries the metadata
// search engines need and links to a Markdown copy that exists.

const dist = join(dirname(fileURLToPath(import.meta.url)), "../dist");

// Search results cut a description off at about 160 characters, and fill a
// short one with text from the page.
const DESCRIPTION = { min: 110, max: 160 };
// And a title at about 60, which src/routeData.ts can only shorten by
// dropping the site name.
const MAX_TITLE_LENGTH = 60;
const parser = unified().use(rehypeParse);

const sitemapUrls = (): URL[] =>
	[...readFileSync(join(dist, "sitemap-0.xml"), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(
		([, loc]) => new URL(loc ?? ""),
	);

const distFile = (url: URL) => join(dist, decodeURIComponent(url.pathname));

const textOf = (element: Element): string =>
	element.children.map((child) => (child.type === "text" ? child.value : "")).join("");

const attr = (page: Root, selector: string, name: string): string | undefined => {
	const value = select(selector, page)?.properties[name];
	return typeof value === "string" ? value : undefined;
};

const problemsWith = (url: URL): string[] => {
	const htmlFile = join(distFile(url), "index.html");
	if (!existsSync(htmlFile)) {
		return ["no built page"];
	}
	const page = parser.parse(readFileSync(htmlFile, "utf8"));
	const problems: string[] = [];

	const canonicals = selectAll('link[rel="canonical"]', page);
	if (canonicals.length !== 1 || canonicals[0]?.properties.href !== url.href) {
		problems.push(`expected one canonical to ${url.href}`);
	}
	const title = select("title", page);
	const titleText = title ? textOf(title).trim() : "";
	if (!titleText) {
		problems.push("empty <title>");
	} else if (titleText.length > MAX_TITLE_LENGTH) {
		problems.push(`<title> is ${titleText.length} characters, over ${MAX_TITLE_LENGTH}`);
	}
	const description = attr(page, 'meta[name="description"]', "content") ?? "";
	if (description.length < DESCRIPTION.min || description.length > DESCRIPTION.max) {
		problems.push(
			`description is ${description.length} characters, outside ${DESCRIPTION.min}-${DESCRIPTION.max}`,
		);
	}
	for (const script of selectAll('script[type="application/ld+json"]', page)) {
		try {
			JSON.parse(textOf(script));
		} catch {
			problems.push("JSON-LD that doesn't parse");
		}
	}
	const ogImage = attr(page, 'meta[property="og:image"]', "content");
	if (!ogImage || !existsSync(distFile(new URL(ogImage)))) {
		problems.push(`og:image missing or not built: ${ogImage}`);
	}

	const copy = markdownUrl(url.pathname.slice(1), new URL("/", url).href);
	if (!existsSync(distFile(new URL(copy)))) {
		problems.push(`no Markdown copy at ${copy}`);
	}
	if (attr(page, 'link[rel="alternate"][type="text/markdown"]', "href") !== copy) {
		problems.push("alternate link doesn't point at the Markdown copy");
	}
	return problems;
};

const urls = sitemapUrls();
const failures = urls.flatMap((url) =>
	problemsWith(url).map((problem) => `${url.pathname}: ${problem}`),
);
if (failures.length > 0) {
	console.error(`check-dist: ${failures.length} problem(s)\n${failures.join("\n")}`);
	process.exit(1);
}
console.log(`check-dist: ${urls.length} pages OK`);
