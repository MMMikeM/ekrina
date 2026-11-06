---
title: What it corrects
description: Which typing mistakes ekrina corrects, when it tries, how long a word must be for two corrections, and the limits on what it will guess.
sidebar:
  order: 2
---

Ekrina corrects a query only when the query as typed comes up short.
A correction is a guess at what was meant, so it is the fallback.

## What counts as a mistake

| Typed               | Finds                  | Mistake                                     |
| ------------------- | ---------------------- | ------------------------------------------- |
| `prefrences`        | **Preferences**        | a missing letter                            |
| `recnet`            | Open **Recent**        | two neighbouring letters swapped            |
| `kyebaord`          | **Keyboard** Shortcuts | two swaps in one word                       |
| `keybord shrotcuts` | **Keyboard Shortcuts** | a mistake in each word                      |
| `twaaain`           | Mark **Twain**         | a key held down                             |
| `hget`              | **H**u**g**u**et**te   | a word typed with letters missing           |
| `tahn`              | **Than**               | a swap in a four-letter word                |

In full:

- **Up to two mistakes:** a wrong, missing, extra or swapped character, or a space typed inside a word or left out between two.
  A single word takes two from eight letters and one from five; each word of a phrase takes one from five.
- **A word typed sparsely:** at least four of its letters, in order, starting with its first and covering at least half of it (`hget` for "Huguette").
- **A key held down:** a run of three or more of one letter counts as one mistake (`twaaain`).
- **A swap in a four-letter word**, where the fix starts a word (`tahn` for "Than").

It is not general edit distance, which keeps it small and fast.

## When it tries

- **Only while few items match as typed.**
  Corrections are tried while fewer than ten items match the query as typed, or fewer than `limit` when that is smaller.
  Past that, a correction would come after ten matches of the query as typed, so none is computed.
  So the same typo can be corrected in a short list and left alone in a long one, where enough items match it as typed.
- **Short queries only when nothing matches.**
  A query under five characters is corrected only when no item matches it at all, not even fuzzily.
  The exception is a swap in a four-letter word, which is undone when no item contains it literally, even if some match it fuzzily.
- **Never for a long word.**
  A query holding a word over 64 characters is never corrected, and any query is matched on its first 256 characters.

Separately from corrections, a one-character query matches only where it starts a word (`o` finds "Open File", not "Folder"), since one character anywhere matches most of any list.

## How a correction ranks

A corrected match scores as the tier the fixed query reached plus 2.1 for each mistake fixed, so even a corrected exact match comes after a match of the query as typed.
A word typed sparsely is a `corrected` match too, starting just above `contains` and scoring higher, so ranking lower, the more of the word it skipped: `hget` for "Huguette" scores 3.25.
Its `tier` is `"corrected"`, and `corrected` holds the fixed query, for a "Showing results for" notice ([Handle corrections](/guides/corrections/)).

## One string against a list

`fuzzyMatch` judges one string on its own, while a searcher knows how much else in the list matched.
So for a short query, or one that ten items match as typed, a list can return fewer corrections than `fuzzyMatch` returns for its items one at a time.
