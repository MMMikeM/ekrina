// A regex class body. Underscore included so snake_case stays whole.
export const WORD_CHARS: string = "\\p{L}\\p{N}_";

export const wordChar: RegExp = new RegExp(`[${WORD_CHARS}]`, "u");

const wordSeparators = new RegExp(`[^${WORD_CHARS}]+`, "u");

/**
 * Splits normalised text into words on any punctuation/whitespace run, so
 * multi-word matching tokenises "build," and "build" identically.
 */
export const splitWords = (text: string): string[] => text.split(wordSeparators).filter(Boolean);

export const asciiWordUnits: Uint8Array = Uint8Array.from({ length: 128 }, (_, unit) =>
	wordChar.test(String.fromCharCode(unit)) ? 1 : 0,
);

// Past either end of the text counts as a boundary.
export const isBoundaryAt = (text: string, at: number): boolean => {
	const unit = text.charCodeAt(at);
	return !(unit < 128 ? asciiWordUnits[unit] : unit > 127 && wordChar.test(text[at]));
};

export const opensWord = (text: string, at: number): boolean => isBoundaryAt(text, at - 1);

export const closesWord = (text: string, end: number): boolean => isBoundaryAt(text, end + 1);

// Shared by the fuzzy gate and the boundary tiers, which must agree on where a
// word starts or the gate rejects a field a tier would match.
export const wordStartOccurrence = (haystack: string, needle: string, from = 0): number => {
	let at = haystack.indexOf(needle, from);
	while (at > -1 && !opensWord(haystack, at)) at = haystack.indexOf(needle, at + 1);
	return at;
};
