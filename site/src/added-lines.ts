/**
 * The 1-based numbers of the lines `after` adds to `before`, by longest common
 * subsequence, for Expressive Code's `ins` markers on the whole new file.
 */
export const addedLines = (before: string, after: string): number[] => {
	const a = before.split("\n");
	const b = after.split("\n");
	const common = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			common[i]![j] = a[i] === b[j] ? common[i + 1]![j + 1]! + 1 : Math.max(common[i + 1]![j]!, common[i]![j + 1]!);
		}
	}
	const added: number[] = [];
	let i = 0;
	let j = 0;
	while (j < b.length) {
		if (i < a.length && a[i] === b[j]) i++, j++;
		else if (i < a.length && common[i + 1]![j]! >= common[i]![j + 1]!) i++;
		else added.push(++j);
	}
	return added;
};
