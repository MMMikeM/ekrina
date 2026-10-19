import { describe, expect, it } from "vite-plus/test";
import { inject } from "./inject.ts";

const region = (id: string, body: string): string =>
	`<!-- bench:${id} -->\n${body}${body ? "\n" : ""}<!-- bench:end -->`;

describe("inject", () => {
	it("fills an empty marker pair in place and leaves the next region alone", () => {
		const doc = ["## A", region("a", ""), "", "## B", region("b", "old b"), ""].join("\n");
		const { doc: next, stale } = inject(doc, { a: "new a", b: "old b" });
		expect(next).toBe(
			["## A", region("a", "new a"), "", "## B", region("b", "old b"), ""].join("\n"),
		);
		expect(stale).toEqual(["a"]);
	});

	it("a region missing its end marker swallows nothing and is reported unmarked", () => {
		const doc = ["<!-- bench:a -->", "prose", region("b", "old b")].join("\n");
		const { doc: next, unmarked } = inject(doc, { a: "new a", b: "new b" });
		expect(next).toBe(["<!-- bench:a -->", "prose", region("b", "new b")].join("\n"));
		expect(unmarked).toEqual(["a"]);
	});

	it("a multi-line table is replaced whole", () => {
		const { doc } = inject(region("a", "| x |\n|---|\n| 1 |"), { a: "| y |" });
		expect(doc).toBe(region("a", "| y |"));
	});

	it("a marked region nothing generates is an error", () => {
		expect(() => inject(region("ghost", "x"), {})).toThrow(/'ghost'/);
	});
});
