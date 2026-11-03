// Local-only menu action pipeline demonstration. Not a production MysticWeb API.
import { createServer } from "node:http";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const routes = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/news.xml", ["data/latest.xml", "application/rss+xml; charset=utf-8"]]
]);
const origin = "http://127.0.0.1:8765";
let refreshing = false;
async function refreshNews() {
  const response = await fetch("https://moxie.foxnews.com/google-publisher/latest.xml", {
    signal: AbortSignal.timeout(12000), headers: { "User-Agent": "MysticWeb-NewsExample/1.0" }
  });
  if (!response.ok) throw new Error("News source unavailable");
  const xml = await response.text();
  if (xml.length > 2_000_000 || !/<rss\b/i.test(xml) || !/<channel\b/i.test(xml)) throw new Error("Invalid RSS response");
  const directory = join(here, "data");
  await mkdir(directory, { recursive: true });
  const temp = join(directory, `latest-${process.pid}.tmp`);
  await writeFile(temp, xml, "utf8");
  await rename(temp, join(directory, "latest.xml"));
}
createServer(async (req, res) => {
  const pathname = new URL(req.url ?? "/", origin).pathname;
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (pathname === "/actions/refresh-news") {
    // Only a local, same-origin demo; production must use authenticated actions and CSRF protection.
    if (req.method !== "POST" || req.headers.origin !== origin ||
      req.headers["sec-fetch-site"] === "cross-site") {
      res.writeHead(403, headers); res.end("Forbidden"); return;
    }
    if (refreshing) { res.writeHead(409, headers); res.end("Refresh already in progress"); return; }
    refreshing = true;
    try { await refreshNews(); res.writeHead(200, { ...headers, "Content-Type": "application/json" }); res.end('{"ok":true}'); }
    catch { res.writeHead(502, headers); res.end("Unable to refresh news"); }
    finally { refreshing = false; }
    return;
  }
  const entry = routes.get(pathname);
  if (!entry || req.method !== "GET") { res.writeHead(404, headers); res.end("Not found"); return; }
  try {
    const bytes = await readFile(join(here, entry[0]));
    res.writeHead(200, { ...headers, "Content-Type": entry[1] });
    res.end(bytes);
  } catch { res.writeHead(404, headers); res.end("Run fetch-news.mjs first"); }
}).listen(8765, "127.0.0.1", () => console.log(`Open ${origin}`));
