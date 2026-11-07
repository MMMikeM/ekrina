import { expect, it } from "vite-plus/test";
import { gzipBytes } from "./size.ts";

const BUDGET_BYTES = 8_500;

it(`createSearcher bundles to at most ${BUDGET_BYTES} bytes gzipped`, () => {
	expect(gzipBytes("ekrina")).toBeLessThanOrEqual(BUDGET_BYTES);
});
