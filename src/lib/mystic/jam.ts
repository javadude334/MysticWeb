import "server-only";
import { open, realpath, stat, type FileHandle } from "node:fs/promises";
import path from "node:path";

// JAM-001, revision 1. All file handles are opened read-only; .jlr is untouched.
const SIGNATURE = Buffer.from([74, 65, 77, 0]);
const MAX_SUBFIELDS = 64 * 1024;
const MAX_BODY = 1024 * 1024;
const MAX_SCAN = 1000;
const HIDDEN = 0xbe380004; // deleted, nodisp, netmail, private, reserved/encoded attributes
const CP437 = Array.from("ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ");

export class JamError extends Error {
  constructor(public readonly code: "INVALID" | "CHANGED" | "UNAVAILABLE" | "ENCODING") {
    super(`Message database ${code.toLowerCase()}`);
  }
}

export function decodeJamText(bytes: Buffer, encoding = "CP437"): string {
  const name = encoding.toUpperCase().replace(/[_-]/g, "");
  let text: string;
  if (["CP437", "IBMPC", "IBM437"].includes(name)) {
    text = Array.from(bytes, b => b < 128 ? String.fromCharCode(b) : CP437[b - 128]).join("");
  } else {
    const label = ({ UTF8: "utf-8", CP1252: "windows-1252", WINDOWS1252: "windows-1252" } as Record<string, string>)[name];
    if (!label) throw new JamError("ENCODING");
    try { text = new TextDecoder(label, { fatal: true }).decode(bytes); }
    catch { throw new JamError("ENCODING"); }
  }
  // Plain text only: no terminal control execution, NULs or bidi overrides.
  return text.replace(/\r\n?/g, "\n").replace(/[\x00-\x08\x0b-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, "");
}

export interface JamMessage {
  number: number;
  author: string;
  recipient: string;
  subject: string;
  // JAM dates may be BBS-local wall time. Do not silently label these UTC.
  dates: { written: number; received: number; processed: number; timezone: string | null };
  attributes: number;
  replyTo: number;
  firstReply: number;
  nextReply: number;
  messageId: string;
  replyId: string;
  encoding: string;
  body?: string;
}

export function isJamBaseName(base: string): boolean {
  return /^[a-zA-Z0-9_][a-zA-Z0-9_&!'.-]{0,39}$/.test(base) && !base.includes("..");
}

async function exact(file: FileHandle, length: number, offset: number): Promise<Buffer> {
  const buffer = Buffer.alloc(length);
  let read = 0;
  while (read < length) {
    const result = await file.read(buffer, read, length - read, offset + read);
    if (!result.bytesRead) throw new JamError("INVALID");
    read += result.bytesRead;
  }
  return buffer;
}

function signature(b: Buffer) {
  if (!b.subarray(0, 4).equals(SIGNATURE)) throw new JamError("INVALID");
}

function inside(root: string, filename: string) {
  const relative = path.relative(root, filename);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

/** Internal storage API. base MUST come from trusted configuration, never a URL.
 * root is the operator-configured directory containing JAM bases, not the BBS root.
 * This module does not grant access. No page/API may call it without authorization.
 */
export async function readJam(
  root: string, base: string,
  options: { before?: number; limit?: number; message?: number } = {},
): Promise<{ messages: JamMessage[]; nextBefore: number | null; scanned: number; skipped: number }> {
  if (!isJamBaseName(base)) throw new JamError("INVALID");
  const limit = options.limit ?? 25;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50 ||
      [options.before, options.message].some(n => n !== undefined && (!Number.isSafeInteger(n) || n < 1 || n > 0xffffffff))) {
    throw new JamError("INVALID");
  }
  const handles: FileHandle[] = [];
  try {
    const resolvedRoot = await realpath(root);
    const filenames: string[] = [];
    for (const ext of ["jhr", "jdx", "jdt"]) {
      // Operator-mounted data is external to the application release. Do not
      // trace/bundle the project as though these were application asset paths.
      const filename = await realpath(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ resolvedRoot, `${base}.${ext}`));
      if (!inside(resolvedRoot, filename)) throw new JamError("INVALID");
      filenames.push(filename);
      handles.push(await open(filename, "r"));
    }
    const [header, index, text] = handles;
    const initial = await Promise.all(handles.map(h => h.stat({ bigint: true })));
    if (initial.some(s => !s.isFile()) || initial[0].size < BigInt(1024) || initial[1].size % BigInt(8) !== BigInt(0)) throw new JamError("INVALID");
    const info = await exact(header, 24, 0);
    signature(info);
    // Password protected conferences must not be shown, even if messages are public.
    if (info.readUInt32LE(16) !== 0xffffffff) throw new JamError("INVALID");
    const first = info.readUInt32LE(20);
    const count = Number(initial[1].size / BigInt(8));
    if (!first || first + count - 1 > 0xffffffff) throw new JamError("INVALID");
    let slot = options.message === undefined
      ? Math.min(count - 1, (options.before ?? (first + count)) - first - 1)
      : options.message - first;
    const messages: JamMessage[] = [];
    let scanned = 0, skipped = 0;
    for (; slot >= 0 && slot < count && scanned < MAX_SCAN && messages.length < limit; slot--) {
      const number = first + slot;
      scanned++;
      try {
        const entry = await exact(index, 8, slot * 8);
        const offset = entry.readUInt32LE(4);
        if (offset === 0xffffffff) { skipped++; continue; }
        if (offset < 1024 || BigInt(offset + 76) > initial[0].size) throw new JamError("INVALID");
        const fixed = await exact(header, 76, offset);
        signature(fixed);
        if (fixed.readUInt16LE(4) !== 1 || fixed.readUInt32LE(48) !== number) throw new JamError("INVALID");
        const attributes = fixed.readUInt32LE(52);
        if ((attributes & HIDDEN) !== 0 || fixed.readUInt32LE(56) !== 0 || fixed.readUInt32LE(68) !== 0xffffffff) { skipped++; continue; }
        const size = fixed.readUInt32LE(8), bodyOffset = fixed.readUInt32LE(60), bodySize = fixed.readUInt32LE(64);
        if (size > MAX_SUBFIELDS || BigInt(offset + 76 + size) > initial[0].size || bodySize > MAX_BODY || BigInt(bodyOffset + bodySize) > initial[2].size) throw new JamError("INVALID");
        const fields = await exact(header, size, offset + 76);
        const values = new Map<number, Buffer>();
        let encoding = "CP437";
        for (let p = 0; p < fields.length;) {
          if (p + 8 > fields.length) throw new JamError("INVALID");
          const id = fields.readUInt16LE(p), high = fields.readUInt16LE(p + 2), length = fields.readUInt32LE(p + 4);
          p += 8;
          if (length > fields.length - p) throw new JamError("INVALID");
          const value = fields.subarray(p, p + length);
          if (!high && [2, 3, 4, 5, 6, 2004].includes(id)) {
            if (values.has(id)) throw new JamError("INVALID");
            values.set(id, value);
          }
          if (!high && id === 2000) {
            const charset = /^CHRS:\s+(\S+)\s+\d+\s*$/i.exec(value.toString("ascii"));
            if (charset) encoding = charset[1];
          }
          p += length;
        }
        const field = (id: number) => decodeJamText(values.get(id) ?? Buffer.alloc(0), encoding);
        const message: JamMessage = {
          number, attributes, author: field(2), recipient: field(3), subject: field(6),
          dates: { written: fixed.readUInt32LE(36), received: fixed.readUInt32LE(40), processed: fixed.readUInt32LE(44), timezone: values.has(2004) ? field(2004) : null },
          replyTo: fixed.readUInt32LE(24), firstReply: fixed.readUInt32LE(28), nextReply: fixed.readUInt32LE(32),
          messageId: field(4), replyId: field(5), encoding,
        };
        if (options.message !== undefined) message.body = decodeJamText(await exact(text, bodySize, bodyOffset), encoding);
        messages.push(message);
      } catch (error) {
        if (!(error instanceof JamError)) throw error;
        skipped++;
      } finally {
        if (options.message !== undefined) slot = -1;
      }
    }
    const final = await Promise.all(handles.map(h => h.stat({ bigint: true })));
    const named = await Promise.all(filenames.map(f => stat(f, { bigint: true })));
    const changed = initial.some((s, i) => [final[i], named[i]].some(t =>
      s.dev !== t.dev || s.ino !== t.ino || s.size !== t.size || s.mtimeNs !== t.mtimeNs || s.ctimeNs !== t.ctimeNs));
    if (changed || !(await exact(header, 24, 0)).equals(info)) throw new JamError("CHANGED");
    return { messages, nextBefore: options.message === undefined && slot >= 0 ? first + slot + 1 : null, scanned, skipped };
  } catch (error) {
    if (error instanceof JamError) throw error;
    throw new JamError("UNAVAILABLE");
  } finally {
    await Promise.all(handles.map(h => h.close()));
  }
}
