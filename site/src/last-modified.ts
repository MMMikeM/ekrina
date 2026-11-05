import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const contentDir = fileURLToPath(new URL("content/docs/", import.meta.url));

let inGitCheckout: boolean | undefined;

/** A source tarball has no git checkout; the build then warns once and skips lastmod. */
const isGitCheckout = (): boolean => {
	if (inGitCheckout === undefined) {
		try {
			execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { stdio: "ignore" });
			inGitCheckout = true;
		} catch {
			inGitCheckout = false;
			console.warn("last-modified: no git checkout, so the sitemap goes without lastmod");
		}
	}
	return inGitCheckout;
};

/**
 * When git last changed a page's source file, the same commit Starlight's "Last updated" shows.
 * A page synced from docs/ declares its source's date as `lastUpdated`, since its own
 * file is untracked. Undefined for a generated page, such as the API reference, or
 * when the build has no git checkout to read.
 */
export const lastModified = (pathname: string): string | undefined => {
	const slug = pathname.replace(/^\/|\/$/g, "") || "index";
	const source = [".md", ".mdx"].map((ext) => `${contentDir}${slug}${ext}`).find(existsSync);
	if (!source) {
		return undefined;
	}
	const declared = readFileSync(source, "utf8").match(/^lastUpdated: (\S+)$/m)?.[1];
	// A generated page turns Starlight's date off with `lastUpdated: false`.
	if (declared === "false") {
		return undefined;
	}
	if (declared || !isGitCheckout()) {
		return declared;
	}
	const committedAt = execFileSync("git", ["log", "-1", "--format=%cI", "--", source], {
		encoding: "utf8",
	}).trim();
	return committedAt || undefined;
};
