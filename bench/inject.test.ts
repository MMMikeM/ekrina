import { describe, expect, it } from "vite-plus/test";
import { handTypedFigures, inject, withoutMarkers } from "./inject.ts";

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

	it("a value marked inside a sentence is replaced on its line", () => {
		const doc = [
			"At <!-- bench:size -->~7.7 kB<!-- bench:end --> gzip.",
			region("a", "old a"),
		].join("\n");
		const { doc: next, stale } = inject(doc, { size: "~8.2 kB", a: "old a" });
		expect(next).toBe(
			["At <!-- bench:size -->~8.2 kB<!-- bench:end --> gzip.", region("a", "old a")].join("\n"),
		);
		expect(stale).toEqual(["size"]);
	});

	it("text after a block region's end marker is not read as an inline region", () => {
		const doc = `${region("a", "old a")} <!-- bench:b -->x<!-- bench:end -->`;
		expect(inject(doc, { a: "old a", b: "y" }).doc).toBe(
			`${region("a", "old a")} <!-- bench:b -->y<!-- bench:end -->`,
		);
	});

	it("a multi-line value marked inline is an error", () => {
		expect(() => inject("<!-- bench:a -->x<!-- bench:end -->", { a: "| y |\n| z |" })).toThrow(
			/'a'/,
		);
	});

	it("a marked region nothing generates is an error", () => {
		expect(() => inject(region("ghost", "x"), {})).toThrow(/'ghost'/);
	});
});

describe("figures marked inline", () => {
	const figure = (source: string): string => `<${source}>`;

	it("an expression marker is filled by the figure, and a stale one is reported", () => {
		const doc = 'Takes <!-- bench:{{ cell("t", "a", "ms") }} -->0.30 ms<!-- bench:end --> each.';
		const { doc: next, stale } = inject(doc, {}, figure);
		expect(next).toBe(
			'Takes <!-- bench:{{ cell("t", "a", "ms") }} --><cell("t", "a", "ms")><!-- bench:end --> each.',
		);
		expect(stale).toEqual(['{{ cell("t", "a", "ms") }}']);
	});

	it("an MDX page marks figures with JSX comments", () => {
		const doc = 'Junk stays near {/* bench:{{ constant("1%") }} */}2%{/* bench:end */}.';
		const { doc: next } = inject(doc, {}, figure);
		expect(next).toBe(
			'Junk stays near {/* bench:{{ constant("1%") }} */}<constant("1%")>{/* bench:end */}.',
		);
	});

	it("a claim renders nothing between its markers", () => {
		const doc = 'Fastest.<!-- bench:{{ assert(lt(1, 2), "x") }} --><!-- bench:end -->';
		expect(inject(doc, {}, () => "").doc).toBe(doc);
	});

	it("without markers, a doc reads as its rendered values", () => {
		const doc = [
			'At <!-- bench:{{ cell("t", "a", "ms") }} -->0.30 ms<!-- bench:end --> each.',
			region("a", "| x |"),
			'Near {/* bench:{{ constant("1%") }} */}1%{/* bench:end */}.',
		].join("\n");
		expect(withoutMarkers(doc)).toBe(["At 0.30 ms each.", "| x |", "Near 1%."].join("\n"));
	});
});

describe("hand-typed figures", () => {
	it("a measurement in prose is reported with its line, one inside a marker is not", () => {
		const doc = [
			"Ekrina answers in 0.31 ms.",
			"Ekrina answers in <!-- bench:{{ x() }} -->0.31 ms<!-- bench:end -->.",
			region("a", "| 0.31 ms |"),
			"It scores 0.91 MRR.",
		].join("\n");
		expect(handTypedFigures(doc)).toEqual([
			{ line: 1, text: "0.31 ms" },
			{ line: 6, text: "0.91" },
		]);
	});

	it("tables, code and tag attributes are not prose", () => {
		const doc = [
			"| 0.31 ms |",
			"```",
			"took 4 ms",
			"```",
			"`0.50` in code",
			'<img alt="coverage 100%">',
			"[link](./x-100%.md)",
		].join("\n");
		expect(handTypedFigures(doc)).toEqual([]);
	});
});
