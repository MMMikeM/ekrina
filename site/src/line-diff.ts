/**
 * `after` as a diff from `before`, in the form Expressive Code's diff language
 * reads: each line prefixed "+" added, "-" removed or " " kept, with only
 * `context` kept lines either side of a change and "…" where lines are left out.
 */
export const lineDiff = (before: string, after: string, context = 2): string => {
	const a = before.split("\n");
	const b = after.split("\n");
	const common = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			common[i]![j] = a[i] === b[j] ? common[i + 1]![j + 1]! + 1 : Math.max(common[i + 1]![j]!, common[i]![j + 1]!);
		}
	}
	const ops: [op: string, line: string][] = [];
	let i = 0;
	let j = 0;
	while (i < a.length || j < b.length) {
		if (i < a.length && j < b.length && a[i] === b[j]) ops.push([" ", a[i++]!]), j++;
		else if (j === b.length || (i < a.length && common[i + 1]![j]! >= common[i]![j + 1]!)) ops.push(["-", a[i++]!]);
		else ops.push(["+", b[j++]!]);
	}
	const shown = ops.map((_, k) => ops.slice(Math.max(0, k - context), k + context + 1).some(([op]) => op !== " "));
	return ops
		.flatMap(([op, line], k) => (shown[k] ? [op + line] : k === 0 || shown[k - 1] ? [" …"] : []))
		.join("\n");
};
