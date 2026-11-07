import { combiningMarks, fitFold } from "./normalise";

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
