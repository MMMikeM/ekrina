const combiningMarks = /[\u0300-\u036f]/g;
const hasCombiningMark = /[\u0300-\u036f]/;
const hasNonAscii = /[\u0080-\uffff]/;

// Keyboards type U+0027/U+0022; macOS smart quotes emit the curly forms, and
// without the fold one form can never match the other.
const QUOTE_FOLDS: Record<string, string> = { "‘": "'", "’": "'", "“": '"', "”": '"' };

// One folded string per code point, never changing the code-unit length — the
// 1:1 guarantee behind every published Range. Length-changing folds fall back
// to plain lowercase, then to the original character.
const computeFold = (char: string): string => {
	const quote = QUOTE_FOLDS[char];
	if (quote !== undefined) return quote;
	const lowered = char.toLowerCase();
	let stripped = lowered.normalize("NFD").replace(combiningMarks, "");
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

// Dense array through Latin Extended + Greek + Cyrillic (an indexed load beats
// Map's string hashing ~1.8× on the fold loop); rarer code points use the Map.
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
	// toLowerCase can itself surface combining marks (İ → i̇), so the pure-ASCII
	// fast path tests after it.
	const lowered = text.toLowerCase();
	if (!hasNonAscii.test(lowered)) return lowered.trim();
	let trimmed = text.trim();
	// Compose first so the per-point fold sees "é", not "e" + combining mark.
	if (hasCombiningMark.test(trimmed)) trimmed = trimmed.normalize("NFC");
	let folded = "";
	for (const char of trimmed) folded += foldChar(char);
	return folded;
};

// `charMask`'s bit for one code unit: a letter as its lower case, digits in
// four buckets, non-ASCII in two, and nothing for a separator.
export const unitMask = (unit: number): number => {
	if (unit >= 97 && unit <= 122) return 1 << (unit - 97);
	// Raw ASCII capitals, which rawFieldScan reads before folding.
	if (unit >= 65 && unit <= 90) return 1 << (unit - 65);
	if (unit >= 48 && unit <= 57) return 1 << (26 + (unit & 3));
	if (unit > 127) return 1 << (30 + (unit & 1));
	return 0;
};

/**
 * `charMask(normaliseText(raw))` without building the normalised string. Runs
 * once per field, when a searcher first needs a whole-list pass. May only
 * false-pass: skipping NFC can only add mask bits.
 */
export const rawFieldScan = (raw: string): number => {
	let mask = 0;
	for (let i = 0; i < raw.length; i++) {
		const unit = raw.charCodeAt(i);
		if (unit < 128) {
			mask |= unitMask(unit);
			continue;
		}
		const codePoint = raw.codePointAt(i) as number;
		if (codePoint > 0xffff) i++;
		const folded = foldChar(String.fromCodePoint(codePoint));
		for (let k = 0; k < folded.length; k++) mask |= unitMask(folded.charCodeAt(k));
	}
	return mask;
};
