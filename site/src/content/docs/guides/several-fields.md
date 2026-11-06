---
title: Search several fields
description: Search an item's title, body or email at once, rank one field below another with demoteBy, and turn on acronym matching for the fields that suit it.
sidebar:
  order: 1
---

Pass an object that names each field instead of one function.
Each field is a function, or a spec when it needs options, and each result says which field matched best:

```ts
import { createSearcher, SCORES } from "ekrina";

const posts = [
	{ title: "Banana bread", body: "best baked goods" },
	{ title: "Release notes", body: "banana picker shipped" },
];

const search = createSearcher(posts, {
	title: (post) => post.title,
	body: { selectField: (post) => post.body, demoteBy: SCORES.CONTAINS },
});

search("ban");
// [
//   {
//     item: posts[0], score: 0.5, field: "title",
//     tier: "prefix", ranges: [[0, 2]], text: "Banana bread",
//     fields: { title: { tier: "prefix", ranges: [[0, 2]], text: "Banana bread" } },
//   },
//   {
//     item: posts[1], score: 2.5, field: "body",
//     tier: "prefix", ranges: [[0, 2]], text: "banana picker shipped",
//     fields: { body: { tier: "prefix", ranges: [[0, 2]], text: "banana picker shipped" } },
//   },
// ]
```

`tier`, `ranges` and `text` describe the best field's match, so highlighting `text` at `ranges` works whichever field it was.
`fields` holds every field that matched, under its name, fuzzy and corrected matches included, so you can highlight a title and a body at once; a field that didn't match is absent.
An item's `score` is its best field's, and on a tie the field whose match ends on a word boundary wins, then the one named first.

A field can't be named `selectField`, which marks a lone spec, or like an integer, since JavaScript orders those keys before the others and so would reorder the tie.

## Rank one field below another

`demoteBy` is added to every score its field produces.
Both posts above start a word with `ban`, but the body's match scores 0.5 + 2, so the title match leads.
With `demoteBy: SCORES.CONTAINS`, an exact body match ranks level with a title that merely contains the query somewhere, and every other body match comes after it.

The shift changes `score` and never `tier`, so a demoted field's prefix match still reports `tier: "prefix"`.
To keep only matches of the query as typed across demoted fields, filter by tier rather than by score, as [Keep only literal matches](/guides/literal-matches/#on-demoted-fields) shows.

## Acronyms, per field

The acronym tier matches a field's word initials, and it is off unless a field asks for it:

```ts
const people = createSearcher(staff, {
	name: { selectField: (person) => person.name, acronym: true },
	email: { selectField: (person) => person.email, demoteBy: SCORES.CONTAINS },
});

people("gh"); // "Grace Hopper", field "name", tier "acronym"
```

Turn it on for names and titles people abbreviate, and leave it off for long text, where almost any short query is somebody's initials.
A single field takes the same spec on its own, `createSearcher(countries, { selectField: (c) => c.name, acronym: true })`, and its results name no field.

## A missing field

`selectField` can return `null` for an item that has no such field, and that item is searched on its other fields.
