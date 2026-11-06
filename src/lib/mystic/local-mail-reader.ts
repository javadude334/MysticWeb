import "server-only";
import { open, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { decodeJamText, isJamBaseName, type JamMessage } from "./jam";
import { sameNativeHandle, type MailFolder } from "./mailbox";

const HIDDEN = 0x80000004;
const MAX_SCAN = 5000;
async function exact(file: Awaited<ReturnType<typeof open>>, size: number, position: number) {
  const b = Buffer.alloc(size);
  let done = 0;
  while (done < size) {
    const { bytesRead } = await file.read(b, done, size - done, position + done);
    if (!bytesRead) throw new Error("Truncated JAM record");
    done += bytesRead;
  }
  return b;
}
/** Dedicated private reader: never expose a message before matching the
 * authenticated native handle. This is not the public EchoMail reader.
 */
export async function readLocalMailbox(root: string, base: string, handle: string,
  options: { folder: MailFolder; before?: number; message?: number; limit?: number }) {
  if (!path.isAbsolute(root) || !isJamBaseName(base) ||
      !/^[\x21-\x7e]{1,30}$/.test(handle) ||
      (options.folder !== "inbox" && options.folder !== "sent")) throw new Error("Invalid mailbox");
  const limit = options.limit ?? 25;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50 ||
      [options.before, options.message].some(v => v !== undefined &&
        (!Number.isSafeInteger(v) || v < 1 || v > 0xffffffff))) throw new Error("Invalid mailbox query");
  const dir = await realpath(root);
  const handles: Awaited<ReturnType<typeof open>>[] = [];
  try {
    for (const ext of ["jhr", "jdx", "jdt"]) {
      const filename = path.join(dir, base + "." + ext);
      if (await realpath(filename) !== filename) throw new Error("Unsafe JAM file");
      handles.push(await open(filename, "r"));
    }
    const [header, index, text] = handles;
    const initial = await Promise.all(handles.map(h => h.stat({ bigint: true })));
    if (initial.some(s => !s.isFile()) || initial[0].size < BigInt(1024) ||
        initial[1].size % BigInt(8) !== BigInt(0)) throw new Error("Invalid JAM base");
    const baseHeader = await exact(header, 24, 0);
    if (baseHeader.toString("binary", 0, 4) !== "JAM\0" ||
        baseHeader.readUInt32LE(16) !== 0xffffffff) throw new Error("Unsupported JAM base");
    const first = baseHeader.readUInt32LE(20);
    const count = Number(initial[1].size / BigInt(8));
    if (!first || first + count - 1 > 0xffffffff) throw new Error("Invalid JAM index");
    let slot = options.message !== undefined ? options.message - first :
      Math.min(count - 1, (options.before ?? (first + count)) - first - 1);
    const messages: JamMessage[] = [];
    let scanned = 0;
    for (; slot >= 0 && slot < count && scanned < MAX_SCAN && messages.length < limit; slot--, scanned++) {
      const number = first + slot;
      const idx = await exact(index, 8, slot * 8);
      const offset = idx.readUInt32LE(4);
      if (offset === 0xffffffff) continue;
      if (offset < 1024 || BigInt(offset + 76) > initial[0].size) throw new Error("Invalid JAM offset");
      const fixed = await exact(header, 76, offset);
      if (fixed.toString("binary", 0, 4) !== "JAM\0" ||
          fixed.readUInt16LE(4) !== 1 || fixed.readUInt32LE(48) !== number) throw new Error("Invalid JAM header");
      const attributes = fixed.readUInt32LE(52);
      if ((attributes & HIDDEN) || fixed.readUInt32LE(56) !== 0 ||
          fixed.readUInt32LE(68) !== 0xffffffff) continue;
      const size = fixed.readUInt32LE(8);
      const bodyOffset = fixed.readUInt32LE(60), bodySize = fixed.readUInt32LE(64);
      if (size > 65536 || bodySize > 1048576 ||
          BigInt(offset + 76 + size) > initial[0].size ||
          BigInt(bodyOffset + bodySize) > initial[2].size) throw new Error("Invalid JAM field bounds");
      const fields = await exact(header, size, offset + 76);
      const values = new Map<number, Buffer>();
      let encoding = "CP437";
      for (let p = 0; p < fields.length;) {
        if (p + 8 > fields.length) throw new Error("Invalid JAM subfield");
        const id = fields.readUInt16LE(p), high = fields.readUInt16LE(p + 2), len = fields.readUInt32LE(p + 4);
        p += 8;
        if (len > fields.length - p) throw new Error("Invalid JAM subfield length");
        if (!high && [2, 3, 4, 5, 6].includes(id)) {
          if (values.has(id)) throw new Error("Duplicate JAM identity field");
          values.set(id, fields.subarray(p, p + len));
        }
        if (!high && id === 2000) {
          const charset = /^CHRS:\s+(\S+)\s+\d+\s*$/i.exec(fields.subarray(p, p + len).toString("ascii"));
          if (charset) encoding = charset[1];
        }
        p += len;
      }
      const field = (id: number) => decodeJamText(values.get(id) ?? Buffer.alloc(0), encoding);
      const author = field(2), recipient = field(3);
      const permitted = options.folder === "inbox" ?
        sameNativeHandle(recipient, handle) : sameNativeHandle(author, handle);
      if (!permitted) continue;
      messages.push({
        number, author, recipient, subject: field(6), attributes,
        dates: { written: fixed.readUInt32LE(36), received: fixed.readUInt32LE(40),
          processed: fixed.readUInt32LE(44), timezone: null },
        replyTo: fixed.readUInt32LE(24), firstReply: fixed.readUInt32LE(28),
        nextReply: fixed.readUInt32LE(32), messageId: field(4), replyId: field(5), encoding,
        ...(options.message === undefined ? {} : { body: decodeJamText(await exact(text, bodySize, bodyOffset), encoding) }),
      });
      if (options.message !== undefined) break;
    }
    const final = await Promise.all(handles.map(h => h.stat({ bigint: true })));
    const named = await Promise.all(["jhr", "jdx", "jdt"].map(ext => stat(path.join(dir, base + "." + ext), { bigint: true })));
    if (initial.some((s, i) => [final[i], named[i]].some(t =>
      s.dev !== t.dev || s.ino !== t.ino || s.size !== t.size ||
      s.mtimeNs !== t.mtimeNs || s.ctimeNs !== t.ctimeNs))) throw new Error("JAM changed during read");
    return { messages, nextBefore: slot >= 0 && options.message === undefined ? first + slot + 1 : null };
  } finally { await Promise.allSettled(handles.map(h => h.close())); }
}
