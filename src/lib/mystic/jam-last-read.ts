/** JAM .JLR last-read records: four little-endian uint32 fields per user.
 * Read-only decoding; no Mystic or JAM files are modified.
 */
export const JAM_LAST_READ_RECORD_BYTES = 16;

export interface JamLastReadRecord {
  readonly userCrc: number;
  readonly userId: number;
  readonly lastReadMsg: number;
  readonly highReadMsg: number;
}

export function parseJamLastRead(data: Buffer): JamLastReadRecord[] {
  if (!Buffer.isBuffer(data) || data.length % JAM_LAST_READ_RECORD_BYTES !== 0) {
    throw new Error("Invalid JAM last-read file size");
  }
  if (data.length > 16 * 65536) throw new Error("JAM last-read file exceeds safety limit");
  const records: JamLastReadRecord[] = [];
  const users = new Set<number>();
  for (let offset = 0; offset < data.length; offset += JAM_LAST_READ_RECORD_BYTES) {
    const record: JamLastReadRecord = {
      userCrc: data.readUInt32LE(offset),
      userId: data.readUInt32LE(offset + 4),
      lastReadMsg: data.readUInt32LE(offset + 8),
      highReadMsg: data.readUInt32LE(offset + 12),
    };
    if (record.userId === 0 || users.has(record.userId)) {
      throw new Error("Invalid or duplicate JAM last-read user identifier");
    }
    users.add(record.userId);
    records.push(record);
  }
  return records;
}

export function findJamLastRead(records: readonly JamLastReadRecord[], userId: number): JamLastReadRecord | undefined {
  if (!Number.isSafeInteger(userId) || userId < 1 || userId > 0xffffffff) return undefined;
  return records.find(record => record.userId === userId);
}

/**
 * Prepare a byte-for-byte-preserving update to an EXISTING user's JAM record.
 * No file I/O is performed here. Callers must hold a verified native-compatible
 * exclusive lock and re-read the record under that lock before committing.
 *
 * Only the immediately following message can advance the contiguous pointer:
 * jumping ahead would falsely mark intervening messages as read.
 */
export function prepareJamLastReadAdvance(data: Buffer, userId: number, messageNumber: number): Buffer | null {
  if (!Number.isSafeInteger(messageNumber) || messageNumber < 1 || messageNumber > 0xffffffff)
    throw new RangeError("Invalid JAM message number");
  const records = parseJamLastRead(data);
  const record = findJamLastRead(records, userId);
  if (!record || record.highReadMsg < record.lastReadMsg) return null;
  if (messageNumber <= record.lastReadMsg) return Buffer.from(data);
  if (messageNumber !== record.lastReadMsg + 1) return null;
  const offset = records.findIndex(item => item.userId === userId) * JAM_LAST_READ_RECORD_BYTES;
  const updated = Buffer.from(data);
  updated.writeUInt32LE(messageNumber, offset + 8);
  updated.writeUInt32LE(Math.max(record.highReadMsg, messageNumber), offset + 12);
  return updated;
}
