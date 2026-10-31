import "server-only";
import { open, lstat } from "node:fs/promises";
import path from "node:path";
import { MYSTIC_USER_RECORD_SIZE, verifyMysticPasswordRecord } from "./native-password";

const LOCKED = 0x00000001;
const DELETED = 0x00000004;
const FORCE_PASSWORD_CHANGE = 0x00000400;
const MAX_USERS_FILE = 64 * 1024 * 1024;

/** Layout established with two controlled A48 sandbox records:
 * handle = Pascal String[30] at offset 109; real name = String[30] at 140.
 * Only handle is accepted until native login alias rules are confirmed.
 */
function pascalName(record: Buffer, offset: number): string | null {
  const length = record[offset];
  if (length < 1 || length > 30) return null;
  const raw = record.subarray(offset + 1, offset + 1 + length);
  // Fail closed on non-ASCII handles until Mystic's exact case/encoding
  // semantics have been validated against the binary.
  if (raw.some(byte => byte < 0x21 || byte > 0x7e)) return null;
  return raw.toString("ascii");
}

export interface NativeLoginResult { userId: number }

/** Read-only candidate login. This is NOT a complete native policy adapter:
 * expiration, legacy password methods, name aliases, and live status
 * revalidation must be implemented before production session issuance.
 */
export async function verifyMysticHandle(
  usersDatPath: string, handle: string, password: string,
): Promise<NativeLoginResult | null> {
  if (!path.isAbsolute(usersDatPath) || typeof handle !== "string" ||
      typeof password !== "string" || !/^[\x21-\x7e]{1,30}$/.test(handle) ||
      Buffer.byteLength(password, "utf8") > 256 || !password) return null;
  const stat = await lstat(usersDatPath);
  if (!stat.isFile() || stat.isSymbolicLink() || !stat.size ||
      stat.size > MAX_USERS_FILE || stat.size % MYSTIC_USER_RECORD_SIZE !== 0) return null;
  const file = await open(usersDatPath, "r");
  try {
    const record = Buffer.alloc(MYSTIC_USER_RECORD_SIZE);
    let matched: NativeLoginResult | null = null;
    let matches = 0;
    for (let offset = 0; offset < stat.size; offset += MYSTIC_USER_RECORD_SIZE) {
      const { bytesRead } = await file.read(record, 0, record.length, offset);
      if (bytesRead !== record.length) return null;
      const nativeHandle = pascalName(record, 109);
      if (!nativeHandle || nativeHandle.toLowerCase() !== handle.toLowerCase()) continue;
      matches++;
      // Reject duplicates rather than accepting an ambiguous account.
      if (matches !== 1) return null;
      const userId = record.readUInt32LE(0);
      const flags = record.readUInt32LE(4);
      if (userId < 1 || userId > 0x7fffffff ||
          (flags & (LOCKED | DELETED | FORCE_PASSWORD_CHANGE)) !== 0 ||
          !verifyMysticPasswordRecord(record, password)) return null;
      matched = { userId };
    }
    return matched;
  } finally {
    await file.close();
  }
}
