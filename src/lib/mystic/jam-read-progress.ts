import { readFile } from "node:fs/promises";
import path from "node:path";
import { findJamLastRead, parseJamLastRead } from "./jam-last-read";

/** Read-only diagnostic against a single verified JAM base snapshot.
 * Does not claim to reproduce Mystic scan semantics for deleted/gapped bases.
 */
export interface JamReadProgress {
  readonly userId: number;
  readonly indexedEntries: number;
  readonly lastReadMsg: number;
  readonly highReadMsg: number;
  readonly candidateNewCount: number | null;
  readonly exact: boolean;
}

export function inspectJamReadProgress(index: Buffer, lastRead: Buffer, userId: number): JamReadProgress {
  if (!Number.isSafeInteger(userId) || userId < 1 || userId > 0xffffffff)
    throw new Error("Invalid JAM user identifier");
  if (!Buffer.isBuffer(index) || index.length % 8 !== 0 || index.length > 8 * 1000000)
    throw new Error("Invalid JAM index");
  const entry = findJamLastRead(parseJamLastRead(lastRead), userId);
  const indexedEntries = index.length / 8;
  if (!entry) return { userId, indexedEntries, lastReadMsg: 0, highReadMsg: 0,
    candidateNewCount: null, exact: false };
  // A sequential, non-deleted index is a useful diagnostic, but JAM index
  // offsets are not message numbers. Do not treat index count as a universal
  // high message number or publish this count as authoritative unread state.
  let hasDeletedEntries = false;
  for (let i = 0; i < index.length; i += 8) {
    if (index.readUInt32LE(i + 4) === 0xffffffff) {
      hasDeletedEntries = true;
      break;
    }
  }
  const candidateNewCount = !hasDeletedEntries && entry.lastReadMsg <= indexedEntries
    ? indexedEntries - entry.lastReadMsg : null;
  return { userId, indexedEntries, lastReadMsg: entry.lastReadMsg,
    highReadMsg: entry.highReadMsg, candidateNewCount, exact: false };
}

/** Diagnostic helper: explicit, trusted base directory and basename only. */
export async function inspectJamReadProgressFiles(root: string, base: string, userId: number): Promise<JamReadProgress> {
  if (!path.isAbsolute(root) || !/^[A-Za-z0-9_-]{1,80}$/.test(base))
    throw new Error("Invalid JAM diagnostic path");
  const [index, lastRead] = await Promise.all([
    readFile(path.join(root, base + ".jdx")),
    readFile(path.join(root, base + ".jlr")),
  ]);
  return inspectJamReadProgress(index, lastRead, userId);
}
