import type { Field, FieldSpec } from "./types";

export type ResolvedSpec<T> = {
	selector: (item: T) => string | null;
	acronymTier: boolean;
	demotion: number;
	fieldName: string | undefined;
};

// JavaScript orders integer-like keys before all others, which would reorder the
// fields and so the tie rule.
const integerLike = /^(0|[1-9]\d*)$/;

const isField = (value: unknown): value is Field<never> =>
	typeof value === "function" ||
	typeof (value as FieldSpec<never> | null)?.selectField === "function";

const SPEC_KEYS = ["selectField", "acronym", "demoteBy"];

// Any other key is a typo, which would otherwise be ignored.
const checkSpecKeys = (spec: object, where: string): void => {
	for (const key of Object.keys(spec)) {
		if (!SPEC_KEYS.includes(key)) {
			throw new TypeError(`${where} takes selectField, acronym and demoteBy, not ${key}`);
		}
	}
};

// Resolved once: the per-item loops run count × specs times and shouldn't
// re-default options or capture per-item closures.
const resolveField = <T>(field: Field<T>, fieldName: string | undefined): ResolvedSpec<T> => {
	if (typeof field === "function")
		return { selector: field, acronymTier: false, demotion: 0, fieldName };
	const where = fieldName === undefined ? "a field spec" : `field ${fieldName}`;
	checkSpecKeys(field, where);
	const demotion = field.demoteBy ?? 0;
	// A negative or NaN shift would carry a guess to or below SCORES.CONTAINS.
	if (!(Number.isFinite(demotion) && demotion >= 0)) {
		throw new RangeError(
			`${where}: demoteBy must be a finite number of at least 0, got ${demotion}`,
		);
	}
	return { selector: field.selectField, acronymTier: field.acronym ?? false, demotion, fieldName };
};

export const resolveFieldSpecs = <T>(
	selection?: Field<T> | Record<string, Field<T>>,
): ResolvedSpec<T>[] => {
	if (!selection) selection = (item) => item as unknown as string;
	if (typeof selection === "function") return [resolveField(selection, undefined)];
	// A Map, an array or a class instance would read as an object of no fields.
	const proto = typeof selection === "object" ? Object.getPrototypeOf(selection) : undefined;
	if (proto !== Object.prototype && proto !== null) {
		throw new TypeError(
			"createSearcher takes a field, or an object of named fields such as { title: (item) => item.title }",
		);
	}
	// A selectField key makes the object one spec, so a field beside it is an
	// unknown key rather than a second field.
	if ("selectField" in selection) {
		if (!isField(selection)) throw new TypeError("a field can't be named selectField");
		return [resolveField(selection, undefined)];
	}
	return Object.entries(selection).map(([name, field]) => {
		if (integerLike.test(name)) {
			throw new TypeError(
				`a field can't be named ${name}: integer-like names sort before the others`,
			);
		}
		if (!isField(field)) {
			throw new TypeError(`field ${name} needs selectField`);
		}
		return resolveField(field, name);
	});
};
