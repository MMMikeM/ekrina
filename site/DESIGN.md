---
name: Ekrina
description: Documentation site for ekrina, a zero-dependency fuzzy matcher, set as ink on paper with a highlighter and two measured series hues.
colors:
  paper: "hsl(230 20% 10%)"
  paper-light: "hsl(0 0% 100%)"
  paper-alt: "hsl(230 18% 13%)"
  paper-alt-light: "hsl(225 14% 97%)"
  line: "hsl(229 15% 22%)"
  line-light: "hsl(225 12% 88%)"
  line-strong: "hsl(229 12% 38%)"
  line-strong-light: "hsl(226 10% 72%)"
  ink: "hsl(225 25% 93%)"
  ink-light: "hsl(229 20% 14%)"
  ink-muted: "hsl(228 12% 70%)"
  ink-muted-light: "hsl(229 10% 38%)"
  pen: "hsl(226 100% 78%)"
  pen-light: "hsl(231 75% 51%)"
  button: "hsl(231 75% 55%)"
  button-light: "hsl(231 75% 51%)"
  button-text: "hsl(0 0% 100%)"
  highlight: "hsl(50 100% 62%)"
  highlight-ink: "hsl(229 20% 14%)"
  chart-ekrina: "#3987e5"
  chart-ekrina-light: "#2a78d6"
  chart-subject: "#e06a35"
  chart-subject-light: "#d4622a"
  code-night: "#292d3e"
typography:
  display:
    fontFamily: "Source Serif 4 Variable, Georgia, serif"
    fontSize: "clamp(2.5rem, 1.25rem + 4vw, 4.25rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Source Serif 4 Variable, Georgia, serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.35
  body:
    fontFamily: "Source Serif 4 Variable, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
  caption:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    fontFeature: "tnum"
rounded:
  control: "8px"
  panel: "12px"
spacing:
  3xs: "0.25rem"
  2xs: "0.5rem"
  xs: "0.75rem"
  s: "1rem"
  m: "1.5rem"
  l: "2rem"
  xl: "3rem"
  2xl: "4rem"
  3xl: "6rem"
components:
  button-primary:
    backgroundColor: "{colors.button}"
    textColor: "{colors.button-text}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "2.75rem"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "2.75rem"
  button-minimal:
    textColor: "{colors.pen}"
    typography: "{typography.label}"
  segmented-option:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    height: "2.75rem"
    padding: "0 0.75rem"
  segmented-option-checked:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  input-search:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.75rem"
    height: "2.75rem"
  tier-chip:
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.control}"
    padding: "0.0625rem 0.5rem"
  install-bar:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0.25rem 0.25rem 0.25rem 1rem"
  sidebar-current:
    backgroundColor: "{colors.highlight}"
    textColor: "{colors.highlight-ink}"
  code-block:
    backgroundColor: "{colors.code-night}"
    rounded: "{rounded.panel}"
---

# Design System: Ekrina

## Overview

**Creative North Star: "The Marked-Up Proof"**

A printed page somebody has gone over with a pen and a yellow highlighter.
The paper is plain (white in light mode, a blue-black in dark), the text is a book serif, and everything mechanical (navigation, controls, subheads, figures, code) is set in a typewriter mono, as if annotated in the margin.
The yellow does one job: it marks what matters, from "Lazy" in the hero to the page you are on in the sidebar to the matched letters in a search result.

Density is that of a reference book rather than a marketing page: one column of measured prose, tables that size to their numbers, controls drawn as thin ruled outlines.
Surfaces are flat; separation comes from hairlines and a slightly lifted alternate paper, never from cards or shadows.
Charts are allowed exactly two hues, Ekrina blue and the compared library's orange, so that every chart reads as a duel rather than a rainbow.

The North Star and the colour names below were derived from the shipped build and the explorer's direction contract; they have not yet been confirmed with the maintainer.

**Key Characteristics:**
- Serif for reading, mono for everything you operate or measure.
- One highlighter yellow, always a background with dark ink on it.
- Two chart hues, one per side of the comparison.
- Flat paper and hairline rules; no elevation at rest.
- Dark is the default theme; light overrides it token by token.

## Colors

A near-monochrome ink-and-paper palette with a blue pen, a yellow highlighter, and a blue/orange pair reserved for data.
Dark values sit on `:root`; every `-light` key is the same role under `[data-theme="light"]`, and keys without a `-light` twin hold in both modes.

### Primary
- **Ink Pen Blue** (`pen`, `pen-light`): links, accents, Starlight's text accent, the focus ring (`2px solid`, offset 2px), and the tick that replaces the copy icon. Pale periwinkle on dark paper, a saturated ultramarine on white.
- **Press Blue** (`button`, `button-light`) with **White** (`button-text`): the fill of the primary call to action only.

### Secondary
- **Highlighter Yellow** (`highlight`) with **Highlight Ink** (`highlight-ink`): `<mark>` in prose and results, the hero's highlighted word, the sidebar's current page, and the bar in the mark (logo). Identical in both modes.

### Tertiary
- **Ekrina Series Blue** (`chart-ekrina`, `chart-ekrina-light`): Ekrina's line, dot and fill in every chart, its key swatch and winning-value fill in the explorer's scoreline, and the underline of the landing page's live search input.
- **Subject Orange** (`chart-subject`, `chart-subject-light`): the library Ekrina is compared with: its chart series, key swatch, winning-value fill, the explorer's library picker underline and its checkmark.

### Neutral
- **Paper** (`paper`, `paper-light`): page, nav and sidebar background; the input fill; the stroke that separates overlapping chart dots.
- **Alternate Paper** (`paper-alt`, `paper-alt-light`): Starlight's raised greys (code titles, asides) via `--sl-color-gray-6/7`.
- **Hairline** (`line`, `line-light`): table rules, result-row dividers, sticky-bar bottom borders, chart grid rings.
- **Strong Rule** (`line-strong`, `line-strong-light`): outlines of controls: secondary buttons, chips, the segmented control, the search input, the tier chip, the picker's open list, chart major ticks.
- **Ink** (`ink`, `ink-light`): body text and headings; also the fill of a checked segment.
- **Muted Ink** (`ink-muted`, `ink-muted-light`): captions, legends, table headers, status lines, placeholders, the shell prompt.
- **Code Night** (`code-night`): the single Material Palenight code theme, used in both modes.

### Named Rules
**The Highlighter Rule.** Yellow is only ever a background, with Highlight Ink on it, in both modes. It is never text, never a border, never a chart series.

**The Two Sides Rule.** A chart or a comparison control carries at most two hues: Ekrina blue for Ekrina, Subject Orange for the other library. A control's identity underline takes the hue of the series it drives.

**The One Code Theme Rule.** Code blocks stay on Material Palenight in light mode too, so code reads the same in either theme.

## Typography

**Display Font:** Source Serif 4 Variable (with Georgia, serif), optical sizing on
**Body Font:** Source Serif 4 Variable (with Georgia, serif)
**Label/Mono Font:** IBM Plex Mono (with ui-monospace, monospace), loaded at 400 and 500 only

**Character:** A literary serif for what you read, against a typewriter mono for what you click, scan or copy; the mono makes every control and figure look like an annotation on the proof.

### Hierarchy
- **Display** (600, `--text-display`, 1.1, -0.01em): the landing hero title only.
- **Headline** (600, 2rem rising to 2.5rem from 50em, 1.1): page titles (`h1`), balanced wrap; the explorer's "Ekrina against" legend at 2rem, shrinking to 1.25rem once its bar is stuck.
- **Title** (mono 500, 1.5rem / 1.25rem / 1.125rem for h2 / h3 / h4): every Markdown subhead is mono.
- **Body** (400, 1.125rem, 1.65): prose; landing paragraphs cap at 36em, explorer notes and captions at 44em; `text-wrap: pretty` on paragraphs, list items, cells and captions.
- **Label** (mono 400, 0.875rem): buttons, segmented options, chips, legends, field labels, sidebar and header.
- **Caption** (mono 400, 0.8125rem, tabular figures): table headers, status lines, tier chips, result tags, footer.

### Named Rules
**The Margin Note Rule.** If a reader operates it or measures with it (nav, button, tab, legend, subhead, figure, code), it is mono; if they read it, it is serif.

**The Scale-Only Rule.** Every size comes from `--text-xs` through `--text-4xl` or `--text-display`; Starlight's own `--sl-text-*` are remapped onto that scale rather than used beside it.

**The Tabular Rule.** Numbers in measurement tables are mono, right-aligned, tabular and unwrapped.

## Layout

A single reading column inside Starlight's docs frame (nav, left sidebar, right table of contents).
The landing page drops the sidebar and widens its container in steps (352, 576, 672, 928, 1040, 1080px at 384 to 1440px viewports), with `--space-xl` side padding from 48rem up; its sections are separated by a hairline rule and `--space-xl` above it from 40rem.
The explorer widens the content column to 60rem and lays out by container queries on itself (`workbench`): charts swap to a narrow form under 40rem, the quality view goes two-column from 44rem, labels shorten under 34rem.

Spacing is a fixed nine-step scale from `--space-3xs` (0.25rem) to `--space-3xl` (6rem); gaps between related controls are `2xs`/`xs`, between blocks `m`/`l`.
Controls that pin (the corpus bar, the explorer's controls) stick under the nav and mobile TOC, on Paper with a Hairline bottom border.
Every interactive target is at least `--tap-target` (2.75rem) square, including the header's icon buttons on phones.

**The Tap Target Rule.** Primary controls are 2.75rem tall at minimum; the header, the copy button, the segmented control and the search input all size to it.

## Elevation & Depth

Flat.
Depth is conveyed by tone (Paper vs Alternate Paper vs Code Night) and by hairlines, and Expressive Code's frame shadow is switched off.
The one shadow in the system belongs to the explorer's custom select list, the only surface that floats over content.

### Shadow Vocabulary
- **Floating list** (`box-shadow: 0 12px 32px -12px rgb(0 0 0 / 0.35)`): the open picker of a styled `<select>`; nothing at rest.

### Named Rules
**The Flat Paper Rule.** Nothing at rest casts a shadow; a sticky bar separates itself with a bottom hairline and an opaque Paper fill, not with elevation.

## Shapes

Two radii and thin strokes.
Controls (buttons, chips, segmented control, install bar, tier chip, option rows) use the control radius (8px); framed panels (code blocks, the picker's open list) use the panel radius (12px).
Strokes are 1px, Hairline for structure and Strong Rule for anything interactive; an identity underline is 2px in a series hue.
The search input rounds only its top corners, so its 2px underline reads as a ruled line.
A dashed outline means a guess: a fuzzy or corrected tier chip.

**The Dashed Guess Rule.** Solid outlines mark what the query text literally matched; dashed outlines mark what the library inferred (fuzzy and corrected tiers).

## Components

### Buttons
Quiet, ruled, mono.
- **Shape:** gently rounded (8px), at least 2.75rem tall in the hero.
- **Primary:** Press Blue fill, white mono 500 text.
- **Secondary:** transparent with a Strong Rule outline and Ink text.
- **Minimal:** Ink Pen Blue mono text, underlined.
- **Example-query buttons (landing demo):** outlined like Secondary, 2.25rem tall, mono 0.875rem, hover tint of 8% Ink.
- **Focus:** the shared 2px Pen Blue ring at 2px offset.

### Chips
- **Feature chips (landing):** mono 0.875rem in a Strong Rule outline, 8px corners, `2xs`/`xs` padding, wrapping.
- **Tier chip (search results):** mono caption in Muted Ink, Strong Rule outline, solid for literal tiers and dashed for fuzzy or corrected.

### Segmented control
A row of mono options in one Strong Rule outline (8px), each option 2.75rem tall and divided by a Strong Rule.
The checked option inverts to an Ink fill with Paper text; focus draws the ring inset (-2px); forced colours swap in Highlight / HighlightText.
Works with no JavaScript: the corpus bar and explorer drive their panels through `:has()` on radio inputs.

### Inputs / Fields
- **Search input (landing demo):** Paper fill, Strong Rule 1px outline with a 2px Ekrina Series Blue underline, top corners 8px, mono at 1.25rem, 2.75rem tall; placeholder in Muted Ink.
- **Library picker (explorer):** a bare `<select>` set in the headline's own type, no box, a 2px Subject Orange underline and a muted chevron; where `appearance: base-select` is supported its list opens as a Paper panel (12px, Strong Rule, the floating shadow) with mono option rows, an 8% Ink hover tint and an orange checkmark.
- **Focus:** the shared Pen Blue ring.

### Navigation
- Header, sidebar, right TOC, tabs and pagination all in mono.
- The current sidebar page is a Highlighter Yellow block with Highlight Ink text.
- The site title pairs the mark (three ink strokes, the middle one on a yellow bar) with the name in mono 500 at 1.125rem, 0.875rem on phones.

### Install bar (signature)
A single 8px-rounded Hairline outline holding `$ npm install ekrina` in mono, the prompt in Muted Ink, and a 2.75rem icon button whose copy icon swaps for a Pen Blue tick drawn by a 0.3s stroke animation (skipped under reduced motion).

### Measurement tables (signature)
Tables with right-aligned columns size to their numbers, set in 0.875rem with tabular figures, Hairline row rules, mono 0.8125rem Muted Ink headers, mono unwrapped figures, a sticky first column on Paper with an inset Hairline edge, and a 5% Ink row hover tint.
Every chart has one of these as its twin on the same page.

### Scoreline (explorer)
A two-row table, Ekrina against the picked library; the better value in each column is filled with its side's hue at 24% over an inset 2px underline in the full hue, and a margin line in Muted Ink states by how much.
Picking a library fades the new scoreline and chart layers in over 220ms (`cubic-bezier(0.16, 1, 0.3, 1)`) through `@starting-style`, only after the reader changes a choice, and instantly under reduced motion.

## Do's and Don'ts

### Do:
- **Do** take every size from the `--text-*` scale and every gap from the `--space-*` scale.
- **Do** set controls, subheads, figures and navigation in IBM Plex Mono at 400 or 500, and reading text in Source Serif 4.
- **Do** use Highlighter Yellow only as a background under Highlight Ink.
- **Do** colour Ekrina's series `chart-ekrina` and the compared library's `chart-subject`, and nothing else in a chart.
- **Do** give every chart a table twin on the same page, styled as a measurement table.
- **Do** size interactive targets to `--tap-target` (2.75rem) and focus them with the shared 2px Pen Blue ring.
- **Do** mark inferred matches with a dashed outline and literal ones with a solid outline.

### Don't:
- **Don't** cast shadows on resting surfaces; separate with hairlines and tone.
- **Don't** introduce a third chart hue or a green "good" colour.
- **Don't** set yellow as text, border or stroke.
- **Don't** add a light code theme; code stays on Material Palenight in both modes.
- **Don't** add radii beyond 8px for controls and 12px for panels in site-authored components; the 4px sidebar pill is Starlight's own and stays as inherited.
