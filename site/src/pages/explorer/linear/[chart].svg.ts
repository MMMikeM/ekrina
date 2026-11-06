import type { APIRoute, GetStaticPaths } from "astro";
import data from "../../../data/explorer.json";
import { type ExplorerData, stripSvg } from "../../../explorer.ts";
import { linearChartName, LIST_SIZES, STRIP_LAYOUTS, TIMED_CORPORA } from "../../../linear-charts.ts";

const explorer = data as ExplorerData;

export const getStaticPaths = (() =>
	explorer.libraries
		.filter((library) => library.config !== "ekrina")
		.flatMap((picked) =>
			TIMED_CORPORA.flatMap((corpus) =>
				LIST_SIZES.flatMap((size) =>
					STRIP_LAYOUTS.map((layout) => ({
						params: { chart: linearChartName(corpus, size, layout, picked.slug) },
						props: { corpus, size, layout, picked },
					})),
				),
			),
		)) satisfies GetStaticPaths;

type Props = ReturnType<typeof getStaticPaths>[number]["props"];

export const GET: APIRoute<Props> = ({ props: { corpus, size, layout, picked } }) =>
	new Response(stripSvg(explorer, corpus, size, layout, { type: "linear", picked }), {
		headers: { "Content-Type": "image/svg+xml" },
	});
