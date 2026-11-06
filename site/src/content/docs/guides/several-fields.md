---
title: Search several fields
description: Search an item's title, body or email at once, rank one field below another with demoteBy, and turn on acronym matching for the fields that suit it.
sidebar:
  order: 1
---

Pass an array of field specs instead of one function, and each result gets one entry in `fields` per spec, in the same order:

```ts
import { createFuzzySearch, SCORES } from "ekrina";

const posts = [
	{ title: "Banana bread", body: "best baked goods" },
	{ title: "Release notes", body: "banana picker shipped" },
];

const search = createFuzzySearch(posts, [
	{ selectField: (post) => post.title },
	{ selectField: (post) => post.body, demoteBy: SCORES.CONTAINS },
]);

search("ban");
// [
//   { item: posts[0], score: 0.5, fields: [{ score: 0.5, tier: "prefix", ranges: [[0, 2]] }, null] },
//   { item: posts[1], score: 2.5, fields: [null, { score: 2.5, tier: "prefix", ranges: [[0, 2]] }] },
// ]
```

`fields[i]` is `null` where that field didn't match, and an item's `score` is its best field's.

## Rank one field below another

`demoteBy` is added to every score its field produces.
Both posts above start a word with `ban`, but the body's match scores 0.5 + 2, so the title match leads.
With `demoteBy: SCORES.CONTAINS`, a body match ranks level with a title that merely contains the query somewhere.

The shift changes `score` and never `tier`, so a demoted field's prefix match still reports `tier: "prefix"`.
To keep only matches of the query as typed across demoted fields, filter by tier rather than by score, as [Keep only literal matches](/guides/literal-matches/#on-demoted-fields) shows.

## Acronyms, per field

The acronym tier matches a field's word initials, and it is off unless a field asks for it:

```ts
const people = createFuzzySearch(staff, [
	{ selectField: (person) => person.name, acronym: true },
	{ selectField: (person) => person.email, demoteBy: SCORES.CONTAINS },
]);

people("gh"); // "Grace Hopper", tier "acronym"
```

Turn it on for names and titles people abbreviate, and leave it off for long text, where almost any short query is somebody's initials.

## A missing field

`selectField` can return `null` for an item that has no such field, and that item is searched on its other fields.
