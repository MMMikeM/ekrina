---
title: Migrate from match-sorter
description: "Migrate from match-sorter to ekrina: the constructor and result diff, how each option maps or why it has none, and what behaves differently."
sidebar:
  order: 22
---

match-sorter ranks with a ladder of tiers, and Ekrina's ladder is the same idea, so the rankings carry over almost one for one.
The change is building a searcher once instead of sorting the whole list on every call.

```diff
- import { matchSorter, rankings } from "match-sorter";
+ import { createSearcher, SCORES } from "ekrina";

  // build once, outside the keystroke handler or the render
+ const search = createSearcher(items, (item) => item.title);

- const results = matchSorter(items, query, { keys: ["title"] });
+ const results = search(query).map((r) => r.item);

  // several keys, the body capped at a contains match
- matchSorter(items, query, {
-   keys: ["title", { key: "body", maxRanking: rankings.CONTAINS }],
- });
+ const search = createSearcher(items, {
+   title: (item) => item.title,
+   body: { selectField: (item) => item.body, demoteBy: SCORES.CONTAINS },
+ });

  // close matches only
- matchSorter(items, query, { keys: ["title"], threshold: rankings.CONTAINS });
+ search(query).filter((r) => r.score <= SCORES.CONTAINS).map((r) => r.item);
```

The rankings and the tiers they become:

| match-sorter           | Ekrina                                                 |
| ---------------------- | ------------------------------------------------------ |
| `CASE_SENSITIVE_EQUAL` | `exact`                                                |
| `EQUAL`                | `normalised-exact`                                     |
| `STARTS_WITH`          | `prefix`                                               |
| `WORD_STARTS_WITH`     | `boundary-cased`, `boundary`                           |
| none                   | `multi-word`: every query word starts a word, any order |
| `CONTAINS`             | `contains`                                             |
| `ACRONYM`              | `acronym`, with `acronym: true` on the field           |
| `MATCHES`              | `fuzzy`                                                |
| none                   | `corrected`: a typo fixed                              |

Behavioural differences:

- **Lower scores are better.**
  A ranking is a number that rises as the match gets closer; Ekrina's `score` falls, from `SCORES.EXACT` (0) to `SCORES.CONTAINS` (2) for every match of the text as typed ([Scores and tiers](/how-it-works/scores/)).
- **Acronyms are opt-in, and rank above `contains`.**
  match-sorter tries `ACRONYM` on every key and ranks it below `CONTAINS`.
  Ekrina tries it only on a field with `acronym: true`, and ranks it just above `contains`, at 1.8.
  Without it, `vsc` still finds "Visual Studio Code", as a `fuzzy` match.
- **`maxRanking` becomes `demoteBy`.**
  Both keep a field's best hit from outranking the others.
  `demoteBy` is added to every score the field produces, so with `demoteBy: SCORES.CONTAINS` an exact body hit ranks level with a title that contains the query.
  There is no `minRanking`, and no per-key `threshold`.
- **Typos are corrected.**
  `termimal` finds nothing in match-sorter; Ekrina finds "Toggle Terminal", with `tier: "corrected"` and `corrected: "terminal"`.
- **Words match in any order.**
  match-sorter matches the query as one string, so `code visual` finds nothing; Ekrina finds "Visual Studio Code".
- **Results carry ranges.**
  match-sorter returns the items alone.
  Ekrina returns `{ item, score, tier, ranges, text }`, with `ranges` ready to highlight in `text`.
- **The searcher remembers the last query.**
  A query that extends the previous one usually starts from the items that could have matched the previous one ([which keystrokes rescan](/guides/search-as-you-type/#which-keystrokes-rescan)), which is what search-as-you-type sends, so build the searcher once per list rather than once per keystroke.
- **No `baseSort` or `sorter`.**
  Ties go to a match that ends on a word boundary, then to list order.
- **Keys are functions.**
  `"author.name"` becomes `(item) => item.author.name`, and an array key such as `"tags"` becomes `(item) => item.tags.join(" ")`.
  A list of strings needs no key at all: `createSearcher(strings)`.
- **Accents fold either way, with no `keepDiacritics`.**
