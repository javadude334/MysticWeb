import "server-only";
import { open, lstat, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { encodeJamDraft, type JamDraftRecord } from "./jam-record-encoder";
import { isJamBaseName } from "./jam";

/**
 * OFFLINE ONLY. This lock is owned by MysticWeb and does not coordinate with
 * Mystic's native JAM locking. Never call while Mystic or a tosser can write.
 * A failed rollback leaves a lock in place and requires operator recovery.
 */
export async function appendOfflineJam(
  root: string, base: string, draft: Omit<JamDraftRecord, "number" | "messageId">,
  options: { offlineConfirmed: boolean },
): Promise<{ number: number; messageId: string }> {
  if (!options.offlineConfirmed || process.env.NODE_ENV === "production" ||
      process.env.MYSTICWEB_OFFLINE_JAM_WRITE !== "I_UNDERSTAND_OFFLINE_ONLY" ||
      !isJamBaseName(base) || !path.isAbsolute(root)) throw new Error("Offline JAM writing disabled");
  const resolved = await realpath(root);
  if (!(await lstat(resolved)).isDirectory()) throw new Error("Invalid JAM root");
  const lockPath = path.join(resolved, base + ".mysticweb-offline.lock");
  const lock = await open(lockPath, "wx", 0o600);
  let leaveLock = false;
  const handles = [];
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, created: new Date().toISOString() }));
    await lock.sync();
    const filenames = ["jhr", "jdx", "jdt"].map(ext => path.join(resolved, base + "." + ext));
    for (const filename of filenames) {
      const actual = await realpath(filename);
      if (path.dirname(actual) !== resolved || actual !== filename ||
          !(await lstat(actual)).isFile()) throw new Error("Unsafe JAM file");
      handles.push(await open(actual, "r+"));
    }
    const [jhr, jdx, jdt] = handles;
    const sizes = await Promise.all(handles.map(async h => (await h.stat()).size));
    if (sizes[0] < 1024 || sizes[1] % 8 !== 0 ||
        sizes.some(size => !Number.isSafeInteger(size) || size > 0xffffffff))
      throw new Error("Invalid JAM file sizes");
    const baseHeader = Buffer.alloc(24);
    if ((await jhr.read(baseHeader, 0, 24, 0)).bytesRead !== 24 ||
        baseHeader.toString("binary", 0, 4) !== "JAM\0" ||
        baseHeader.readUInt32LE(16) !== 0xffffffff)
      throw new Error("Unsupported or protected JAM base");
    const first = baseHeader.readUInt32LE(20);
    const number = first + sizes[1] / 8;
    if (first < 1 || number > 0xffffffff) throw new Error("Message number overflow");
    // Validate the parent and walk the sibling chain while the offline lock
    // is held. Refuse deleted entries, malformed links and cycles.
    let link: { offset: number; original: Buffer; updated: Buffer } | null = null;
    let replyId: string | undefined;
    if (draft.replyTo !== undefined) {
      if (!Number.isSafeInteger(draft.replyTo) || draft.replyTo < first || draft.replyTo >= number)
        throw new Error("Invalid reply parent");
      const seen = new Set<number>();
      let current = draft.replyTo;
      while (true) {
        if (seen.has(current)) throw new Error("Cyclic JAM reply chain");
        seen.add(current);
        const entry = Buffer.alloc(8);
        const slot = (current - first) * 8;
        if ((await jdx.read(entry, 0, 8, slot)).bytesRead !== 8)
          throw new Error("Missing reply message");
        const offset = entry.readUInt32LE(4);
        if (offset < 1024 || offset + 76 > sizes[0] || offset === 0xffffffff)
          throw new Error("Invalid reply message offset");
        const fixed = Buffer.alloc(76);
        if ((await jhr.read(fixed, 0, 76, offset)).bytesRead !== 76 ||
            fixed.toString("binary", 0, 4) !== "JAM\\0" ||
            fixed.readUInt16LE(4) !== 1 || fixed.readUInt32LE(48) !== current ||
            (fixed.readUInt32LE(52) & 0xbe380004) !== 0)
          throw new Error("Invalid reply message");
        const next = current === draft.replyTo ? fixed.readUInt32LE(28) : fixed.readUInt32LE(32);
        if (next === 0) {
          const updated = Buffer.from(fixed);
          updated.writeUInt32LE(number, current === draft.replyTo ? 28 : 32);
          link = { offset, original: fixed, updated };
          break;
        }
        if (next < first || next >= number) throw new Error("Invalid reply chain link");
        current = next;
      }
      // The reply ID is optional in JAM; numeric reply linkage is authoritative.
      replyId = undefined;
    }
    const messageId = "<" + randomUUID() + "@mysticweb.local>";
    const encoded = encodeJamDraft({ ...draft, replyId, number, messageId }, sizes[0], sizes[2]);
    const writes = [
      { handle: jdt, data: encoded.text, position: sizes[2] },
      { handle: jhr, data: encoded.header, position: sizes[0] },
      { handle: jdx, data: encoded.index, position: sizes[1] },
    ];
    async function writeFully(handle: typeof jhr, data: Buffer, position: number) {
      let written = 0;
      while (written < data.length) {
        const result = await handle.write(data, written, data.length - written, position + written);
        if (result.bytesWritten <= 0) throw new Error("Short JAM write");
        written += result.bytesWritten;
      }
    }
    let started = false;
    try {
      for (const { handle, data, position } of writes) {
        started = true;
        let written = 0;
        while (written < data.length) {
          const result = await handle.write(data, written, data.length - written, position + written);
          if (result.bytesWritten <= 0) throw new Error("Short JAM write");
          written += result.bytesWritten;
        }
        await handle.sync();
      }
      if (link) {
        await writeFully(jhr, link.updated, link.offset);
        await jhr.sync();
      }
      return { number, messageId };
    } catch (error) {
      if (started) {
        try {
          // Remove the child index first, restore parent linkage, then truncate.
          await jdx.truncate(sizes[1]);
          await jdx.sync();
          if (link) {
            await writeFully(jhr, link.original, link.offset);
            await jhr.sync();
          }
          // Reverse commit order: hide the index entry before removing data.
          for (const i of [1, 0, 2]) {
            await handles[i].truncate(sizes[i]);
            await handles[i].sync();
          }
        } catch {
          leaveLock = true;
          throw new Error("JAM rollback failed; offline lock retained for recovery");
        }
      }
      throw error;
    }
  } finally {
    await Promise.allSettled(handles.map(h => h.close()));
    await lock.close();
    if (!leaveLock) await unlink(lockPath);
  }
}
