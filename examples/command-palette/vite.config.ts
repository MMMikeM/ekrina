import { defineConfig } from "vite-plus";

export default defineConfig({
	build: { rollupOptions: { input: ["index.html", "react.html"] } },
});
