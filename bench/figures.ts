import type { Artifact } from "./artifact.ts";
import { headlineMrr } from "./mrr.ts";
import { meanOneShotOf } from "./tables.ts";

// A figure marker's id is one call, `name(arg, …)`, whose arguments are string
// or number literals or further calls. It is parsed, never passed to eval: a
// doc is data, and only the functions below can run.
type Value = number | string | boolean;
type Call = { name: string; args: Expr[] };
type Expr = Value | Call;

const TOKEN = /\s*(?:"((?:[^"\\]|\\.)*)"|(-?\d+(?:\.\d+)?)|([A-Za-z_]\w*)|([(),]))/y;

const tokenise = (source: string): Array<{ kind: "str" | "num" | "name" | "punct"; text: string }> => {
	const tokens: Array<{ kind: "str" | "num" | "name" | "punct"; text: string }> = [];
	TOKEN.lastIndex = 0;
	while (TOKEN.lastIndex < source.length) {
		if (/^\s*$/.test(source.slice(TOKEN.lastIndex))) break;
		const at = TOKEN.lastIndex;
		const match = TOKEN.exec(source);
		if (match === null) throw new Error(`cannot read figure at '${source.slice(at)}'`);
		const [, str, num, name, punct] = match;
		if (str !== undefined) tokens.push({ kind: "str", text: str.replace(/\\(.)/g, "$1") });
		else if (num !== undefined) tokens.push({ kind: "num", text: num });
		else if (name !== undefined) tokens.push({ kind: "name", text: name });
		else tokens.push({ kind: "punct", text: punct });
	}
	return tokens;
};

export const parseFigure = (source: string): Call => {
	const tokens = tokenise(source);
	let at = 0;
	const expect = (text: string): void => {
		if (tokens[at]?.text !== text) throw new Error(`expected '${text}' in figure '${source}'`);
		at++;
	};
	const expr = (): Expr => {
		const token = tokens[at++];
		if (token === undefined) throw new Error(`figure '${source}' ends early`);
		if (token.kind === "str") return token.text;
		if (token.kind === "num") return Number(token.text);
		if (token.kind !== "name") throw new Error(`unexpected '${token.text}' in figure '${source}'`);
		expect("(");
		const args: Expr[] = [];
		while (tokens[at]?.text !== ")") {
			args.push(expr());
			if (tokens[at]?.text === ",") at++;
		}
		expect(")");
		return { name: token.text, args };
	};
	const call = expr();
	if (at !== tokens.length || typeof call !== "object") {
		throw new Error(`a figure is one call, got '${source}'`);
	}
	return call;
};

// A rendered table's cell by row label and column header, so a figure quoted in
// prose is exactly the string the table beside it shows.
const tableCell = (table: string, row: string, column: string): string => {
	const lines = table.split("\n").filter((line) => line.startsWith("|"));
	const cellsOf = (line: string): string[] =>
		line
			.slice(1, -1)
			.split("|")
			.map((cell) => cell.trim());
	const header = cellsOf(lines[0] ?? "");
	const col = header.indexOf(column);
	if (col === -1) throw new Error(`no column '${column}' in [${header.join(", ")}]`);
	const label = (cell: string): string => cell.replace(/^\*\*|\*\*$|^_|_$/g, "");
	const found = lines.slice(2).map(cellsOf).find((cells) => label(cells[0] ?? "") === row);
	if (found === undefined) throw new Error(`no row '${row}'`);
	return label(found[col] ?? "");
};

const numberIn = (text: string): number => {
	const value = Number.parseFloat(text.replace(/[~*,]/g, ""));
	if (Number.isNaN(value)) throw new Error(`'${text}' holds no number`);
	return value;
};

const FRACTIONS = [
	"",
	"",
	"a half",
	"a third",
	"a quarter",
	"a fifth",
	"a sixth",
	"a seventh",
	"an eighth",
	"a ninth",
	"a tenth",
	"an eleventh",
	"a twelfth",
];

const num = (v: Value): number => {
	if (typeof v !== "number") throw new Error(`expected a number, got '${String(v)}'`);
	return v;
};
const str = (v: Value): string => {
	if (typeof v !== "string") throw new Error(`expected a string, got '${String(v)}'`);
	return v;
};

type Figures = Record<string, (...args: Value[]) => Value>;

// A row's label columns are those before the first right-aligned one (at least
// the first), so a family table's rows match by group as well as by family.
const labelledRows = (
	tables: Record<string, string>,
	region: string,
	labels: Set<string>,
): { header: string[]; rows: string[][] } => {
	const table = tables[region];
	if (table === undefined) throw new Error(`no region '${region}'`);
	const lines = table.split("\n").filter((line) => line.startsWith("|"));
	const cellsOf = (line: string): string[] =>
		line
			.slice(1, -1)
			.split("|")
			.map((cell) => cell.trim().replace(/^\*\*|\*\*$|^_|_$/g, ""));
	const rules = cellsOf(lines[1] ?? "");
	const firstValue = rules.findIndex((rule) => rule.endsWith(":"));
	const labelCount = firstValue === -1 ? rules.length : Math.max(1, firstValue);
	const rows = lines
		.slice(2)
		.map(cellsOf)
		.filter((cells) => cells.slice(0, labelCount).some((cell) => labels.has(cell)));
	return { header: cellsOf(lines[0] ?? ""), rows };
};

const columnIn = (header: string[], column: string, region: string): number => {
	const col = header.indexOf(column);
	if (col === -1) throw new Error(`no column '${column}' in region '${region}'`);
	return col;
};

// Every cell where the listed rows meet the listed columns, across the listed
// tables, each list joined with "+". Every row must be in every table, so a
// misspelt label fails rather than quietly leaving a row out of an extreme.
const cellsAcross = (
	tables: Record<string, string>,
	regions: string,
	rows: string,
	columns: string,
): number[] => {
	const labels = rows.split("+");
	return regions.split("+").flatMap((region) => {
		const { header, rows: found } = labelledRows(tables, region, new Set(labels));
		const missing = labels.filter((label) => !found.some((cells) => cells.includes(label)));
		if (missing.length) throw new Error(`no row '${missing.join("', '")}' in region '${region}'`);
		const cols = columns.split("+").map((column) => columnIn(header, column, region));
		return found.flatMap((cells) => cols.map((col) => numberIn(cells[col] ?? "")));
	});
};

const batchQueryTimes = (a: Artifact, corpus: string, size: string, query: string): number[] => {
	const at = a.probes[corpus]?.findIndex((probe) => probe.query === query) ?? -1;
	if (at === -1) throw new Error(`no ${corpus} probe '${query}'`);
	return Object.values(a.coldMatrix[corpus]?.batch?.[size] ?? {})
		.map((cell) => cell.perQueryMs?.[at])
		.filter((ms): ms is number => ms !== undefined);
};

const figuresFor = (a: Artifact, tables: Record<string, string>): Figures => ({
	// Reading the artifact.
	cell: (region, row, column) => {
		const table = tables[str(region)];
		if (table === undefined) throw new Error(`no region '${String(region)}'`);
		return tableCell(table, str(row), str(column));
	},
	n: (region, row, column) => {
		const table = tables[str(region)];
		if (table === undefined) throw new Error(`no region '${String(region)}'`);
		return numberIn(tableCell(table, str(row), str(column)));
	},
	raw: (...path) => {
		let at: unknown = a;
		for (const key of path) at = (at as Record<string, unknown> | undefined)?.[String(key)];
		if (typeof at !== "number") throw new Error(`no number at ${path.join(".")}`);
		return at;
	},
	oneShot: (corpus, size, config) => {
		const value = meanOneShotOf(a, str(corpus), String(num(size)), str(config));
		if (value === null) throw new Error(`no one-shot cells for ${String(config)}`);
		return value;
	},
	// Arithmetic.
	div: (x, y) => num(x) / num(y),
	mul: (x, y) => num(x) * num(y),
	add: (x, y) => num(x) + num(y),
	sub: (x, y) => num(x) - num(y),
	min: (...xs) => Math.min(...xs.map(num)),
	max: (...xs) => Math.max(...xs.map(num)),
	mean: (...xs) => xs.map(num).reduce((s, x) => s + x, 0) / xs.length,
	// A deliberate fixed value, such as a design constant, which no run changes.
	constant: (text) => str(text),
	// A measurement no artifact keeps, named with where it came from, so it reads
	// as held by hand rather than as a definition.
	unsourced: (text, source) => {
		if (!str(source).trim()) throw new Error(`unsourced '${str(text)}' names no source`);
		return str(text);
	},
	// Formatting.
	fixed: (x, digits) => num(x).toFixed(num(digits)),
	pct: (x) => `${Math.round(num(x) * 100)}%`,
	times: (x, digits) => `${num(x).toFixed(num(digits))}×`,
	span: (lo, hi, digits, suffix = "") => {
		const [low, high] = [num(lo).toFixed(num(digits)), num(hi).toFixed(num(digits))];
		return low === high ? `${low}${str(suffix)}` : `${low}–${high}${str(suffix)}`;
	},
	fraction: (x) => {
		const words = FRACTIONS[Math.round(1 / num(x))];
		if (!words) throw new Error(`no word for 1/${(1 / num(x)).toFixed(1)}`);
		return words;
	},
	// Claims: render nothing, and fail the build once the numbers stop backing them.
	assert: (condition, claim) => {
		if (condition !== true) throw new Error(`claim no longer holds: ${str(claim)}`);
		return "";
	},
	lt: (x, y) => num(x) < num(y),
	gt: (x, y) => num(x) > num(y),
	within: (x, y, tolerance) => Math.abs(num(x) / num(y) - 1) <= num(tolerance),
	lowest: (regions, rows, columns) =>
		Math.min(...cellsAcross(tables, str(regions), str(rows), str(columns))),
	highest: (regions, rows, columns) =>
		Math.max(...cellsAcross(tables, str(regions), str(rows), str(columns))),
	probeCount: (corpus, query, config) => {
		const count = a.probes[str(corpus)]?.find((probe) => probe.query === str(query))?.cells[
			str(config)
		]?.count;
		if (count === undefined) throw new Error(`no ${String(config)} count for '${String(query)}'`);
		return count;
	},
	fastestBatchQuery: (corpus, size, query) =>
		Math.min(...batchQueryTimes(a, str(corpus), String(num(size)), str(query))),
	slowestBatchQuery: (corpus, size, query) =>
		Math.max(...batchQueryTimes(a, str(corpus), String(num(size)), str(query))),
	// The mean one-shot over every timed query but one, to set a query's own cost apart.
	oneShotWithout: (corpus, size, config, kind) => {
		const cells = Object.entries(a.coldMatrix[str(corpus)] ?? {})
			.filter(([k]) => k !== "batch" && k !== str(kind))
			.map(([, sizes]) => sizes[String(num(size))]?.[str(config)]?.oneShotMs)
			.filter((ms): ms is number => ms !== undefined);
		if (cells.length === 0) throw new Error(`no one-shot cells for ${String(config)}`);
		return cells.reduce((s, x) => s + x, 0) / cells.length;
	},
	// The scorecard's MRR before it is rounded to two places.
	headlineMrr: (corpus, config) => {
		const scored = (a.families?.[str(corpus)] ?? []).filter((family) => family.scored);
		if (!scored.some((family) => str(config) in family.mrr)) {
			throw new Error(`no ${str(corpus)} families score '${str(config)}'`);
		}
		return headlineMrr(scored, str(config));
	},
	// The median, across the scored families, of each family's median result count.
	medianRows: (corpus, config) => {
		const rows = (a.families?.[str(corpus)] ?? [])
			.filter((family) => family.scored)
			.map((family) => family.medianRows[str(config)])
			.filter((count): count is number => count !== undefined)
			.sort((x, y) => x - y);
		if (rows.length === 0) throw new Error(`no ${str(corpus)} result counts for '${str(config)}'`);
		const middle = rows.length >> 1;
		return rows.length % 2 ? rows[middle] : (rows[middle - 1] + rows[middle]) / 2;
	},
	inWords: (x) => {
		const small = [
			"zero",
			"one",
			"two",
			"three",
			"four",
			"five",
			"six",
			"seven",
			"eight",
			"nine",
			"ten",
			"eleven",
			"twelve",
			"thirteen",
			"fourteen",
			"fifteen",
			"sixteen",
			"seventeen",
			"eighteen",
			"nineteen",
		];
		const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
		const whole = Math.round(num(x));
		if (whole < 0 || whole > 99) throw new Error(`no words for ${whole}`);
		if (whole < 20) return small[whole];
		const ten = tens[Math.floor(whole / 10)];
		return whole % 10 ? `${ten}-${small[whole % 10]}` : ten;
	},
	// True unless some pair of rows is ordered one way in one table and the other
	// way in another; a tie in either is no disagreement.
	sameOrder: (column, ...regions) => {
		const valuesIn = regions.map((region) => {
			const table = tables[str(region)];
			if (table === undefined) throw new Error(`no region '${String(region)}'`);
			return table;
		});
		const rows = (valuesIn[0] ?? "")
			.split("\n")
			.filter((line) => line.startsWith("|"))
			.slice(2)
			.map((line) => (line.split("|")[1] ?? "").trim().replace(/^\*\*|\*\*$|^_|_$/g, ""));
		const orders = valuesIn.map((table) =>
			rows.map((row) => numberIn(tableCell(table, row, str(column)))),
		);
		return rows.every((_, i) =>
			rows.every((_, j) =>
				orders.every((order) =>
					orders.every((other) => Math.sign(order[i] - order[j]) * Math.sign(other[i] - other[j]) >= 0),
				),
			),
		);
	},
	// `cell` for a table whose row is named by a label column other than the first.
	labelCell: (region, row, column) => {
		const { header, rows } = labelledRows(tables, str(region), new Set([str(row)]));
		if (rows.length !== 1) throw new Error(`${rows.length} rows labelled '${str(row)}'`);
		return rows[0][columnIn(header, str(column), str(region))] ?? "";
	},
	sessionMs: (config, step) => {
		const row = a.session?.rows.find((r) => r.library === str(config));
		const at = a.session?.steps.indexOf(str(step)) ?? -1;
		const ms = str(step) === "session" ? row?.sessionMs : row?.stepMs[at];
		if (ms === undefined) throw new Error(`no session ${str(step)} for '${str(config)}'`);
		return ms;
	},
});

export const figureEvaluator = (
	a: Artifact,
	tables: Record<string, string>,
): ((source: string) => string) => {
	const figures = figuresFor(a, tables);
	const evaluate = (expr: Expr): Value => {
		if (typeof expr !== "object") return expr;
		const figure = figures[expr.name];
		if (figure === undefined) throw new Error(`no figure '${expr.name}'`);
		return figure(...expr.args.map(evaluate));
	};
	return (source) => {
		const value = evaluate(parseFigure(source));
		if (typeof value === "boolean") throw new Error(`figure '${source}' is a condition; wrap it in assert`);
		return typeof value === "number" ? String(value) : value;
	};
};
