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
    if (draft.replyTo) {
      if (!Number.isSafeInteger(draft.replyTo) || draft.replyTo < first || draft.replyTo >= number)
        throw new Error("Invalid reply parent");
      // This offline writer does not yet modify the parent's reply chain.
      // Refuse to create a misleading partial thread.
      throw new Error("Reply chain update not implemented");
    }
    const messageId = "<" + randomUUID() + "@mysticweb.local>";
    const encoded = encodeJamDraft({ ...draft, number, messageId }, sizes[0], sizes[2]);
    const writes = [
      { handle: jdt, data: encoded.text, position: sizes[2] },
      { handle: jhr, data: encoded.header, position: sizes[0] },
      { handle: jdx, data: encoded.index, position: sizes[1] },
    ];
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
      return { number, messageId };
    } catch (error) {
      if (started) {
        try {
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
