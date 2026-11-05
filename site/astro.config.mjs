// @ts-check
import sitemap from "@astrojs/sitemap";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightLlmsTxt from "starlight-llms-txt";
import { markdownPages } from "./src/integrations/markdown-pages.ts";
import { lastModified } from "./src/last-modified.ts";
import { project } from "./src/project.ts";

const site = "https://ekrina.thelazyweb.dev";

// Both cards show the same thing, so they share an alt; change it with them.
const socialImage = {
	url: `${site}/og.png`,
	squareUrl: `${site}/og-square.png`,
	alt: "ekrina: tiny, typed fuzzy matching. $ npm install ekrina",
};

export default defineConfig({
	site,
	integrations: [
		starlight({
			title: "ekrina",
			description:
				"Zero-dependency fuzzy matching for TypeScript: tiered scores, highlight ranges and typo rescue, in browsers, Node, Deno, Bun and edge runtimes.",
			customCss: [
				"@fontsource-variable/source-serif-4/opsz.css",
				"@fontsource-variable/source-serif-4/opsz-italic.css",
				"@fontsource/ibm-plex-mono/latin-400.css",
				"@fontsource/ibm-plex-mono/latin-500.css",
				"./src/styles/theme.css",
				"./src/styles/home.css",
				"./src/styles/reference.css",
				"./src/styles/charts.css",
				"./src/styles/segmented.css",
				"./src/styles/data-tables.css",
			],
			// One dark theme, so code reads the same in light and dark mode.
			expressiveCode: {
				themes: ["material-theme-palenight"],
				styleOverrides: {
					borderRadius: "var(--radius-panel)",
					uiFontFamily: "var(--__sl-font-mono)",
					frames: { frameBoxShadowCssValue: "none" },
				},
			},
			head: [
				{ tag: "meta", attrs: { property: "og:image", content: socialImage.url } },
				{ tag: "meta", attrs: { property: "og:image:width", content: "1200" } },
				{ tag: "meta", attrs: { property: "og:image:height", content: "630" } },
				{ tag: "meta", attrs: { property: "og:image:alt", content: socialImage.alt } },
				// Second, so a consumer that takes one image takes the wide card.
				{ tag: "meta", attrs: { property: "og:image", content: socialImage.squareUrl } },
				{ tag: "meta", attrs: { property: "og:image:width", content: "800" } },
				{ tag: "meta", attrs: { property: "og:image:height", content: "800" } },
				{ tag: "meta", attrs: { property: "og:image:alt", content: socialImage.alt } },
				{ tag: "meta", attrs: { name: "twitter:image", content: socialImage.url } },
				{ tag: "meta", attrs: { name: "twitter:image:alt", content: socialImage.alt } },
				// The sizes keep Chrome on the SVG: https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs
				{ tag: "link", attrs: { rel: "icon", href: "/favicon.ico", sizes: "32x32" } },
				{ tag: "link", attrs: { rel: "apple-touch-icon", href: "/apple-touch-icon.png" } },
				// The site has its own dark theme, so the Dark Reader extension leaves its colours alone.
				{ tag: "meta", attrs: { name: "darkreader-lock" } },
			],
			lastUpdated: true,
			routeMiddleware: "./src/routeData.ts",
			components: {
				Header: "./src/components/Header.astro",
				MarkdownContent: "./src/components/MarkdownContent.astro",
				Footer: "./src/components/Footer.astro",
				Hero: "./src/components/Hero.astro",
				SiteTitle: "./src/components/SiteTitle.astro",
			},
			social: [{ icon: "github", label: "GitHub", href: project.repositoryUrl }],
			plugins: [
				starlightLlmsTxt({
					details: [
						"`ekrina` is a zero-dependency fuzzy matcher for TypeScript and JavaScript. It reports how each match was made as a tier (exact, prefix, word boundary, multi-word, acronym, contains, fuzzy, corrected), returns highlight ranges into the caller's own string, folds diacritics, and corrects up to two typos per query. It needs nothing beyond ES2022, so it runs in browsers, Node, Deno, Bun and edge runtimes.",
						"Install with `npm install ekrina`. `createFuzzySearch(list, selectField)` builds a searcher over a list of strings or objects; `fuzzyMatch(text, query)` scores one string. Scores are lower-is-better, and `score <= SCORES.CONTAINS` means the query text appears in the field.",
						"Every page is also served as Markdown, at its URL with `.md` in place of the trailing slash (the home page at `index.md`). The key pages:",
						[
							["getting-started", "Install, search a list, highlight the matches"],
							["scores", "Score values, tiers, and what each one guarantees"],
							["compare", "Ekrina against seven libraries, and which to pick"],
							["migrate-from-microfuzz", "Migrate from @nozbe/microfuzz"],
							["migrate-from-fuse", "Migrate from Fuse.js"],
							["migrate-from-match-sorter", "Migrate from match-sorter"],
							["migrate-from-fast-fuzzy", "Migrate from fast-fuzzy"],
							["benchmarks", "Match quality (MRR by query family), junk, speed and memory against seven libraries"],
							["explorer", "Ekrina against any one library, query group by query group"],
							["libraries/ekrina", "Every Ekrina configuration the bench runs"],
							["reference", "API overview: every export in one table, generated from the source's JSDoc"],
							["reference/functions", "createFuzzySearch, fuzzyMatch and the text helpers, with signatures and examples"],
							["reference/constants", "SCORES and TYPO_PENALTY, the published score values"],
							["reference/types", "Every exported type and its fields"],
						]
							.map(([page, summary]) => `- [${page}.md](${site}/${page}.md): ${summary}`)
							.join("\n"),
					].join("\n\n"),
					// llms-small.txt leaves the API reference and the per-library pages to their .md pages.
					exclude: ["reference", "reference/**", "libraries/**"],
					// Whitespace minifying flattens tables and headings into run-on lines.
					minify: { whitespace: false },
					customSelectors: { all: [".sl-anchor-link", ".decoration"] },
				}),
			],
			sidebar: [
				{
					label: "Start here",
					items: [
						{ label: "Getting started", slug: "getting-started" },
						{ label: "Scores and tiers", slug: "scores" },
						{ label: "How it compares", slug: "compare" },
						{
							label: "Migrating",
							items: [
								{ label: "From microfuzz", slug: "migrate-from-microfuzz" },
								{ label: "From Fuse.js", slug: "migrate-from-fuse" },
								{ label: "From match-sorter", slug: "migrate-from-match-sorter" },
								{ label: "From fast-fuzzy", slug: "migrate-from-fast-fuzzy" },
							],
						},
					],
				},
				{
					label: "Benchmarks",
					items: [
						{ label: "Quality and speed", slug: "benchmarks" },
						{ label: "Compare two libraries", link: "/explorer/" },
						{ label: "By library", items: [{ autogenerate: { directory: "libraries" } }] },
					],
				},
				{ label: "Reference", items: [{ autogenerate: { directory: "reference" } }] },
			],
		}),
		markdownPages(),
		// Replaces the sitemap Starlight adds when none is configured.
		sitemap({
			serialize: (item) => {
				const lastmod = lastModified(new URL(item.url).pathname);
				return lastmod ? { ...item, lastmod } : item;
			},
		}),
	],
});
