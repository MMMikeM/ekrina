import { getCollection } from "astro:content";
import { defineRouteMiddleware, type StarlightRouteData } from "@astrojs/starlight/route-data";
import { markdownUrl } from "./markdown-path.ts";
import { homeUrl, project } from "./project.ts";

type Head = StarlightRouteData["head"];
type JsonLd = Record<string, unknown>;

const NOT_FOUND_ID = "404";

const author = { "@type": "Person", name: project.author };

let pageTitles: Promise<Map<string, string>> | undefined;
const pageTitle = async (id: string) => {
	pageTitles ??= getCollection("docs").then(
		(entries) => new Map(entries.map((entry) => [entry.id, entry.data.title])),
	);
	return (await pageTitles).get(id);
};

const headAttribute = (
	head: Head,
	matches: (attrs: Record<string, unknown>) => boolean,
	key: string,
) => {
	const value = head.find(({ attrs }) => attrs && matches(attrs))?.attrs?.[key];
	return typeof value === "string" ? value : undefined;
};

const setOpenGraphType = (head: Head, type: string) => {
	for (const { tag, attrs } of head) {
		if (tag === "meta" && attrs?.property === "og:type") {
			attrs.content = type;
		}
	}
};

// Search results cut a title off at about 60 characters, which " | ekrina"
// takes 9 of. Past that, the page's own title is the part worth keeping.
const MAX_TITLE_LENGTH = 60;

const fitTitle = (head: Head, pageTitle: string) => {
	const title = head.find(({ tag }) => tag === "title");
	if (title?.content && title.content.length > MAX_TITLE_LENGTH) {
		title.content = pageTitle;
	}
};

const markdownTwin = (home: string, id: string): Head[number] => ({
	tag: "link",
	attrs: { rel: "alternate", type: "text/markdown", href: markdownUrl(id, home) },
});

const jsonLd = (graph: JsonLd[]): Head[number] => ({
	tag: "script",
	attrs: { type: "application/ld+json" },
	// Head renders this as raw HTML, so a "</script>" in a title or description must not end it.
	content: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replaceAll(
		"<",
		"\\u003c",
	),
});

const websiteNode = (home: string, route: StarlightRouteData): JsonLd => ({
	"@type": "WebSite",
	"@id": `${home}#website`,
	url: home,
	name: route.siteTitle,
	description: route.entry.data.description ?? project.description,
	inLanguage: route.lang,
	author,
});

const softwareNode = (home: string): JsonLd => ({
	"@type": "SoftwareSourceCode",
	"@id": `${home}#software`,
	name: project.name,
	description: project.description,
	url: home,
	codeRepository: project.repositoryUrl,
	programmingLanguage: "TypeScript",
	license: project.licenseUrl,
	keywords: project.keywords.join(", "),
	author,
	sameAs: [project.npmUrl, project.repositoryUrl],
});

const articleNode = (home: string, url: string, route: StarlightRouteData): JsonLd => ({
	"@type": "TechArticle",
	"@id": `${url}#article`,
	headline: route.entry.data.title,
	description: route.entry.data.description,
	url,
	mainEntityOfPage: url,
	inLanguage: route.lang,
	image: headAttribute(route.head, (attrs) => attrs.property === "og:image", "content"),
	author,
	...(route.lastUpdated ? { dateModified: route.lastUpdated.toISOString() } : {}),
	isPartOf: { "@type": "WebSite", "@id": `${home}#website`, url: home, name: route.siteTitle },
	about: {
		"@type": "SoftwareSourceCode",
		"@id": `${home}#software`,
		name: project.name,
		codeRepository: project.repositoryUrl,
	},
});

/** Crumbs for each parent section that has a page of its own; `guides/` has none, so it's skipped. */
const breadcrumbNode = async (
	home: string,
	url: string,
	route: StarlightRouteData,
): Promise<JsonLd> => {
	const segments = route.id.split("/").slice(0, -1);
	const sections = await Promise.all(
		segments.map(async (_, index) => {
			const id = segments.slice(0, index + 1).join("/");
			const name = await pageTitle(id);
			return name === undefined ? undefined : { name, url: new URL(`${id}/`, home).href };
		}),
	);
	const crumbs = [
		{ name: route.siteTitle, url: home },
		...sections.filter((section) => section !== undefined),
		{ name: route.entry.data.title, url },
	];
	return {
		"@type": "BreadcrumbList",
		itemListElement: crumbs.map((crumb, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: crumb.name,
			item: crumb.url,
		})),
	};
};

export const onRequest = defineRouteMiddleware(async (context) => {
	const route = context.locals.starlightRoute;
	if (!context.site || route.entry.id === NOT_FOUND_ID) {
		return;
	}
	const home = homeUrl(context.site);
	fitTitle(route.head, route.entry.data.title);
	if (route.id === "") {
		setOpenGraphType(route.head, "website");
		route.head.push(
			markdownTwin(home, route.id),
			jsonLd([websiteNode(home, route), softwareNode(home)]),
		);
		return;
	}
	const url =
		headAttribute(route.head, (attrs) => attrs.rel === "canonical", "href") ??
		new URL(context.url.pathname, context.site).href;
	route.head.push(
		markdownTwin(home, route.id),
		jsonLd([articleNode(home, url, route), await breadcrumbNode(home, url, route)]),
	);
});
