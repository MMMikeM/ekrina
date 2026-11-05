import { markdownPath, pagePathOf } from "../src/markdown-path.ts";

type DataPoint = { indexes: string[]; blobs: string[]; doubles: number[] };

type Env = {
	ASSETS: { fetch: (request: Request) => Promise<Response> };
	VIEWS: { writeDataPoint: (point: DataPoint) => void };
};

/** How a request was answered: a page as HTML, a page negotiated to Markdown, or a `.md`/`.txt` file. */
type Served = "html" | "markdown" | "file";

/** The `q` an `Accept` header gives a media type: 1 when listed bare, 0 when absent. */
const quality = (accept: string, mediaType: string): number => {
	for (const range of accept.split(",")) {
		const [name = "", ...params] = range.split(";").map((part) => part.trim());
		if (name.toLowerCase() === mediaType) {
			const q = params.find((param) => param.startsWith("q="));
			return q ? Number(q.slice(2)) : 1;
		}
	}
	return 0;
};

const prefersMarkdown = (accept: string | null): boolean => {
	if (!accept) {
		return false;
	}
	const markdown = quality(accept, "text/markdown");
	return markdown > 0 && markdown >= quality(accept, "text/html");
};

const withHeaders = (response: Response, headers: Record<string, string>): Response => {
	const copy = new Response(response.body, response);
	for (const [name, value] of Object.entries(headers)) {
		copy.headers.set(name, value);
	}
	return copy;
};

const isAgentFile = (pathname: string) => pathname.endsWith(".md") || pathname.endsWith(".txt");

// The asset server sends these without a charset, and with `nosniff` a browser
// then reads their UTF-8 as Windows-1252. A Markdown copy also names its page
// as canonical, so search engines index the page rather than the copy.
const agentFileHeaders = (url: URL): Record<string, string> =>
	url.pathname.endsWith(".md")
		? {
				"Content-Type": "text/markdown; charset=utf-8",
				Link: `<${new URL(pagePathOf(url.pathname), url).href}>; rel="canonical"`,
			}
		: { "Content-Type": "text/plain; charset=utf-8" };

const route = async (
	request: Request,
	env: Env,
	url: URL,
): Promise<{ response: Response; served?: Served }> => {
	// Every page URL ends in a slash; anything else is an asset or a redirect to a page.
	if (!url.pathname.endsWith("/")) {
		const response = await env.ASSETS.fetch(request);
		// The asset server adds a page's trailing slash with a temporary 307; a
		// 301 tells search engines the slashed URL is the one to index.
		const location = response.status === 307 && response.headers.get("location");
		if (location) {
			return { response: Response.redirect(new URL(location, url).href, 301) };
		}
		if (!isAgentFile(url.pathname)) {
			return { response };
		}
		if (!response.ok && response.status !== 304) {
			return { response, served: "file" };
		}
		return { response: withHeaders(response, agentFileHeaders(url)), served: "file" };
	}
	const markdownUrl = new URL(`/${markdownPath(url.pathname.slice(1))}`, url);

	if (prefersMarkdown(request.headers.get("accept"))) {
		const markdown = await env.ASSETS.fetch(new Request(markdownUrl, request));
		// A 304 confirms the Markdown copy the agent already holds.
		if (markdown.ok || markdown.status === 304) {
			const response = withHeaders(markdown, {
				"Content-Type": "text/markdown; charset=utf-8",
				Vary: "Accept",
			});
			return { response, served: "markdown" };
		}
	}

	const page = await env.ASSETS.fetch(request);
	const isHtml = page.headers.get("content-type")?.startsWith("text/html");
	if (page.status !== 304 && !(page.ok && isHtml)) {
		return { response: page, served: "html" };
	}
	const response = withHeaders(page, {
		Link: `<${markdownUrl.pathname}>; rel="alternate"; type="text/markdown"`,
		Vary: "Accept",
	});
	return { response, served: "html" };
};

// Analytics Engine caps a data point's blobs at 16 KB, and these headers are
// whatever the client sent.
const MAX_HEADER_LENGTH = 1024;
const headerOf = (request: Request, name: string) =>
	(request.headers.get(name) ?? "").slice(0, MAX_HEADER_LENGTH);

// Server-side, so pages ship no analytics script. Bots stay in: which agents
// read the Markdown is the question, so queries filter by user agent instead.
// Errors aren't views, which keeps out probes for /wp-admin/ and the like.
const logView = (env: Env, request: Request, url: URL, response: Response, served: Served) => {
	if (request.method !== "GET" || response.status >= 400) {
		return;
	}
	const { cf } = request as Request & { cf?: { country?: string } };
	try {
		env.VIEWS.writeDataPoint({
			indexes: [served],
			blobs: [
				url.pathname,
				headerOf(request, "user-agent"),
				headerOf(request, "accept"),
				headerOf(request, "referer"),
				cf?.country ?? "",
			],
			doubles: [response.status],
		});
	} catch {
		// A view that can't be recorded must not cost the visitor the page.
	}
};

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const { response, served } = await route(request, env, url);
		if (served) {
			logView(env, request, url, response, served);
		}
		return response;
	},
};
