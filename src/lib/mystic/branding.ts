import "server-only";
import { cache } from "react";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { connection } from "next/server";
import { decodeJamText } from "./jam";

// A48 records.112: packed RecConfig, 9-byte DataChanged + two LongInts,
// then twelve String[80] path fields, followed by BBSName: String[30].
const NAME_OFFSET = 17 + 12 * 81;

export function parseBbsNameField(field: Buffer): string {
  if (field.length !== 31 || field[0] < 1 || field[0] > 30) throw new Error("Invalid board name");
  const bytes = field.subarray(1, 1 + field[0]);
  // Do not interpret terminal commands, Mystic color macros, or control bytes.
  if ([...bytes].some(b => b < 32 || b === 127)) throw new Error("Invalid board name");
  const name = decodeJamText(bytes).replace(/\|[0-9a-zA-Z]{2}/g, "").trim();
  if (!name) throw new Error("Invalid board name");
  return name;
}

export async function readBbsName(root: string): Promise<string> {
  if (!path.isAbsolute(root)) throw new Error("Invalid configuration root");
  const resolved = path.resolve(root);
  if (process.platform === "win32" && /^d:/i.test(resolved)) throw new Error("Production drive excluded");
  // A display name never follows configured SystemPath/DataPath into another BBS.
  for (let current = resolved; ; current = path.dirname(current)) {
    if ((await lstat(current)).isSymbolicLink()) throw new Error("Linked root excluded");
    if (current === path.dirname(current)) break;
  }
  const filename = path.join(resolved, "mystic.dat");
  const info = await lstat(filename);
  if (!info.isFile() || info.isSymbolicLink() || info.size !== 8192) throw new Error("Unsupported A48 configuration");
  if (path.resolve(await realpath(filename)).toLowerCase() !== filename.toLowerCase()) throw new Error("Linked configuration excluded");
  const file = await open(filename, "r");
  try {
    const before = await file.stat();
    if (before.dev !== info.dev || before.ino !== info.ino || before.size !== info.size) throw new Error("Configuration changed");
    const version = Buffer.alloc(9);
    if ((await file.read(version, 0, 9, 0)).bytesRead !== 9 || version[0] !== 8 || version.subarray(1).toString("ascii") !== "1.12 A47") throw new Error("Unsupported configuration version");
    const field = Buffer.alloc(31);
    if ((await file.read(field, 0, field.length, NAME_OFFSET)).bytesRead !== field.length) throw new Error("Short configuration");
    const after = await file.stat();
    if (after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs || after.size !== before.size) throw new Error("Configuration changed");
    return parseBbsNameField(field);
  } finally { await file.close(); }
}

export const configuredBbsName = cache(async (): Promise<string> => {
  await connection();
  const root = process.env.MYSTIC_DATA_ROOT;
  if (!root) return "MysticWeb";
  try { return await readBbsName(root); }
  catch { return "MysticWeb"; }
});
