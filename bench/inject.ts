// The body is optional and lazy so an empty pair matches on its own instead of
// running on to the next region's end, and it may not cross another marker, so
// a region missing its end matches nothing rather than swallowing its neighbours.
const MARKER =
	/<!-- bench:([a-z0-9-]+) -->\n(?:(?:(?!<!-- bench:)[\s\S])*?\n)??<!-- bench:end -->/g;

// A value inside a sentence: both markers on one line. The id may not be `end`,
// or a block region's end marker would open an inline one. A `{{ … }}` id is a
// figure, computed from the artifact rather than looked up.
const INLINE =
	/<!-- bench:(?!end -->)([a-z0-9-]+|\{\{[^\n]*?\}\}) -->(?!\n)(?:(?!<!-- bench:)[^\n])*?<!-- bench:end -->/g;

// MDX has no HTML comments, so its pages mark figures with JSX comments.
const MDX_INLINE =
	/\{\/\* bench:(\{\{[^\n]*?\}\}) \*\/\}(?:(?!\{\/\* bench:)[^\n])*?\{\/\* bench:end \*\/\}/g;

export type Injected = {
	doc: string;
	/** Marked regions whose content changed. */
	stale: string[];
	/** Generated regions with no complete marker pair in the doc. */
	unmarked: string[];
};

export const inject = (
	doc: string,
	tables: Record<string, string>,
	figure: (source: string) => string = () => {
		throw new Error("this doc marks figures, and no figures were supplied");
	},
): Injected => {
	const stale: string[] = [];
	const seen = new Set<string>();
	const valueOf = (id: string): string => {
		if (id.startsWith("{{")) return figure(id.slice(2, -2).trim());
		const table = tables[id];
		if (table == null) throw new Error(`a doc marks region '${id}', which nothing generates`);
		seen.add(id);
		return table;
	};
	const fill =
		(inline: boolean) =>
		(match: string, id: string): string => {
			const value = valueOf(id);
			if (inline && value.includes("\n")) {
				throw new Error(`region '${id}' is marked inline but generates more than one line`);
			}
			const replacement = inline
				? `<!-- bench:${id} -->${value}<!-- bench:end -->`
				: `<!-- bench:${id} -->\n${value}\n<!-- bench:end -->`;
			if (replacement !== match) stale.push(id);
			return replacement;
		};
	const fillMdx = (match: string, id: string): string => {
		const replacement = `{/* bench:${id} */}${valueOf(id)}{/* bench:end */}`;
		if (replacement !== match) stale.push(id);
		return replacement;
	};
	const next = doc
		.replace(MARKER, fill(false))
		.replace(INLINE, fill(true))
		.replace(MDX_INLINE, fillMdx);
	const unmarked = Object.keys(tables).filter((id) => !seen.has(id));
	return { doc: next, stale, unmarked };
};

// The doc as a reader sees it: every marker gone, every value kept.
export const withoutMarkers = (doc: string): string =>
	doc
		.replace(/<!-- bench:(?!end -->)[^\n]*? -->\n?/g, "")
		.replace(/\n?<!-- bench:end -->/g, "")
		.replace(/\{\/\* bench:[^\n]*? \*\/\}/g, "");

// A measurement written into prose by hand goes stale on the next run, so a doc
// the pipeline manages may hold one only inside a marker.
const MEASUREMENT = /\b\d+(?:[.,]\d+)?\s?(?:ms|kB|MB|%|×)|\b[01]\.\d{2}\b/g;

export const handTypedFigures = (doc: string): Array<{ line: number; text: string }> => {
	const found: Array<{ line: number; text: string }> = [];
	let fenced = false;
	const lines = withoutRegions(doc).split("\n");
	for (const [index, line] of lines.entries()) {
		if (line.startsWith("```")) fenced = !fenced;
		if (fenced || line.startsWith("|")) continue;
		const prose = line
			.replace(/`[^`]*`/g, "")
			.replace(/<[^>]*>/g, "")
			.replace(/\]\([^)]*\)/g, "]");
		const figures = prose.match(MEASUREMENT);
		if (figures) found.push({ line: index + 1, text: figures.join(", ") });
	}
	return found;
};

// Every marker pair dropped with its contents, keeping line numbers.
const withoutRegions = (doc: string): string =>
	doc
		.replace(MARKER, (region) => "\n".repeat(region.split("\n").length - 1))
		.replace(INLINE, "")
		.replace(MDX_INLINE, "");
