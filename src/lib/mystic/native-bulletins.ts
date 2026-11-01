import "server-only";
import { readFile, lstat } from "node:fs/promises";
import path from "node:path";

export type MysticBulletin = { id: number; title: string; body: string; preview: string };
const titles = ["Welcome To Mystic BBS Software", "About This Bulletin Menu"];
const MAX_BYTES = 64 * 1024;

function bulletinPath(id: number): string | null {
  const root = process.env.MYSTIC_DATA_ROOT;
  if (!root || !path.isAbsolute(root) || !Number.isInteger(id) || id < 1 || id > 2) return null;
  return path.join(root, "themes", "default", "text", `bullet${id}.asc`);
}

/** Default Mystic A48 theme bulletin files. Read-only and restricted to known filenames. */
export async function readMysticBulletin(id: number): Promise<MysticBulletin | null> {
  const filename = bulletinPath(id);
  if (!filename) return null;
  try {
    const stat = await lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES) return null;
    const raw = await readFile(filename);
    // Mystic ANSI/ASCII artwork can include ANSI SGR and DOS line endings.
    const body = raw.toString("latin1").replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "").replace(/\r\n?/g, "\n").replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "");
    const clean = body.trim();
    return { id, title: titles[id - 1], body: clean, preview: clean.replace(/\s+/g, " ").slice(0, 180) };
  } catch { return null; }
}

export async function listMysticBulletins(limit = 2): Promise<MysticBulletin[]> {
  const ids = [1, 2].slice(0, Math.max(0, Math.min(2, limit)));
  const results = await Promise.all(ids.map(readMysticBulletin));
  return results.filter((item): item is MysticBulletin => item !== null);
}
