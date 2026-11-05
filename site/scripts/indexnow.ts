import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Tells Bing, Yandex, Naver and the other IndexNow engines that every page in
// the sitemap changed, so a deploy is crawled within days. Google ignores it.
// The key isn't a secret: the engines check it against public/<key>.txt, which
// wrangler.jsonc keeps off the Worker. Change it in both places.
const KEY = "c7d40e169ebac107977cd58b290eb1b3";

const sitemap = join(dirname(fileURLToPath(import.meta.url)), "../dist/sitemap-0.xml");
const urlList = [...readFileSync(sitemap, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(
	([, loc]) => loc,
);
const host = new URL(urlList[0] ?? "").host;

const response = await fetch("https://api.indexnow.org/indexnow", {
	method: "POST",
	headers: { "Content-Type": "application/json; charset=utf-8" },
	body: JSON.stringify({ host, key: KEY, keyLocation: `https://${host}/${KEY}.txt`, urlList }),
});

// 200 and 202 (accepted, key not yet checked) both mean the list was taken.
console.log(`indexnow: submitted ${urlList.length} URLs for ${host}, status ${response.status}`);
if (!response.ok) {
	process.exit(1);
}
