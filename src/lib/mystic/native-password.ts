import "server-only";
import { createHash, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { open, lstat } from "node:fs/promises";
import path from "node:path";

export const MYSTIC_USER_RECORD_SIZE = 1536;

/** Verified against controlled Mystic 1.12 A48 method-2 records.
 * This proves a password only, NOT account status or permission to log in.
 * Deliberately not wired to productionAccess until native account policy is mapped.
 */
export function verifyMysticPasswordRecord(record: Buffer, password: string): boolean {
  if (record.length !== MYSTIC_USER_RECORD_SIZE || typeof password !== "string" ||
      Buffer.byteLength(password, "utf8") > 256 || record[8] !== 2) return false;
  const iterations = record.readUInt32LE(9);
  if (iterations < 1 || iterations > 10_000_000) return false;
  const prehash = createHash("sha512").update(password, "utf8").digest();
  try {
    const derived = pbkdf2Sync(prehash, record.subarray(13, 45), iterations, 64, "sha512");
    return timingSafeEqual(derived, record.subarray(45, 109));
  } finally {
    prehash.fill(0);
  }
}

/** Read one account record from a configured, local, read-only users.dat.
 * Never use a browser-supplied filename. Refuse symlinks and malformed files.
 */
export async function verifyMysticPasswordFile(
  usersDatPath: string, userId: number, password: string,
): Promise<boolean> {
  if (!path.isAbsolute(usersDatPath) || !Number.isSafeInteger(userId) ||
      userId < 1 || userId > 0x7fffffff) return false;
  const st = await lstat(usersDatPath);
  if (!st.isFile() || st.isSymbolicLink() || st.size === 0 ||
      st.size % MYSTIC_USER_RECORD_SIZE !== 0 || st.size > 64 * 1024 * 1024) return false;
  const handle = await open(usersDatPath, "r");
  try {
    const record = Buffer.alloc(MYSTIC_USER_RECORD_SIZE);
    for (let offset = 0; offset < st.size; offset += MYSTIC_USER_RECORD_SIZE) {
      const { bytesRead } = await handle.read(record, 0, record.length, offset);
      if (bytesRead !== record.length) return false;
      if (record.readUInt32LE(0) === userId) return verifyMysticPasswordRecord(record, password);
    }
    return false;
  } finally {
    await handle.close();
  }
}
