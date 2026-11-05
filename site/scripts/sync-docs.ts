import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

// Every page but the API reference is copied from README.md and docs/, which
// GitHub and npm render too, and whose numbers `pnpm bench` regenerates. The
// site keeps no prose of its own that could drift from them.

type Page = {
	route: string;
	source: string;
	title: string;
	description: string;
	body: string;
	order: number;
	frontmatter?: string[];
};

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const contentDir = join(repoRoot, "site/src/content/docs");
const chartsDir = join(repoRoot, "site/public/charts");
const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const repositoryUrl = pkg.repository.url.replace(/^git\+/, "").replace(/\.git$/, "");

const read = (source: string) => readFileSync(join(repoRoot, source), "utf8");

// GitHub's heading anchors, which the sources' own links use.
const slug = (heading: string) =>
	heading
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s_-]/gu, "")
		.trim()
		.replace(/\s/g, "-");

const headingsOf = (markdown: string) =>
	[...markdown.matchAll(/^#{2,6} (.+)$/gm)].map(([, heading = ""]) => slug(heading));

const readme = read("README.md");
const [preamble = "", ...readmeSections] = readme.split(/^(?=## )/m);
const readmeSection = (heading: string) => {
	const section = readmeSections.find((candidate) => candidate.startsWith(`## ${heading}\n`));
	if (!section) {
		throw new Error(`README.md has no "## ${heading}" section`);
	}
	return section;
};
const fromReadme = (headings: string[]) => headings.map(readmeSection).join("");

const tagline = preamble.match(/^\*\*(.+)\*\*$/m)?.[1];
if (!tagline) {
	throw new Error("README.md has no bold tagline under its title");
}
const introduction = preamble
	.replace(/^# .+\n/, "")
	.replace(/^\*\*.+\*\*\n/m, "")
	.replace(/<p>[\s\S]*?<\/p>\n/g, "")
	.trim();

const titleOf = (markdown: string, source: string) => {
	const heading = markdown.match(/^# (.+)\n+/);
	if (!heading?.[1]) {
		throw new Error(`${source} has no H1 to title the page`);
	}
	return { title: heading[1], body: markdown.slice(heading[0].length) };
};

const docsPage = (source: string, route: string, description: (title: string) => string, order: number): Page => {
	const { title, body } = titleOf(read(source), source);
	return { route, source, title, description: description(title), body, order };
};

const pages: Page[] = [
	{
		route: "index",
		source: "README.md",
		title: "Ekrina",
		description:
			"Tiny, typed fuzzy matching for TypeScript: ranked tiers, highlight ranges and typo correction, with zero dependencies, on any ES2022 runtime.",
		body: `${introduction}\n`,
		order: 0,
		frontmatter: [
			"template: splash",
			"hero:",
			`  tagline: ${JSON.stringify(tagline)}`,
			"  actions:",
			"    - text: Get started",
			"      link: /getting-started/",
			"      icon: right-arrow",
			"      variant: primary",
			"    - text: Benchmarks",
			"      link: /benchmarks/",
			"      variant: secondary",
		],
	},
	{
		route: "getting-started",
		source: "README.md",
		title: "Getting started",
		description:
			"Install ekrina, search a list of strings or objects, highlight each match from its ranges, and score a single string with fuzzyMatch.",
		body: fromReadme(["Install", "Usage", "Where it fits"]),
		order: 0,
	},
	{
		route: "scores",
		source: "README.md",
		title: "Scores and tiers",
		description:
			"What each ekrina score and tier means, why lower is better, how corrected matches are priced, and how to keep only literal matches.",
		body: fromReadme(["Scores and tiers", "The fuzzy tier"]).replace(/^## Scores and tiers\n+/, ""),
		order: 1,
	},
	{
		route: "compare",
		source: "README.md",
		title: "How it compares",
		description:
			"Ekrina against Fuse.js, fast-fuzzy, uFuzzy, fuzzysort, microfuzz, match-sorter and fuzzy: match quality, junk, speed and bundle size.",
		body: fromReadme(["How it compares"]).replace(/^## How it compares\n+/, ""),
		order: 2,
	},
	docsPage(
		"docs/benchmarks.md",
		"benchmarks",
		() =>
			"How ekrina compares with Fuse.js, fuzzysort, uFuzzy and four more: MRR by query family on real corpora, junk results, speed, build time and memory.",
		0,
	),
	...readdirSync(join(repoRoot, "docs/migrating"))
		.filter((file) => file.endsWith(".md"))
		.map((file) =>
			docsPage(
				`docs/migrating/${file}`,
				`migrate-from-${file.replace(/\.md$/, "")}`,
				(title) =>
					`${title} to ekrina: the constructor and result diff, how each option maps or why it has no equivalent, and what behaves differently.`,
				4,
			),
		),
	...readdirSync(join(repoRoot, "docs/libraries"))
		.filter((file) => file.endsWith(".md"))
		.map((file) =>
			docsPage(
				`docs/libraries/${file}`,
				`libraries/${file.replace(/\.md$/, "")}`,
				(title) =>
					`Every ${title} configuration the ekrina bench runs, scored for match quality, junk, speed and memory on the same corpora and query families.`,
				file === "ekrina.md" ? 0 : 1,
			),
		),
];

const routeOfDoc = new Map(
	pages.filter((page) => page.source !== "README.md").map((page) => [page.source, page.route]),
);
const routeOfReadmeAnchor = new Map(
	pages
		.filter((page) => page.source === "README.md")
		.flatMap((page) => headingsOf(page.body).map((anchor) => [anchor, page.route] as const)),
);

const pageUrl = (route: string) => (route === "index" ? "/" : `/${route}/`);

const resolveLink = (page: Page, target: string): string => {
	if (/^([a-z]+:|\/)/i.test(target)) {
		return target;
	}
	const [path = "", anchor] = target.split("#");
	const resolved = path ? posix.normalize(posix.join(posix.dirname(page.source), path)) : page.source;
	const hash = anchor === undefined ? "" : `#${anchor}`;
	if (resolved === "README.md") {
		const route = anchor === undefined ? "index" : routeOfReadmeAnchor.get(anchor);
		if (route === page.route && anchor !== undefined) {
			return hash;
		}
		if (route) {
			return `${pageUrl(route)}${hash}`;
		}
	}
	const route = routeOfDoc.get(resolved);
	if (route) {
		return route === page.route && hash ? hash : `${pageUrl(route)}${hash}`;
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
		...(page.frontmatter ?? []),
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
	writeFileSync(out, frontmatterOf(page) + themedCharts(rewriteLinks(page, page.body)));
}
for (const chart of readdirSync(join(repoRoot, "docs")).filter((file) => file.endsWith(".svg"))) {
	copyFileSync(join(repoRoot, "docs", chart), join(chartsDir, chart));
}
console.log(`sync-docs: ${pages.length} pages`);
