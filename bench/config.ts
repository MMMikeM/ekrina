export type Probe = {
	count: number;
	/** Ranked items, best first; null when the library returned matches it declined to rank. */
	ranked: string[] | null;
};

export type Config = {
	name: string;
	/** Result count only — the shape the runner times. */
	count: (query: string) => number;
	probe: (query: string) => Probe;
	/** Constructor time alone (plus unavoidable per-searcher preparation like uFuzzy's latinize), or null when the library has no constructor at all. */
	index: (() => number) | null;
};
