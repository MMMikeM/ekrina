// The body is optional and lazy so an empty pair matches on its own instead of
// running on to the next region's end, and it may not cross another marker, so
// a region missing its end matches nothing rather than swallowing its neighbours.
const MARKER =
	/<!-- bench:([a-z0-9-]+) -->\n(?:(?:(?!<!-- bench:)[\s\S])*?\n)??<!-- bench:end -->/g;

// A value inside a sentence: both markers on one line. The id may not be `end`,
// or a block region's end marker would open an inline one.
const INLINE = /<!-- bench:(?!end -->)([a-z0-9-]+) -->(?!\n)(?:(?!<!-- bench:)[^\n])*?<!-- bench:end -->/g;

export type Injected = {
	doc: string;
	/** Marked regions whose content changed. */
	stale: string[];
	/** Generated regions with no complete marker pair in the doc. */
	unmarked: string[];
};

export const inject = (doc: string, tables: Record<string, string>): Injected => {
	const stale: string[] = [];
	const seen = new Set<string>();
	const fill =
		(inline: boolean) =>
		(match: string, id: string): string => {
			const table = tables[id];
			if (table == null) throw new Error(`a doc marks region '${id}', which nothing generates`);
			if (inline && table.includes("\n")) {
				throw new Error(`region '${id}' is marked inline but generates more than one line`);
			}
			seen.add(id);
			const replacement = inline
				? `<!-- bench:${id} -->${table}<!-- bench:end -->`
				: `<!-- bench:${id} -->\n${table}\n<!-- bench:end -->`;
			if (replacement !== match) stale.push(id);
			return replacement;
		};
	const next = doc.replace(MARKER, fill(false)).replace(INLINE, fill(true));
	const unmarked = Object.keys(tables).filter((id) => !seen.has(id));
	return { doc: next, stale, unmarked };
};
