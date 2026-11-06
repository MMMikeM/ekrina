import { createFuzzySearch, SCORES } from "ekrina";
import type { FuzzyResult, HighlightRanges, MatchResult } from "ekrina";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import type { Command } from "../commands";

const LIMIT = 8;

const createSearch = (commands: Command[]) => {
	const search = createFuzzySearch(commands, [
		{ selectField: (command) => command.title, acronym: true },
		{ selectField: (command) => command.keywords ?? null, demoteBy: SCORES.CONTAINS },
	]);
	search.buildIndex();
	return (query: string) => search(query, { limit: LIMIT });
};

const bestField = (result: FuzzyResult<Command>): MatchResult =>
	result.fields.find((field) => field?.score === result.score)!;

const noticeText = (query: string, results: FuzzyResult<Command>[]): string => {
	if (query === "") return "";
	const top = results[0];
	if (!top) return `No commands match “${query}”`;
	const match = bestField(top);
	return match.tier === "corrected" ? `Showing results for “${match.corrected}”` : "";
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

const Option = ({
	result,
	id,
	active,
	onChoose,
}: {
	result: FuzzyResult<Command>;
	id: string;
	active: boolean;
	onChoose: () => void;
}) => {
	const { title, category, keywords } = result.item;
	const [titleMatch, keywordMatch] = result.fields;
	return (
		<li className="option" id={id} role="option" aria-selected={active} onClick={onChoose}>
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
	const listId = `${useId()}-options`;
	const list = useRef<HTMLUListElement>(null);
	const [query, setQuery] = useState("");
	const [active, setActive] = useState(0);
	const trimmed = query.trim();
	const results = useMemo(() => (trimmed === "" ? [] : search(trimmed)), [search, trimmed]);

	useEffect(() => {
		list.current?.children[active]?.scrollIntoView({ block: "nearest" });
	}, [active, results]);

	const type = (value: string): void => {
		setQuery(value);
		setActive(0);
	};

	const choose = (index: number): void => {
		const result = results[index];
		if (!result) return;
		run(result.item);
		type("");
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
		const moves: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
		const move = moves[event.key];
		if (move && results.length > 0) {
			event.preventDefault();
			setActive((active + move + results.length) % results.length);
		} else if (event.key === "Enter") {
			event.preventDefault();
			choose(active);
		} else if (event.key === "Escape") {
			type("");
		}
	};

	return (
		<div className="palette">
			<input
				className="query"
				type="text"
				placeholder="Type a command"
				autoComplete="off"
				spellCheck={false}
				role="combobox"
				aria-label="Command"
				aria-controls={listId}
				aria-autocomplete="list"
				aria-expanded={results.length > 0}
				aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
				value={query}
				onChange={(event) => type(event.target.value)}
				onKeyDown={onKeyDown}
			/>
			<p className="notice" aria-live="polite">
				{noticeText(trimmed, results)}
			</p>
			{/* Keeps focus in the input, so typing carries on after a click. */}
			<ul
				className="options"
				id={listId}
				role="listbox"
				aria-label="Commands"
				ref={list}
				onMouseDown={(event) => event.preventDefault()}
			>
				{results.map((result, i) => (
					<Option
						key={result.item.id}
						result={result}
						id={`${listId}-${i}`}
						active={i === active}
						onChoose={() => choose(i)}
					/>
				))}
			</ul>
		</div>
	);
};
