---
title: The fuzzy tier
description: When ekrina matches a query letter by letter in pieces, which pieces it accepts, and how the density floor keeps long text from matching everything.
sidebar:
  order: 3
---

When a query doesn't appear as typed, Ekrina looks for its letters in order, in a few pieces: `vsc` matches "**V**isual **S**tudio **C**ode", and `visstud` matches "**Vis**ual **Stud**io Code".
These matches have `tier: "fuzzy"` and score above `SCORES.CONTAINS`, so they come after every match of the text as typed.
The fuzzy tier is always on, with no strategy knob, and it only accepts pieces that follow these rules:

- **A piece in a later word starts that word.**
  `prow` matches "**p**erson **row**ing boat", but not "mobile **p**hone with ar**row**", where `row` would start inside "arrow".
- **Within a word, a piece starts the word or is at least three letters long.**
  `iuo` matches nothing in "Visual Studio Code", though its letters are all there in order, because each would be a single letter from the middle of a word.
  `ogerm` fails on "Toggle Terminal" for the same reason: `og` would be two letters from the middle of "Toggle".
- **The query's last one or two letters are exempt from that length**, since a short tail could never be three letters long: `toggtrm` matches "**Togg**le **T**e**rm**inal".
- **The pieces must cover at least <!-- bench:{{ constant("18%") }} -->18%<!-- bench:end --> of the text they stretch across.**
  In "Open the command palette", `oc` matches "**O**pen the **c**ommand", 2 letters in a stretch of 10, but `ocp` doesn't, since "**O**pen the **c**ommand **p**" is 3 letters in 18.
  A long enough document has the letters of almost any word somewhere, and this floor is what holds fuzzy matches of absent words to about <!-- bench:{{ pct(div(n("longtext", "16384", "fuzzy junk"), 100)) }} -->1%<!-- bench:end --> on real text.

Anything the fuzzy tier refuses either matched a better tier already or wasn't worth showing.
To keep only matches of the text as typed, filter with `isLiteral`, or to `score <= SCORES.CONTAINS` on a field without `demoteBy`.

## In long text

`fuzzyMatch` runs the same tier over a whole document, where the density floor does most of the work.
On real text it junk-matches no absent word up to 128 characters, rising to _about <!-- bench:{{ pct(div(n("longtext", "16384", "fuzzy junk"), 100)) }} -->1%<!-- bench:end -->_ from 512 characters up, depending on the corpus and the words drawn ([the long-text table](/benchmarks/#matching-inside-long-text)).<!-- bench:{{ assert(lt(max(n("longtext", "64", "fuzzy junk"), n("longtext", "128", "fuzzy junk")), 0.05), "no absent word junk-matches up to 128 characters") }} --><!-- bench:end --><!-- bench:{{ assert(gt(n("longtext", "512", "fuzzy junk"), 0), "absent words junk-match from 512 characters up") }} --><!-- bench:end -->
[Match inside long text](/guides/long-text/) shows how to use it.
