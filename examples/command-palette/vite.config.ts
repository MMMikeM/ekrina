import { defineConfig } from "vite-plus";

export default defineConfig({
	build: { rollupOptions: { input: ["index.html", "react.html"] } },
	run: {
		tasks: {
			// The app imports ekrina from its dist/, which a stale build would serve silently.
			dev: {
				command: "vp dev",
				dependsOn: [{ task: "build", from: "dependencies" }],
				cache: false,
			},
			build: { command: "vp build", dependsOn: [{ task: "build", from: "dependencies" }] },
		},
	},
});
