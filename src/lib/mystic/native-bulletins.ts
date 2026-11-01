import "server-only";
import { readFile, lstat } from "node:fs/promises";
import path from "node:path";
import { plainMysticText } from "./text-format";

export type MysticBulletinEntry = { id: number; title: string; section: string };
export type MysticBulletin = MysticBulletinEntry & { subject: string; body: string; preview: string };
const MAX_BYTES = 256 * 1024;
const MAX_ENTRIES = 99;
const prefix = process.env.MYSTICWEB_BULLETIN_PREFIX || "bullet";
const menuName = process.env.MYSTICWEB_BULLETIN_MENU || "bulletin";

function textDirectory(): string | null {
  const root = process.env.MYSTIC_DATA_ROOT;
  const theme = process.env.MYSTICWEB_BULLETIN_THEME || "default";
  if (!root || !path.isAbsolute(root) || !/^[a-z0-9_-]+$/i.test(theme)) return null;
  return path.join(root, "themes", theme, "text");
}

function textFile(base: string): string | null {
  const dir = textDirectory();
  if (!dir || !/^[a-z0-9_-]{1,32}$/i.test(base)) return null;
  return path.join(dir, base + ".asc");
}

async function readText(base: string): Promise<string | null> {
  const file = textFile(base);
  if (!file) return null;
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES) return null;
    return (await readFile(file)).toString("latin1").replace(/\r\n?/g, "\n");
  } catch { return null; }
}

/** Extract numbered entries and headings from the displayed Mystic bulletin menu.
 * The MPL script uses a separate prefix to resolve the chosen number.
 */
export async function readMysticBulletinMenu(): Promise<MysticBulletinEntry[]> {
  const source = await readText(menuName);
  if (!source) return [];
  const lines = source.split("\n");
  const entries: MysticBulletinEntry[] = [];
  let section = "System Bulletins";
  const seen = new Set<number>();
  for (const line of lines) {
    // Exclude the large CP437/ANSI header: it is terminal artwork, not a menu item.
    const cleaned = plainMysticText(line).replace(/[\x00-\x1f\x7f-\x9f\xa0-\xff]/g, "").trim();
    if (!cleaned) continue;
    const match = /^\(\s*(\d{1,2})\s*\)\s*(.+)$/.exec(cleaned);
    if (match) {
      const id = Number(match[1]);
      if (id < 1 || id > MAX_ENTRIES || seen.has(id)) continue;
      seen.add(id);
      entries.push({ id, title: match[2].trim(), section });
    } else if (!/^\(\s*Q\s*\)/i.test(cleaned) && !/^\(?\s*new bulletins\b/i.test(cleaned)
      && !/^\(?\s*command\b/i.test(cleaned) && !/[█▓▒░]/.test(cleaned)) {
      // A plain text heading outside an option is a section heading.
      section = cleaned;
    }
  }
  return entries;
}

export async function readMysticBulletin(id: number): Promise<MysticBulletin | null> {
  if (!Number.isInteger(id) || id < 1 || id > MAX_ENTRIES || !/^[a-z0-9_-]{1,6}$/i.test(prefix)) return null;
  const entry = (await readMysticBulletinMenu()).find(item => item.id === id);
  if (!entry) return null;
  const source = await readText(prefix + id);
  if (!source) return null;
  const subjectOffset = source.indexOf("Subject:");
  const prose = subjectOffset >= 0 ? source.slice(subjectOffset) : source;
  const subject = subjectOffset >= 0 ? prose.split("\n", 1)[0] : "";
  const body = prose.replace(/^Subject:[^\n]*\n*/i, "").trim();
  const preview = plainMysticText(body).replace(/\s+/g, " ").slice(0, 180);
  return { ...entry, subject, body, preview };
}

export async function listMysticBulletins(limit = MAX_ENTRIES): Promise<MysticBulletin[]> {
  const menu = (await readMysticBulletinMenu()).slice(0, Math.max(0, Math.min(MAX_ENTRIES, limit)));
  const bulletins = await Promise.all(menu.map(entry => readMysticBulletin(entry.id)));
  return bulletins.filter((item): item is MysticBulletin => item !== null);
}
