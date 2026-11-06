import type { ListSize, TimedCorpus } from "./explorer.ts";

export const TIMED_CORPORA: TimedCorpus[] = ["en", "native"];
export const LIST_SIZES: ListSize[] = ["10000", "100000"];
export const STRIP_LAYOUTS = ["wide", "narrow"] as const;

export type StripLayout = (typeof STRIP_LAYOUTS)[number];

/** The file a linear-scale speed chart is written to, under /explorer/linear/. */
export const linearChartName = (corpus: TimedCorpus, size: ListSize, layout: StripLayout, slug: string): string =>
	`${corpus}-${size}-${layout}-${slug}`;
