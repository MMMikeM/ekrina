/** Where a page's Markdown copy lives, relative to the site root: `index.md` for the home page. */
export const markdownPath = (pathname: string): string =>
	pathname === "" ? "index.md" : `${pathname.replace(/\/$/, "")}.md`;

/** The page a Markdown copy was made from: `/index.md` is `/`, `/guides/x.md` is `/guides/x/`. */
export const pagePathOf = (markdownPathname: string): string =>
	markdownPathname === "/index.md" ? "/" : `${markdownPathname.replace(/\.md$/, "")}/`;

/** The full URL of a page's Markdown copy, given the site's home page URL. */
export const markdownUrl = (id: string, home: string): string =>
	new URL(markdownPath(id), home).href;
