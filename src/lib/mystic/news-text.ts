import "server-only";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { getNewsItem } from "@/lib/scripting/news-menu";

const MAX_NEWS_BYTES = 256 * 1024;
/** Read only four explicitly allowlisted Mystic news pages. */
export async function readMysticNewsPage(id: string): Promise<string | null> {
  const item = getNewsItem(id);
  const root = process.env.MYSTIC_DATA_ROOT;
  const theme = process.env.MYSTICWEB_BULLETIN_THEME || "default";
  if (!item || !root || !path.isAbsolute(root) || !/^[a-z0-9_-]+$/i.test(theme)) return null;
  const filename = path.join(root, "themes", theme, "text", item.textFile + ".asc");
  try {
    const stat = await lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_NEWS_BYTES) return null;
    const bytes = await readFile(filename);
    if (bytes.length > MAX_NEWS_BYTES) return null;
    return bytes.toString("latin1").replace(/\r\n?/g, "\n");
  } catch {
    return null;
  }
}
