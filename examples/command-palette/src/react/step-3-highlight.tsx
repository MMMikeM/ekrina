import { createSearcher, SCORES } from "ekrina";
import type { SearchResult, HighlightRanges } from "ekrina";
import { type ReactNode, useMemo, useState } from "react";
import type { Command } from "../commands";

const LIMIT = 8;

const createSearch = (commands: Command[]) => {
	const search = createSearcher(commands, [
		{ selectField: (command) => command.title, acronym: true },
		{ selectField: (command) => command.keywords ?? null, demoteBy: SCORES.CONTAINS },
	]);
	search.buildIndex();
	return (query: string) => search(query, { limit: LIMIT });
};

const highlighted = (text: string, ranges: HighlightRanges): ReactNode[] => {
	const nodes: ReactNode[] = [];
	let cursor = 0;
	for (const [start, end] of ranges) {
		if (start > cursor) nodes.push(text.slice(cursor, start));
		nodes.push(<mark key={start}>{text.slice(start, end + 1)}</mark>);
		cursor = end + 1;
	}
	if (cursor < text.length) nodes.push(text.slice(cursor));
	return nodes;
};

const Option = ({ result, onChoose }: { result: SearchResult<Command>; onChoose: () => void }) => {
	const { title, category, keywords } = result.item;
	const [titleMatch, keywordMatch] = result.fields;
	return (
		<li className="option" onClick={onChoose}>
			<span className="text">
				<span className="title">{highlighted(title, titleMatch?.ranges ?? [])}</span>
				{!titleMatch && keywordMatch && keywords && (
					<span className="keywords">{highlighted(keywords, keywordMatch.ranges)}</span>
				)}
			</span>
			<span className="category">{category}</span>
		</li>
	);
};

export const CommandPalette = ({
	commands,
	run,
}: {
	commands: Command[];
	run: (command: Command) => void;
}) => {
	const search = useMemo(() => createSearch(commands), [commands]);
	const [query, setQuery] = useState("");
	const trimmed = query.trim();
	const results = useMemo(() => (trimmed === "" ? [] : search(trimmed)), [search, trimmed]);

	const choose = (index: number): void => {
		const result = results[index];
		if (!result) return;
		run(result.item);
		setQuery("");
	};

	return (
		<div className="palette">
			<input
				className="query"
				type="text"
				placeholder="Type a command"
				autoComplete="off"
				spellCheck={false}
				aria-label="Command"
				value={query}
				onChange={(event) => setQuery(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") choose(0);
				}}
			/>
			<ul className="options" aria-label="Commands">
				{results.map((result, i) => (
					<Option key={result.item.id} result={result} onChoose={() => choose(i)} />
				))}
			</ul>
		</div>
	);
};
