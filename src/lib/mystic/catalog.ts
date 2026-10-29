import "server-only";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { catalogRevision, type Catalog } from "./reader";
import { decodeJamText, isJamBaseName } from "./jam";

async function checked(filename: string) {
  for (let current = filename; ; current = path.dirname(current)) {
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw new Error("Linked catalog path");
    if (current === path.dirname(current)) break;
  }
  if (path.resolve(await realpath(filename)).toLowerCase() !== filename.toLowerCase()) throw new Error("Linked catalog path");
}

async function bounded(filename: string, recordSize: number) {
  await checked(filename);
  const file = await open(filename, "r");
  try {
    const before = await file.stat();
    if (!before.isFile() || before.size < recordSize || before.size > 512 * recordSize || before.size % recordSize) throw new Error("Unsupported catalog");
    const bytes = Buffer.alloc(before.size);
    if ((await file.read(bytes, 0, bytes.length, 0)).bytesRead !== bytes.length) throw new Error("Short catalog");
    const after = await file.stat(), current = await lstat(filename);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs ||
      current.isSymbolicLink() || current.dev !== before.dev || current.ino !== before.ino) throw new Error("Catalog changed");
    return bytes;
  } finally { await file.close(); }
}

function field(record: Buffer, offset: number, capacity: number) {
  if (record[offset] > capacity) throw new Error("Invalid catalog field");
  return record.subarray(offset + 1, offset + 1 + record[offset]);
}

/** Storage catalog only. ACS stays native; no inferred group or security-level grant.
 * Current NativeAccess supports public echo areas only. Local/private/netmail are
 * excluded until their separate policies are implemented and verified.
 */
export function parseReadOnlyCatalog(groups: Buffer, bases: Buffer, root: string, messageRoot: string): Catalog {
  if (!groups.length || groups.length % 206 || groups.length > 512 * 206 ||
    !bases.length || bases.length % 768 || bases.length > 512 * 768) throw new Error("Unsupported catalog");
  const groupIds = new Set<number>();
  for (let o = 0; o < groups.length; o += 206) {
    const r = groups.subarray(o, o + 206), id = r.readUInt32LE(0);
    if (!id || id > 0x7fffffff || groupIds.has(id)) throw new Error("Ambiguous group");
    groupIds.add(id); field(r, 4, 80); field(r, 167, 30);
  }
  const ids = new Set<number>(), names = new Set<string>(), storage = new Set<string>(), areas: Catalog["areas"][number][] = [];
  for (let o = 0; o < bases.length; o += 768) {
    const r = bases.subarray(o, o + 768), id = r.readUInt16LE(0);
    if (!id || ids.has(id)) throw new Error("Ambiguous area");
    ids.add(id);
    // A public area may never alias a private/netmail area's physical storage.
    // Resolve metadata lexically only; never open the configured target here.
    const storedBase = field(r, 138, 40).toString("latin1"), storedFolder = field(r, 179, 80).toString("latin1");
    const storageKey = path.resolve(root, storedFolder, storedBase).toLowerCase();
    if (storage.has(storageKey)) throw new Error("Aliased message storage");
    storage.add(storageKey);
    if (r[260] !== 1 || (r.readUInt32LE(577) & 16)) continue;
    const base = field(r, 138, 40).toString("latin1"), folder = field(r, 179, 80).toString("latin1");
    const nameBytes = field(r, 2, 60);
    if (!isJamBaseName(base) || names.has(base.toLowerCase()) || !nameBytes.length ||
      [...nameBytes].some(b => b < 32 || b === 127) || /[\x00-\x1f\x7f]/.test(folder)) throw new Error("Invalid public area");
    names.add(base.toLowerCase());
    const configured = path.resolve(root, folder), expected = path.resolve(messageRoot);
    const matches = process.platform === "win32" ? configured.toLowerCase() === expected.toLowerCase() : configured === expected;
    if (!matches) throw new Error("Unsupported message path");
    // Preserve original display characters; never interpret Mystic display codes.
    const name = decodeJamText(nameBytes).replace(/\|[0-9a-zA-Z]{2}/g, "").trim();
    if (!name) throw new Error("Invalid area name");
    areas.push({ id, name, jamBase: base });
  }
  return { revision: catalogRevision(groups, bases), areas };
}

export async function readReadOnlyCatalog(root: string, messageRoot: string): Promise<Catalog> {
  if (!path.isAbsolute(root) || !path.isAbsolute(messageRoot) || (process.platform === "win32" && /^d:/i.test(root))) throw new Error("Invalid sandbox root");
  const relative = path.relative(path.resolve(root), path.resolve(messageRoot));
  if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) throw new Error("Message root outside instance");
  await checked(path.resolve(messageRoot));
  const groupFile = path.resolve(root, "data/groups_g.dat"), areaFile = path.resolve(root, "data/mbases.dat");
  const groups = await bounded(groupFile, 206), bases = await bounded(areaFile, 768);
  const catalog = parseReadOnlyCatalog(groups, bases, root, messageRoot);
  // A stability check, not an atomic snapshot or an authorization decision.
  if (!(await bounded(groupFile, 206)).equals(groups) || !(await bounded(areaFile, 768)).equals(bases)) throw new Error("Catalog changed");
  return catalog;
}
