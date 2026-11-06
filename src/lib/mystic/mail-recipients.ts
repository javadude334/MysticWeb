import "server-only";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import { MYSTIC_USER_RECORD_SIZE } from "./native-password";

const MAX_USERS_BYTES = 64 * 1024 * 1024;
const DISABLED_FLAGS = 0x00000001 | 0x00000004 | 0x00000400;
export interface LocalRecipient {
  readonly userId: number;
  readonly handle: string;
  readonly realName: string | null;
}
function pascalName(record: Buffer, offset: number): string | null {
  const length = record[offset];
  if (!length || length > 30) return null;
  const bytes = record.subarray(offset + 1, offset + 1 + length);
  if (bytes.some(byte => byte < 0x20 || byte > 0x7e)) return null;
  return bytes.toString("ascii");
}
function validName(name: string): boolean {
  return typeof name === "string" && name.length > 0 && name.length <= 30 &&
    /^[\x20-\x7e]+$/.test(name) && name.trim() === name;
}
/** Searches native Mystic A48 users.dat without returning passwords or flags.
 * A matching handle or real name is not sufficient to send: the caller must
 * select a unique permanent ID, then resolve it again immediately before post.
 */
export async function searchLocalRecipients(usersPath: string, query: string, limit = 10): Promise<LocalRecipient[]> {
  if (!path.isAbsolute(usersPath) || !validName(query) || query.length < 2 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 20) return [];
  const st = await lstat(usersPath);
  if (!st.isFile() || st.isSymbolicLink() || !st.size ||
      st.size > MAX_USERS_BYTES || st.size % MYSTIC_USER_RECORD_SIZE !== 0) return [];
  const file = await open(usersPath, "r");
  try {
    const record = Buffer.alloc(MYSTIC_USER_RECORD_SIZE);
    const matches: LocalRecipient[] = [];
    const seen = new Set<number>();
    for (let offset = 0; offset < st.size; offset += MYSTIC_USER_RECORD_SIZE) {
      if ((await file.read(record, 0, record.length, offset)).bytesRead !== record.length) return [];
      const userId = record.readUInt32LE(0);
      if (userId < 1 || userId > 0x7fffffff || (record.readUInt32LE(4) & DISABLED_FLAGS)) continue;
      const handle = pascalName(record, 109);
      const realName = pascalName(record, 140);
      if (!handle) continue;
      if (!([handle, realName].some(value => value?.toLowerCase().includes(query.toLowerCase())))) continue;
      if (seen.has(userId)) return [];
      seen.add(userId);
      matches.push({ userId, handle, realName });
      if (matches.length > limit) return []; // ambiguous/unbounded result; refine query
    }
    const after = await file.stat();
    if (after.size !== st.size || after.mtimeMs !== st.mtimeMs || after.ctimeMs !== st.ctimeMs) return [];
    return matches;
  } finally { await file.close(); }
}
/** Must be called at send time; rejects deleted/disabled/duplicate user IDs. */
export async function resolveLocalRecipient(usersPath: string, userId: number): Promise<LocalRecipient | null> {
  if (!path.isAbsolute(usersPath) || !Number.isSafeInteger(userId) || userId < 1 ||
      userId > 0x7fffffff) return null;
  const st = await lstat(usersPath);
  if (!st.isFile() || st.isSymbolicLink() || !st.size ||
      st.size > MAX_USERS_BYTES || st.size % MYSTIC_USER_RECORD_SIZE !== 0) return null;
  const file = await open(usersPath, "r");
  try {
    const record = Buffer.alloc(MYSTIC_USER_RECORD_SIZE);
    let found: LocalRecipient | null = null;
    for (let offset = 0; offset < st.size; offset += MYSTIC_USER_RECORD_SIZE) {
      if ((await file.read(record, 0, record.length, offset)).bytesRead !== record.length) return null;
      if (record.readUInt32LE(0) !== userId) continue;
      if (found || (record.readUInt32LE(4) & DISABLED_FLAGS)) return null;
      const handle = pascalName(record, 109);
      if (!handle) return null;
      found = { userId, handle, realName: pascalName(record, 140) };
    }
    const after = await file.stat();
    if (after.size !== st.size || after.mtimeMs !== st.mtimeMs || after.ctimeMs !== st.ctimeMs) return null;
    return found;
  } finally { await file.close(); }
}
