import { fuzzyChainMatch } from "./fuzzy";
import { charMask, lacksAtMostOneClass } from "./gates";
import { literalTiers, shiftRanges } from "./ladder";
import { normaliseText } from "./normalise";
import { frontGate, type PreparedQuery, prepareBoundedQuery } from "./query";
import { readingAdmits, readings } from "./readings";
import { isRescuableQuery, isShortQuery } from "./correction";
import { missingCharRescue, type RescueContext, rescueField } from "./rescue";
import { better, BOUNDARY_SCORE, CONTAINS_SCORE, preferBetter } from "./scores";
import type { MatchOptions, MatchResult } from "./types";

const fuzzyOrRescue = (rescue: RescueContext, rescuable: boolean): MatchResult | null => {
	const { normalisedField, prepared } = rescue;
	// A phrase was front-gated on presence, so it still owes the fuzzy gate.
	const chain =
		prepared.queryWords.length > 1 && !prepared.fuzzyGate.test(normalisedField)
			? null
			: fuzzyChainMatch(normalisedField, prepared.normalisedQuery);
	if (chain === null) return rescuable ? rescueField(rescue) : null;
	if (!rescuable || isShortQuery(prepared.normalisedQuery, prepared.queryWords)) return chain;
	// The field may literally contain the corrected word, so both rescues are
	// still scored beside the chain.
	const dropped = missingCharRescue(rescue, chain.ranges);
	return preferBetter(preferBetter(dropped, rescueField(rescue)), chain);
};

// `preGated` means the caller already ran the front gate on this string.
export const matchField = (
	field: string,
	normalisedField: string,
	fieldMask: number,
	prepared: PreparedQuery,
	acronym: boolean,
	mayRescue: boolean,
	preGated?: boolean,
	literalOnly?: boolean,
): MatchResult | null => {
	const { normalisedQuery, queryWords } = prepared;

	const rescuable = mayRescue && isRescuableQuery(normalisedQuery, queryWords);
	const missingClasses = prepared.queryMask & ~fieldMask;
	if (rescuable ? !lacksAtMostOneClass(missingClasses) : missingClasses) return null;

	const rescueContext = (): RescueContext => ({
		rawField: field,
		normalisedField,
		prepared,
		acronymTier: acronym,
		missingClasses,
	});

	if (missingClasses !== 0) return rescueField(rescueContext());

	const gate = preGated ? null : frontGate(prepared);
	if (gate && !gate.test(normalisedField)) {
		return rescuable ? rescueField(rescueContext()) : null;
	}

	const literal = literalTiers(field, normalisedField, prepared, acronym);
	// One character anywhere matches most of any list and ranks none of it, so it
	// counts only where it starts a word.
	if (normalisedQuery.length === 1) {
		return literal !== null && literal.score <= BOUNDARY_SCORE ? literal : null;
	}
	if (literal !== null || literalOnly) return literal;
	return fuzzyOrRescue(rescueContext(), rescuable);
};

/**
 * Score one string against a query, or null when it doesn't match.
 *
 * Judges the string on its own. A searcher over a list can return fewer
 * corrections than this does per item (see createSearcher).
 * A query is matched on its first 256 characters, and one holding a word over
 * 64 characters is never corrected.
 *
 * @example
 * fuzzyMatch('banana', 'ban'); // { score: 0.5, tier: 'prefix', ranges: [[0, 2]] }
 *
 * @example
 * // A typo, corrected: the boundary tier's 1 plus TYPO_PENALTY
 * fuzzyMatch('Open Recent', 'recnet'); // { score: 3.1, tier: 'corrected', corrected: 'recent', ranges: [[5, 10]] }
 */
export const fuzzyMatch = (
	text: string,
	query: string,
	options: MatchOptions = {},
): MatchResult | null => {
	const { acronym = false } = options;
	const q = prepareBoundedQuery(query);
	if (q === null) return null;
	const field = text.trim();
	const normalisedField = normaliseText(field);
	const fieldMask = charMask(normalisedField);

	let result = matchField(field, normalisedField, fieldMask, q, acronym, true);
	if (result === null || result.score > CONTAINS_SCORE) {
		const reading = readings.prepare(q, result === null ? "none" : "fuzzy");
		const fallback =
			reading && readingAdmits(reading, fieldMask) ? reading.match(field, normalisedField) : null;
		result = better(result, fallback);
	}
	const lead = text.length - text.trimStart().length;
	if (result && lead) shiftRanges(result.ranges, lead);
	return result;
};
