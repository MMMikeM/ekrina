import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { withoutMarkers } from "../../bench/inject.ts";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

// The pages whose tables `vpr bench` regenerates are copied from docs/, which
// GitHub renders too, so their numbers have one source. Every other page is
// written for the site, in src/content/docs.

type Page = {
	route: string;
	source: string;
	title: string;
	description: string;
	body: string;
	order: number;
};

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const contentDir = join(repoRoot, "site/src/content/docs");
const chartsDir = join(repoRoot, "site/public/charts");
const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const repositoryUrl = pkg.repository.url.replace(/^git\+/, "").replace(/\.git$/, "");

const read = (source: string) => readFileSync(join(repoRoot, source), "utf8");

const titleOf = (markdown: string, source: string) => {
	const heading = markdown.match(/^# (.+)\n+/);
	if (!heading?.[1]) {
		throw new Error(`${source} has no H1 to title the page`);
	}
	return { title: heading[1], body: markdown.slice(heading[0].length) };
};

const docsPage = (source: string, route: string, description: string, order: number): Page => {
	const { title, body } = titleOf(read(source), source);
	return { route, source, title, description, body, order };
};

const pages: Page[] = [
	docsPage(
		"docs/benchmarks.md",
		"benchmarks",
		"How ekrina compares with Fuse.js, fuzzysort, uFuzzy and four more: MRR by query family on real corpora, junk results, speed, build time and memory.",
		0,
	),
	docsPage(
		"docs/compare.md",
		"compare",
		"Ekrina against Fuse.js, fast-fuzzy, uFuzzy, fuzzysort, microfuzz, match-sorter and fuzzy: match quality, junk, speed, size and what to pick.",
		2,
	),
	...readdirSync(join(repoRoot, "docs/libraries"))
		.filter((file) => file.endsWith(".md"))
		.map((file) => {
			const source = `docs/libraries/${file}`;
			const { title } = titleOf(read(source), source);
			return docsPage(
				source,
				`libraries/${file.replace(/\.md$/, "")}`,
				`Every ${title} configuration the ekrina bench runs, scored for match quality, junk, speed and memory on the same corpora and query families.`,
				file === "ekrina.md" ? 0 : 1,
			);
		}),
];

const routeOfDoc = new Map(pages.map((page) => [page.source, page.route]));

const resolveLink = (page: Page, target: string): string => {
	if (/^([a-z]+:|\/)/i.test(target)) {
		return target;
	}
	const [path = "", anchor] = target.split("#");
	const resolved = path ? posix.normalize(posix.join(posix.dirname(page.source), path)) : page.source;
	const hash = anchor === undefined ? "" : `#${anchor}`;
	const route = routeOfDoc.get(resolved);
	if (route) {
		return route === page.route && hash ? hash : `/${route}/${hash}`;
	}
	if (resolved.startsWith("docs/") && resolved.endsWith(".svg")) {
		return `/charts/${posix.basename(resolved)}`;
	}
	return `${repositoryUrl}/blob/main/${resolved}${hash}`;
};

const rewriteLinks = (page: Page, markdown: string) =>
	markdown
		.replace(/\]\(([^)\s]+)\)/g, (_, target: string) => `](${resolveLink(page, target)})`)
		.replace(
			/\b(src|srcset)="([^"]+)"/g,
			(_, attr: string, target: string) => `${attr}="${resolveLink(page, target)}"`,
		);

// GitHub picks a chart by the reader's OS colour scheme; the site's own theme
// toggle can disagree with it, so both images ship and charts.css shows one.
const themedCharts = (markdown: string) =>
	markdown.replace(
		/<picture>\s*<source media="\(prefers-color-scheme: dark\)" srcset="([^"]+)">\s*<img alt="([^"]*)" src="([^"]+)">\s*<\/picture>/g,
		(_, dark: string, alt: string, light: string) =>
			`<img class="chart chart-light" alt="${alt}" src="${light}">\n<img class="chart chart-dark" alt="${alt}" src="${dark}">`,
	);

const lastCommitted = (source: string) =>
	execFileSync("git", ["log", "-1", "--format=%cI", "--", source], {
		cwd: repoRoot,
		encoding: "utf8",
	}).trim();

const frontmatterOf = (page: Page) => {
	const committedAt = lastCommitted(page.source);
	return [
		"---",
		`title: ${JSON.stringify(page.title)}`,
		`description: ${JSON.stringify(page.description)}`,
		`editUrl: ${JSON.stringify(`${repositoryUrl}/edit/main/${page.source}`)}`,
		...(committedAt ? [`lastUpdated: ${committedAt}`] : []),
		"sidebar:",
		`  order: ${page.order}`,
		"---",
		"",
	].join("\n");
};

for (const synced of ["libraries", ...pages.map((page) => `${page.route}.md`)]) {
	rmSync(join(contentDir, synced), { recursive: true, force: true });
}
rmSync(chartsDir, { recursive: true, force: true });
mkdirSync(chartsDir, { recursive: true });
for (const page of pages) {
	const out = join(contentDir, `${page.route}.md`);
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(
		out,
		frontmatterOf(page) + themedCharts(rewriteLinks(page, withoutMarkers(page.body))),
	);
}
for (const chart of readdirSync(join(repoRoot, "docs")).filter((file) => file.endsWith(".svg"))) {
	copyFileSync(join(repoRoot, "docs", chart), join(chartsDir, chart));
}
console.log(`sync-docs: ${pages.length} pages`);
