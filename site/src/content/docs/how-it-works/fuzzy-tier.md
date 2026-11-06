---
title: The fuzzy tier
description: When ekrina matches a query letter by letter in pieces, which pieces it accepts, and how the density floor keeps long text from matching everything.
sidebar:
  order: 3
---

When a query doesn't appear as typed, Ekrina looks for its letters in order, in a few pieces: `vsc` matches "**V**isual **S**tudio **C**ode", and `sualdio` matches "Vi**sual** Stu**dio** Code".
These matches have `tier: "fuzzy"` and score above `SCORES.CONTAINS`, so they come after every match of the text as typed.
The fuzzy tier is always on, with no strategy knob, and it only accepts pieces that follow these rules:

- **Each piece starts a word or is at least three letters long.**
  `iuo` matches nothing in "Visual Studio Code", though its letters are all there in order, because each would be a single letter from the middle of a word.
  `ogerm` fails on "Toggle Terminal" for the same reason: `og` would be two letters from the middle of "Toggle".
- **The query's last one or two letters are exempt**, since a short tail could never be three letters long: `togrm` matches "**Tog**gle Te**rm**inal".
- **The pieces must cover at least 18% of the text they stretch across.**
  In "Open the command palette", `oc` matches "**O**pen the **c**ommand", 2 letters in a stretch of 10, but `ocp` doesn't, since "**O**pen the **c**ommand **p**" is 3 letters in 18.
  A long enough document has the letters of almost any word somewhere, and this floor is what holds false matches of absent words to 2–4% on real text.

Anything the fuzzy tier refuses either matched a better tier already or wasn't worth showing.
To keep only matches of the text as typed, filter to `score <= SCORES.CONTAINS`.

## In long text

`fuzzyMatch` runs the same tier over a whole document, where the density floor does most of the work.
It holds the junk rate for absent words to _2–4% at every measured length_ on real text, depending on the corpus and the words drawn ([the long-text table](/benchmarks/#matching-inside-long-text)).
[Match inside long text](/guides/long-text/) shows how to use it.
