// Standalone local demonstration server. Not a production MysticWeb API.
// Run: node examples/fox-news/serve-news.mjs ; open http://127.0.0.1:8765
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const routes = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/news.xml", ["data/latest.xml", "application/rss+xml; charset=utf-8"]]
]);
createServer(async (req, res) => {
  const entry = routes.get(new URL(req.url ?? "/", "http://localhost").pathname);
  if (!entry || req.method !== "GET") { res.writeHead(404); res.end("Not found"); return; }
  try {
    const bytes = await readFile(join(here, entry[0]));
    res.writeHead(200, { "Content-Type": entry[1], "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    res.end(bytes);
  } catch {
    res.writeHead(404); res.end("Run fetch-news.mjs first");
  }
}).listen(8765, "127.0.0.1", () => console.log("Open http://127.0.0.1:8765"));
