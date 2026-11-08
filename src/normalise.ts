const combiningMarks: RegExp = /[\u0300-\u036f]/g;
const hasCombiningMark = /[\u0300-\u036f]/;
const hasNonAscii = /[\u0080-\uffff]/;

// Keyboards type U+0027/U+0022; macOS smart quotes emit the curly forms, and
// without the fold one form can never match the other.
const QUOTE_FOLDS: Record<string, string> = { "‘": "'", "’": "'", "“": '"', "”": '"' };

// One folded string per code point, never changing the code-unit length — the
// 1:1 guarantee behind every published HighlightRange. Length-changing folds fall back
// to plain lowercase, then to the original character.
const fitFold = (char: string, lowered: string, stripped: string): string => {
	// ł has no NFD decomposition; final sigma folds to medial.
	if (stripped === "ł") stripped = "l";
	else if (stripped === "ς") stripped = "σ";
	return stripped.length === char.length
		? stripped
		: lowered.length === char.length
			? lowered
			: // No code point reaches this today (checked over all of Unicode); it
				// keeps the fold 1:1 if a later Unicode changes a case mapping.
				/* v8 ignore next */
				char;
};

export const computeFold = (char: string): string => {
	const quote = QUOTE_FOLDS[char];
	if (quote !== undefined) return quote;
	const lowered = char.toLowerCase();
	return fitFold(char, lowered, lowered.normalize("NFD").replace(combiningMarks, ""));
};

// An indexed load beats Map's string hashing on the fold loop.
const DENSE_FOLDS_MAX = 0x4ff;
// fill() keeps the elements packed; Array.from({ length }) reads slower.
// oxlint-disable-next-line unicorn/no-new-array
const denseFolds: (string | undefined)[] = new Array(DENSE_FOLDS_MAX + 1).fill(undefined);
const rareFolds = new Map<string, string>();
const RARE_FOLDS_MAX = 65_536;

export const foldChar = (char: string): string => {
	const codePoint = char.codePointAt(0) as number;
	if (codePoint <= DENSE_FOLDS_MAX) {
		let folded = denseFolds[codePoint];
		if (folded === undefined) denseFolds[codePoint] = folded = computeFold(char);
		return folded;
	}
	let folded = rareFolds.get(char);
	if (folded === undefined) {
		folded = computeFold(char);
		// Queries can name any code point, so the cache is bounded rather than
		// left to grow towards all of Unicode.
		if (rareFolds.size >= RARE_FOLDS_MAX) rareFolds.clear();
		rareFolds.set(char, folded);
	}
	return folded;
};

/**
 * Normalises text for fuzzy comparison:
 * - Lowercase
 * - Remove diacritics (é → e, ü → u, ñ → n)
 * - Fold the characters NFD leaves whole (ł → l, ς → σ)
 * - Trim whitespace
 *
 * The result is offset-preserving by construction, with exactly one code unit
 * per unit of `NFC(text).trim()`, so match ranges computed against it index the
 * caller's own string whenever that string is NFC-normal and untrimmed
 * (virtually all real data; decomposed input gets offsets into the
 * visually-identical NFC form).
 */
export const normaliseText = (text: string): string => {
	if (!hasNonAscii.test(text)) return text.toLowerCase().trim();
	let trimmed = text.trim();
	// Compose first so the per-point fold sees "é", not "e" + combining mark.
	if (hasCombiningMark.test(trimmed)) trimmed = trimmed.normalize("NFC");
	let folded = "";
	for (const char of trimmed) folded += foldChar(char);
	return folded;
};

// Every code point that folds to ASCII lives in these ranges; test/unfold.test.ts
// walks the whole BMP and fails if a fold source ever appears outside them.
const SOURCE_RANGES: readonly (readonly [number, number])[] = [
	[0x30, 0x39],
	[0x41, 0x5a],
	[0x61, 0x7a],
	[0xc0, 0x24f],
	[0x1e00, 0x1eff],
	[0x212a, 0x212b],
];

let table: Record<string, string> | null = null;

// For each ASCII letter and digit, every code point that `normaliseText` folds
// to it. Folded in bulk, one `toLowerCase` and one NFD pass over the joined
// ranges, since folding per character is several times slower. A class missing
// any source would false-reject a field that carries it.
export const unfoldTable = (): Record<string, string> => {
	if (table !== null) return table;
	let sources = "";
	for (const [lo, hi] of SOURCE_RANGES) {
		for (let codePoint = lo; codePoint <= hi; codePoint++) {
			sources += String.fromCharCode(codePoint);
		}
	}
	const joined = sources.split("").join(" ");
	const lowered = joined.toLowerCase();
	const lowers = lowered.split(" ");
	const candidates = lowered.normalize("NFD").replace(combiningMarks, "").split(" ");
	const built: Record<string, string> = {};
	for (let i = 0; i < sources.length; i++) {
		const folded = fitFold(sources[i], lowers[i], candidates[i]);
		const unit = folded.charCodeAt(0);
		if ((unit >= 97 && unit <= 122) || (unit >= 48 && unit <= 57)) {
			built[folded] = (built[folded] ?? "") + sources[i];
		}
	}
	table = built;
	return built;
};
