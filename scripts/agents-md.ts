import type { Plugin } from "vite-plus";
import { markdownUrl } from "../site/src/markdown-path.ts";

const HOME = "https://ekrina.thelazyweb.dev/";
const RULES_PAGE = "site/src/content/docs/ai-agents.md";

type PackageJson = {
	name: string;
	version: string;
	description: string;
};

/**
 * Root-absolute links get the site's host, since the file is read far from it.
 * A page's (ending in `/`) points at its Markdown copy instead.
 */
const toAbsoluteLinks = (markdown: string): string =>
	markdown.replaceAll(
		/\]\((\/[^)\s#]*)(#[^)\s]*)?(\s+"[^"]*")?\)/g,
		(_, path: string, hash = "", title = "") =>
			`](${path.endsWith("/") ? markdownUrl(path.slice(1), HOME) : new URL(path, HOME).href}${hash}${title})`,
	);

/** The page from its first `##` heading on; the intro above it addresses readers of the site. */
const rulesFrom = (page: string): string => {
	const firstSection = page.indexOf("\n## ");
	if (firstSection === -1) {
		throw new Error(`${RULES_PAGE} has no ## section to ship`);
	}
	return toAbsoluteLinks(page.slice(firstSection + 1).trim());
};

const codeList = (names: string[]): string => names.map((name) => `\`${name}\``).join(", ");

/** The one entry point's exports, read from the built ESM files; the CJS build exports the same names. */
const exportsSection = (pkg: PackageJson, exportsByFile: Map<string, string[]>): string => {
	const values = exportsByFile.get("index.mjs");
	const declared = exportsByFile.get("index.d.mts");
	if (!values || !declared) {
		throw new Error("the ESM build emitted no index.mjs and index.d.mts to list exports from");
	}
	// The declaration file lists types as well as values; what isn't a value is a type.
	const types = declared.filter((name) => !values.includes(name));
	return [
		"## Exports",
		`\`${pkg.name}\` has one entry point, and \`import\` and \`require\` get the same names from it.`,
		[
			`- Functions and constants: ${codeList(values)}`,
			`- Types: ${codeList(types)}`,
			`- [API reference](${markdownUrl("reference/", HOME)})`,
		].join("\n"),
	].join("\n\n");
};

/** Emits `AGENTS.md` next to the built entry point. */
export const agentsMd = (): Plugin => ({
	name: "ekrina:agents-md",
	async generateBundle(options, bundle) {
		// The CJS build runs this hook too, over its own files, and one AGENTS.md covers both.
		if (options.format !== "es") {
			return;
		}
		const pkg = JSON.parse(
			await this.fs.readFile("package.json", { encoding: "utf8" }),
		) as PackageJson;
		const exportsByFile = new Map(
			Object.values(bundle).flatMap((output) =>
				output.type === "chunk" && output.isEntry
					? [[output.fileName, output.exports.toSorted()] as const]
					: [],
			),
		);
		const marker = pkg.name;
		const source = [
			`<!-- ${marker} START -->`,
			`# ${pkg.name} ${pkg.version}`,
			pkg.description,
			exportsSection(pkg, exportsByFile),
			rulesFrom(await this.fs.readFile(RULES_PAGE, { encoding: "utf8" })),
			`<!-- ${marker} END -->`,
		].join("\n\n");
		this.emitFile({ type: "asset", fileName: "AGENTS.md", source: `${source}\n` });
	},
});
