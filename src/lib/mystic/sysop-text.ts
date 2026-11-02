import "server-only";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { getSysopMenuItem } from "@/lib/scripting/sysop-menus";

const MAX_TEXT_BYTES = 256 * 1024;
/** Only allow filenames resolved from the trusted, validated SysOp menu catalog. */
export async function readSysopMenuText(menuId: string, itemId: string): Promise<string | null> {
  const item = await getSysopMenuItem(menuId, itemId);
  const root = process.env.MYSTIC_DATA_ROOT;
  const theme = process.env.MYSTICWEB_BULLETIN_THEME || "default";
  if (!item || !root || !path.isAbsolute(root) || !/^[a-z0-9_-]+$/i.test(theme)) return null;
  const filename = path.join(root, "themes", theme, "text", item.textFile + ".asc");
  try {
    const stat = await lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_TEXT_BYTES) return null;
    const bytes = await readFile(filename);
    if (bytes.length > MAX_TEXT_BYTES) return null;
    return bytes.toString("latin1").replace(/\r\n?/g, "\n");
  } catch { return null; }
}
