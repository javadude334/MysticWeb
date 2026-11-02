import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type SysopMenuItem = { id: string; title: string; textFile: string };
export type SysopMenu = { id: string; title: string; description: string; items: SysopMenuItem[] };
const slug = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const MAX_CONFIG_BYTES = 64 * 1024;
function validString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}
function parseMenuConfig(value: unknown): SysopMenu[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid SysOp menu configuration");
  const raw = (value as { menus?: unknown }).menus;
  if (!Array.isArray(raw) || raw.length > 20) throw new Error("Invalid SysOp menu count");
  const ids = new Set<string>();
  return raw.map((menu): SysopMenu => {
    if (!menu || typeof menu !== "object" || Array.isArray(menu)) throw new Error("Invalid menu");
    const m = menu as Record<string, unknown>;
    if (!validString(m.id, 32) || !slug.test(m.id) || ids.has(m.id) ||
        !validString(m.title, 100) || typeof m.description !== "string" || m.description.length > 300 ||
        !Array.isArray(m.items) || m.items.length > 30) throw new Error("Invalid menu definition");
    ids.add(m.id);
    const itemIds = new Set<string>();
    const items = m.items.map((item): SysopMenuItem => {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Invalid menu item");
      const i = item as Record<string, unknown>;
      if (!validString(i.id, 32) || !slug.test(i.id) || itemIds.has(i.id) ||
          !validString(i.title, 100) || !validString(i.textFile, 32) || !slug.test(i.textFile)) {
        throw new Error("Invalid menu item");
      }
      itemIds.add(i.id);
      return { id: i.id, title: i.title, textFile: i.textFile };
    });
    return { id: m.id, title: m.title, description: m.description, items };
  });
}

/** Operator-controlled JSON, never JavaScript evaluation or a caller-selected file. */
export async function getSysopMenus(): Promise<SysopMenu[]> {
  const filename = path.join(process.cwd(), "config", "sysop-menus.json");
  const stat = await import("node:fs/promises").then(fs => fs.lstat(filename));
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_CONFIG_BYTES) throw new Error("Invalid SysOp menu configuration file");
  const bytes = await readFile(filename);
  if (bytes.length > MAX_CONFIG_BYTES) throw new Error("SysOp menu configuration too large");
  return parseMenuConfig(JSON.parse(bytes.toString("utf8")) as unknown);
}
export async function getSysopMenu(id: string): Promise<SysopMenu | undefined> {
  if (!slug.test(id)) return undefined;
  return (await getSysopMenus()).find(menu => menu.id === id);
}
export async function getSysopMenuItem(menuId: string, itemId: string): Promise<SysopMenuItem | undefined> {
  const menu = await getSysopMenu(menuId);
  return menu?.items.find(item => item.id === itemId);
}
