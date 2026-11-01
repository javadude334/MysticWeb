import "server-only";
import { readFile, lstat } from "node:fs/promises";
import path from "node:path";
import { plainMysticText } from "./text-format";

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
    // Skip the terminal-only block-art header; preserve inline Mystic
    // color tokens in the actual bulletin body for web color rendering.
    const source = raw.toString("latin1");
    const subjectOffset = source.indexOf("Subject:");
    const prose = subjectOffset >= 0 ? source.slice(subjectOffset) : source;
    const normalized = prose.replace(/\r\n?/g, "\n");
    const afterSubject = normalized.replace(/^Subject:[^\n]*\n*/i, "");
    const body = afterSubject.trim();
    const clean = plainMysticText(body);
    return { id, title: titles[id - 1], body, preview: clean.replace(/\s+/g, " ").slice(0, 180) };
  } catch { return null; }
}

export async function listMysticBulletins(limit = 2): Promise<MysticBulletin[]> {
  const ids = [1, 2].slice(0, Math.max(0, Math.min(2, limit)));
  const results = await Promise.all(ids.map(readMysticBulletin));
  return results.filter((item): item is MysticBulletin => item !== null);
}
