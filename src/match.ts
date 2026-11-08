import { fuzzyChainMatch } from "./fuzzy";
import { budgetAdmits, charMask } from "./gates";
import { literalTiers, shiftRanges } from "./ladder";
import { normaliseText } from "./normalise";
import { frontGate, type PreparedQuery, prepareBoundedQuery } from "./query";
import { lacksBeyondEdits } from "./correction";
import { stages } from "./stages";
import { BOUNDARY_SCORE, CONTAINS_SCORE } from "./scores";
import type { MatchOptions, MatchResult } from "./types";

export const matchField = (
	field: string,
	normalisedField: string,
	fieldMask: number,
	prepared: PreparedQuery,
	acronym: boolean,
	frontGated?: boolean,
	literalOnly?: boolean,
): MatchResult | null => {
	const { normalisedQuery } = prepared;
	if ((prepared.queryMask & ~fieldMask) !== 0) return null;
	const gate = frontGated ? null : frontGate(prepared);
	if (gate && !gate.test(normalisedField)) return null;

	const literal = literalTiers(field, normalisedField, prepared, acronym);
	// One character anywhere matches most of any list and ranks none of it, so it
	// counts only where it starts a word.
	if (normalisedQuery.length === 1) {
		return literal !== null && literal.score <= BOUNDARY_SCORE ? literal : null;
	}
	if (literal !== null || literalOnly) return literal;
	// A phrase was front-gated on presence, so it still owes the fuzzy gate.
	return prepared.queryWords.length > 1 && !prepared.fuzzyGate.test(normalisedField)
		? null
		: fuzzyChainMatch(normalisedField, normalisedQuery);
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
	// Here no stage can match, so none is asked.
	if (lacksBeyondEdits(q.queryMask & ~fieldMask)) return null;

	let result = matchField(field, normalisedField, fieldMask, q, acronym);
	for (let k = 0; k < stages.length; k++) {
		if (result !== null && result.score <= CONTAINS_SCORE) break;
		const corrector = stages[k].prepare(q, result === null ? "none" : "fuzzy");
		if (
			corrector !== null &&
			budgetAdmits(corrector.needed & ~fieldMask, corrector.counts, corrector.spare)
		) {
			result = corrector.match(field, normalisedField, result, fieldMask, acronym);
		}
	}
	const lead = text.length - text.trimStart().length;
	if (result && lead) shiftRanges(result.ranges, lead);
	return result;
};
