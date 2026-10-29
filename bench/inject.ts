// The body is optional and lazy so an empty pair matches on its own instead of
// running on to the next region's end, and it may not cross another marker, so
// a region missing its end matches nothing rather than swallowing its neighbours.
const MARKER =
	/<!-- bench:([a-z0-9-]+) -->\n(?:(?:(?!<!-- bench:)[\s\S])*?\n)??<!-- bench:end -->/g;

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
	const next = doc.replace(MARKER, (match, id: string) => {
		const table = tables[id];
		if (table == null)
			throw new Error(`a doc marks region '${id}', which nothing generates`);
		seen.add(id);
		const replacement = `<!-- bench:${id} -->\n${table}\n<!-- bench:end -->`;
		if (replacement !== match) stale.push(id);
		return replacement;
	});
	const unmarked = Object.keys(tables).filter((id) => !seen.has(id));
	return { doc: next, stale, unmarked };
};
