import "server-only";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import { MYSTIC_USER_RECORD_SIZE } from "./native-password";

const MAX_USERS_FILE = 64 * 1024 * 1024;
const LOCKED = 0x00000001;
const DELETED_CANDIDATE = 0x00000004;
const FORCE_NEW_PASSWORD = 0x00000400;

export interface NativeAccountSnapshot {
  userId: number;
  securityLevel: number;
  locked: boolean;
  deletedCandidate: boolean;
  passwordChangeRequired: boolean;
  /** This installation has no separate account-expiration feature. */
}

/** Read-only lookup by permanent native user ID, not record index or handle.
 * Returns null for missing/ambiguous/malformed records and unsafe files.
 * This is a partial status snapshot, NOT a grant of login eligibility.
 */
export async function readNativeAccountSnapshot(
  usersDatPath: string, userId: number,
): Promise<NativeAccountSnapshot | null> {
  if (typeof usersDatPath !== "string" || !path.isAbsolute(usersDatPath) ||
      !Number.isSafeInteger(userId) || userId < 1 || userId > 0x7fffffff) return null;
  const stat = await lstat(usersDatPath);
  if (!stat.isFile() || stat.isSymbolicLink() || !stat.size ||
      stat.size > MAX_USERS_FILE || stat.size % MYSTIC_USER_RECORD_SIZE !== 0) return null;
  const file = await open(usersDatPath, "r");
  try {
    const record = Buffer.alloc(MYSTIC_USER_RECORD_SIZE);
    let result: NativeAccountSnapshot | null = null;
    for (let offset = 0; offset < stat.size; offset += MYSTIC_USER_RECORD_SIZE) {
      const { bytesRead } = await file.read(record, 0, record.length, offset);
      if (bytesRead !== record.length) return null;
      if (record.readUInt32LE(0) !== userId) continue;
      if (result) return null; // duplicate permanent IDs are ambiguous
      const flags = record.readUInt32LE(4);
      result = {
        userId,
        securityLevel: record.readUInt8(1006),
        locked: (flags & LOCKED) !== 0,
        deletedCandidate: (flags & DELETED_CANDIDATE) !== 0,
        passwordChangeRequired: (flags & FORCE_NEW_PASSWORD) !== 0,
      };
    }
    // Fail closed if file changes while reading, including same-length updates.
    const after = await file.stat();
    if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs ||
        after.ctimeMs !== stat.ctimeMs) return null;
    return result;
  } finally {
    await file.close();
  }
}
