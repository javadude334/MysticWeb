// Standalone Node.js example: retrieve and cache Fox News's published RSS feed.
// Run with Node.js 20+ from any directory: node examples/fox-news/fetch-news.mjs
import { mkdir, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, "data");
const target = join(cache, "latest.xml");
const feed = "https://moxie.foxnews.com/google-publisher/latest.xml";
const response = await fetch(feed, {
  signal: AbortSignal.timeout(12000),
  headers: { "User-Agent": "MysticWeb-NewsExample/1.0" }
});
if (!response.ok) throw new Error(`RSS request failed: ${response.status}`);
const xml = await response.text();
if (xml.length > 2_000_000 || !/<rss\b/i.test(xml) || !/<channel\b/i.test(xml)) {
  throw new Error("Unexpected RSS response");
}
await mkdir(cache, { recursive: true });
const temp = join(cache, `latest-${process.pid}.tmp`);
await writeFile(temp, xml, "utf8");
await rename(temp, target);
console.log(`Saved Fox News RSS feed to ${target}`);
