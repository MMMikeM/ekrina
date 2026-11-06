import type { HastPluginDefinition } from "satteri";

type HastNode = { type: string; value?: string; children?: HastNode[] };

const QUIET_VALUES = new Set(["no", "none"]);

const textOf = (node: HastNode): string =>
	node.type === "text" ? (node.value ?? "") : (node.children ?? []).map(textOf).join("");

/** Marks table cells that say "no" or "none", so data-tables.css can mute them. */
export const quietCells: HastPluginDefinition = {
	name: "quiet-cells",
	element: {
		filter: ["td"],
		visit(node, ctx) {
			if (!QUIET_VALUES.has(textOf(node as HastNode).trim())) return;
			const classes = (node.properties?.className as string[] | undefined) ?? [];
			ctx.setProperty(node, "className", [...classes, "quiet"]);
		},
	},
};
