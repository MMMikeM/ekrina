/**
 * Compile-time checks for the v1.0 overloads and types. tsconfig includes
 * test/**, so `pnpm lint:types` enforces these; the runtime bodies are incidental.
 */
import { describe, expect, it } from "vite-plus/test";
import { createSearcher, fuzzyMatch, SCORES } from "../src/index";
import type { FieldMatch, MatchResult, SearchResult, SearchResultOf } from "../src/index";

type User = { name: string; email: string };

describe("types", () => {
	it("string overload infers SearchResult<string>", () => {
		const r: SearchResult<string> | undefined = createSearcher(["a", "b"])("a")[0];
		expect(r === undefined || typeof r.item === "string").toBe(true);
	});

	it("selectField overload infers the item type without a cast", () => {
		const users: User[] = [{ name: "Ada", email: "a@x.com" }];
		// If T weren't inferred as User, u.name would not typecheck.
		const r: SearchResult<User> | undefined = createSearcher(users, (u) => u.name)("ada")[0];
		expect(r?.item.name ?? "Ada").toBe("Ada");
	});

	it("named fields infer the item type and the field names", () => {
		const users: User[] = [{ name: "United States", email: "us@x.com" }];
		const first = createSearcher(users, {
			name: { selectField: (u) => u.name, acronym: true, demoteBy: SCORES.CONTAINS },
			email: (u) => u.email,
		})("us")[0];
		const field: "name" | "email" | undefined = first?.field;
		const typed: SearchResult<User, "name" | "email"> | undefined = first;
		expect(field === undefined || typeof typed?.tier === "string").toBe(true);
		// @ts-expect-error a misspelt name has no overlap with the field names
		expect(first?.field === "emial").toBe(false);
	});

	it("a single-field result has no field name", () => {
		const users: User[] = [{ name: "Ada", email: "a@x.com" }];
		const first = createSearcher(users, (u) => u.name)("ada")[0];
		// @ts-expect-error
		expect(first?.field).toBeUndefined();
	});

	it("a lone spec infers the item type and names no field", () => {
		const users: User[] = [{ name: "Ada", email: "a@x.com" }];
		const first = createSearcher(users, { selectField: (u) => u.name, acronym: true })("ada")[0];
		const typed: SearchResult<User> | undefined = first;
		// @ts-expect-error a lone spec's result has no fields
		expect(typed?.fields).toBeUndefined();
	});

	it("fields is keyed by the field names", () => {
		const users: User[] = [{ name: "Ada", email: "a@x.com" }];
		const first = createSearcher(users, { name: (u) => u.name, email: (u) => u.email })("ada")[0];
		const name: FieldMatch | undefined = first?.fields.name;
		// @ts-expect-error a misspelt name is not a key of fields
		expect(first?.fields.nmae ?? name).toBeDefined();
	});

	it("primitive returns MatchResult", () => {
		const m: MatchResult | null = fuzzyMatch("banana", "ban", { acronym: false });
		expect(m?.tier).toBe("prefix");
	});
});

describe("SearchResultOf", () => {
	type Named = SearchResult<User, "name" | "email">;
	const users: User[] = [{ name: "Ada", email: "a@x.com" }];
	const fields = {
		name: { selectField: (u: User) => u.name },
		email: (u: User) => u.email,
	};

	it("reads a searcher, a factory, a wrapper or a hook alike", () => {
		const search = createSearcher(users, fields);
		const makeSearcher = (list: User[]) => createSearcher(list, fields);
		const wrapped = (list: User[]) => {
			const s = createSearcher(list, fields);
			return (query: string) => s(query, { limit: 8 });
		};
		const useUsers = (list: User[], query: string) => createSearcher(list, fields)(query);
		const all: Named[] = [
			...([] as SearchResultOf<typeof search>[]),
			...([] as SearchResultOf<typeof makeSearcher>[]),
			...([] as SearchResultOf<typeof wrapped>[]),
			...([] as SearchResultOf<typeof useUsers>[]),
		];
		expect(all).toEqual([]);
	});

	it("keeps a single-field result free of field, and gives never for anything else", () => {
		const titles = createSearcher(["a"]);
		const one: SearchResultOf<typeof titles> | undefined = titles("a")[0];
		// @ts-expect-error a single-field result has no field
		expect(one?.field).toBeUndefined();
		// @ts-expect-error a function that returns no results gives never
		const none: SearchResultOf<() => number> = { tier: "exact" };
		expect(none).toBeDefined();
	});
});

