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

// Unicode Consortium CP850 mapping: https://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/PC/CP850.TXT
const CP850 = [0xc7,0xfc,0xe9,0xe2,0xe4,0xe0,0xe5,0xe7,0xea,0xeb,0xe8,0xef,0xee,0xec,0xc4,0xc5,0xc9,0xe6,0xc6,0xf4,0xf6,0xf2,0xfb,0xf9,0xff,0xd6,0xdc,0xf8,0xa3,0xd8,0xd7,0x192,0xe1,0xed,0xf3,0xfa,0xf1,0xd1,0xaa,0xba,0xbf,0xae,0xac,0xbd,0xbc,0xa1,0xab,0xbb,0x2591,0x2592,0x2593,0x2502,0x2524,0xc1,0xc2,0xc0,0xa9,0x2563,0x2551,0x2557,0x255d,0xa2,0xa5,0x2510,0x2514,0x2534,0x252c,0x251c,0x2500,0x253c,0xe3,0xc3,0x255a,0x2554,0x2569,0x2566,0x2560,0x2550,0x256c,0xa4,0xf0,0xd0,0xca,0xcb,0xc8,0x131,0xcd,0xce,0xcf,0x2518,0x250c,0x2588,0x2584,0xa6,0xcc,0x2580,0xd3,0xdf,0xd4,0xd2,0xf5,0xd5,0xb5,0xfe,0xde,0xda,0xdb,0xd9,0xfd,0xdd,0xaf,0xb4,0xad,0xb1,0x2017,0xbe,0xb6,0xa7,0xf7,0xb8,0xb0,0xa8,0xb7,0xb9,0xb3,0xb2,0x25a0,0xa0].map(v => String.fromCodePoint(v));

export class JamError extends Error {
  constructor(public readonly code: "INVALID" | "CHANGED" | "UNAVAILABLE" | "ENCODING") {
    super(`Message database ${code.toLowerCase()}`);
  }
}

export function decodeJamText(bytes: Buffer, encoding = "CP437"): string {
  const name = encoding.toUpperCase().replace(/[_-]/g, "");
  let text: string;
  if (["ASCII", "USASCII"].includes(name)) {
    if (bytes.some(b => b > 127)) throw new JamError("ENCODING");
    text = bytes.toString("ascii");
  } else if (["CP850", "IBM850"].includes(name)) {
    text = Array.from(bytes, b => b < 128 ? String.fromCharCode(b) : CP850[b - 128]).join("");
  } else if (["CP437", "IBMPC", "IBM437"].includes(name)) {
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
