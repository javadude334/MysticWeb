import "server-only";

/**
 * JAM revision 1 record encoding. This module only constructs bytes.
 * It does not open, lock, or mutate a JAM base. A native-compatible
 * transactional writer must own synchronization and commit ordering.
 */
export interface JamDraftRecord {
  number: number;
  author: string;
  recipient: string;
  subject: string;
  body: string;
  timestamp: number;
  replyTo?: number;
  messageId: string;
  replyId?: string;
}

function uint(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff;
}

function subfield(id: number, value: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt16LE(id, 0);
  header.writeUInt32LE(value.length, 4);
  return Buffer.concat([header, value]);
}

export function encodeJamDraft(draft: JamDraftRecord, headerOffset: number, textOffset: number): {
  header: Buffer; text: Buffer; index: Buffer;
} {
  if (![draft.number, draft.timestamp, draft.replyTo ?? 0, headerOffset, textOffset].every(uint) ||
      draft.number === 0 || headerOffset < 1024 || !draft.messageId ||
      draft.body.length === 0 || draft.body.length > 65536 ||
      [draft.author, draft.recipient, draft.subject, draft.messageId, draft.replyId ?? ""].some(
        s => /[\x00-\x1f\x7f]/.test(s) || Buffer.byteLength(s, "utf8") > 255
      ) || /[\x00\x1b\x7f]/.test(draft.body)) {
    throw new Error("Invalid JAM draft");
  }
  const text = Buffer.from(draft.body.replace(/\r?\n/g, "\r"), "utf8");
  if (text.length > 65536 || textOffset + text.length > 0xffffffff) throw new Error("JAM text overflow");
  const fields = Buffer.concat([
    subfield(2, Buffer.from(draft.author, "utf8")),
    subfield(3, Buffer.from(draft.recipient, "utf8")),
    subfield(6, Buffer.from(draft.subject, "utf8")),
    subfield(4, Buffer.from(draft.messageId, "utf8")),
    ...(draft.replyId ? [subfield(5, Buffer.from(draft.replyId, "utf8"))] : []),
    subfield(2000, Buffer.from("CHRS: UTF-8 4", "ascii")),
  ]);
  if (headerOffset + 76 + fields.length > 0xffffffff) throw new Error("JAM header overflow");
  const header = Buffer.alloc(76);
  header.write("JAM\0", 0, "binary");
  header.writeUInt16LE(1, 4);
  header.writeUInt32LE(fields.length, 8);
  header.writeUInt32LE(draft.replyTo ?? 0, 24);
  header.writeUInt32LE(draft.timestamp, 36);
  header.writeUInt32LE(draft.number, 48);
  // Match attributes observed on locally posted Mystic A48 echo messages.
  header.writeUInt32LE(0x01000001, 52);
  header.writeUInt32LE(textOffset, 60);
  header.writeUInt32LE(text.length, 64);
  header.writeUInt32LE(0xffffffff, 68);
  const index = Buffer.alloc(8);
  index.writeUInt32LE(0xffffffff, 0);
  index.writeUInt32LE(headerOffset, 4);
  return { header: Buffer.concat([header, fields]), text, index };
}
