---
title: Match inside long text
description: Use fuzzyMatch to find a query inside one document, read where it matched, and see how the density floor keeps long text from matching everything.
sidebar:
  order: 6
---

`fuzzyMatch` scores one string against a query, with no list and no searcher:

```ts
import { fuzzyMatch } from "ekrina";

const notes =
	"Release notes. The search box now forgives typos, and the settings page loads twice as fast.";

fuzzyMatch(notes, "settings page");
// { score: 0.9, tier: "boundary-cased", ranges: [[58, 70]] }

fuzzyMatch(notes, "forgives typso");
// { score: 3, tier: "corrected", corrected: "forgives typos", ranges: [[34, 47]] }

fuzzyMatch(notes, "banana"); // null
```

The ranges index the document as you passed it, so the same highlight helpers work ([Highlight matches](/guides/highlight/)).

## False matches

A long enough document holds the letters of almost any word somewhere, in order.
The fuzzy tier refuses any match whose pieces cover less than <!-- bench:{{ constant("18%") }} -->18%<!-- bench:end --> of the stretch of text they span, and that density floor is what keeps an absent word from matching a whole page ([the fuzzy tier](/how-it-works/fuzzy-tier/)).
Some false matches still get through, and they rise with the length of the document; [the long-text table](/benchmarks/#matching-inside-long-text) measures them at lengths up to 16,384 characters.

To accept only text that appears as typed, check the score: `match && match.score <= SCORES.CONTAINS`.

## One string or a list

For a list, use `createSearcher` rather than calling `fuzzyMatch` on each item.
A searcher knows how much else in the list matched, so it skips corrections once ten items match as typed, which `fuzzyMatch` can't know for a single string.
