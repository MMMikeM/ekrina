import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { buildSync } from "esbuild";
import { META } from "./libraries.ts";

const here = fileURLToPath(new URL(".", import.meta.url));

/**
 * The library's primary API bundled and minified by esbuild, then gzipped, in
 * bytes. zlib rather than the `gzip` CLI, whose output differs between macOS
 * and Linux. Ekrina resolves to the workspace's built `dist/`, so it measures
 * the last `pnpm build`.
 */
export const gzipBytes = (library: string): number => {
	const meta = META[library];
	if (!meta) throw new Error(`no metadata for '${library}' in bench/libraries.ts`);
	const { from, name } = meta.api;
	const { outputFiles } = buildSync({
		stdin: {
			contents: `import { ${name} as api } from ${JSON.stringify(from)};\nexport default api;\n`,
			resolveDir: here,
		},
		bundle: true,
		minify: true,
		format: "esm",
		write: false,
		logLevel: "silent",
	});
	return gzipSync(outputFiles[0]!.contents).length;
};
