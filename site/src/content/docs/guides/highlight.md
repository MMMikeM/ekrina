---
title: Highlight matches
description: Turn each result's ranges into highlighted text, as escaped HTML or as React elements, with accents, casing and the original string kept intact.
sidebar:
  order: 2
---

`ranges` are `[start, end]` pairs, both ends included, in ascending order, indexed into the string you passed in rather than a normalised copy of it.
Slicing your own string is the whole job, accents and casing included.

## As segments

Split the text into matched and unmatched pieces once, and render them however you like:

```ts
import type { HighlightRanges } from "ekrina";

type Segment = { text: string; match: boolean };

const segments = (text: string, ranges: HighlightRanges): Segment[] => {
	const out: Segment[] = [];
	let cursor = 0;
	for (const [start, end] of ranges) {
		if (start > cursor)
			out.push({ text: text.slice(cursor, start), match: false });
		out.push({ text: text.slice(start, end + 1), match: true });
		cursor = end + 1;
	}
	if (cursor < text.length)
		out.push({ text: text.slice(cursor), match: false });
	return out;
};

segments("Open Recent", [[5, 10]]);
// [{ text: "Open ", match: false }, { text: "Recent", match: true }]
```

## In React

React escapes text for you, so the segments go straight into elements:

```tsx
type HighlightProps = { text: string; ranges: HighlightRanges };

const Highlight = ({ text, ranges }: HighlightProps) => (
	<>
		{segments(text, ranges).map((segment, i) =>
			segment.match ? <mark key={i}>{segment.text}</mark> : segment.text,
		)}
	</>
);

<Highlight text={result.item.title} ranges={result.fields[0]?.ranges ?? []} />;
```

Create the searcher with `useMemo` on the list, and the results with a second `useMemo` on the query:

```ts
const search = useMemo(
	() => createFuzzySearch(commands, (command) => command.title),
	[commands],
);
const results = useMemo(() => search(query), [search, query]);
```

## As HTML

Escape every piece before it becomes HTML, matched or not, since the text is whatever your list holds:

```ts
const escapeHtml = (text: string): string =>
	text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

const highlightHtml = (text: string, ranges: HighlightRanges): string =>
	segments(text, ranges)
		.map((segment) =>
			segment.match
				? `<mark>${escapeHtml(segment.text)}</mark>`
				: escapeHtml(segment.text),
		)
		.join("");
```

## What gets highlighted

Every tier fills `ranges` the same way, so one helper covers them all:

- a multi-word query highlights each word where it was found: `user open` marks "Open" and "User" in "Preferences: Open User Settings";
- a fuzzy match highlights each piece: `vsc` marks the V, S and C of "Visual Studio Code";
- a corrected match highlights what it found: `recnet` marks "Recent" in "Open Recent".
