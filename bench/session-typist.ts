// Child process of session.test.ts: one user typing one word into a fresh searcher.
import { configs } from "./configs.ts";
import { CORPORA } from "./corpus.ts";

const { library, steps, size } = JSON.parse(process.env.SESSION_CELL as string) as {
	library: string;
	steps: string[];
	size: number;
};
const native = CORPORA.find((c) => c.name === "native");
if (!native) throw new Error("native corpus missing");
const config = configs(native.build(size)).find((c) => c.name === library);
if (!config) throw new Error(`no configuration named '${library}'`);

// A page that has already answered other queries: the library's code is compiled,
// and no typing cache is primed for this word.
let sink = 0;
for (const spec of native.specs.slice(2, 6)) sink += config.count(spec.query);
sink += config.count("zzzzzz");

const stepMs = steps.map((query) => {
	const start = performance.now();
	sink += config.count(query);
	return performance.now() - start;
});
if (sink < 0) throw new Error("unreachable");
process.stdout.write(JSON.stringify(stepMs));
