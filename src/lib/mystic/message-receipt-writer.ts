import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, open, rename, rm, lstat } from "node:fs/promises";
import path from "node:path";
import { readUserMessageReceipt, type UserMessageReceipt } from "./message-sidecar";

/**
 * Explicitly scoped supplemental JSON writer. This never changes JAM or JLR.
 * Caller MUST authenticate the native user, authorize area read access and
 * resolve the message's stable sidecar ID before calling.
 */
export async function recordUserMessageRead(
  root: string, instanceId: string, areaId: number, userId: number,
  messageId: string, now = new Date(),
  pointer?: { baseline: number; contiguousRead: ReadonlyArray<{ number: number; id: string }> },
): Promise<UserMessageReceipt> {
  if (!path.isAbsolute(root) || !/^[A-Za-z0-9_-]{1,64}$/.test(instanceId) ||
      !Number.isSafeInteger(areaId) || areaId < 1 || areaId > 0xffffffff ||
      !Number.isSafeInteger(userId) || userId < 1 || userId > 0xffffffff ||
      !/^mw_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(messageId) ||
      !Number.isFinite(now.getTime())) throw new RangeError("Invalid read receipt input");

  const dir = path.join(root, "v1", "instances", instanceId, "areas", String(areaId), "users");
  // Refuse pre-existing symlinked path components rather than following them.
  let current = path.parse(dir).root;
  for (const segment of path.relative(current, dir).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const info = await lstat(current);
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Unsafe receipt directory");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await mkdir(current);
    }
  }
  const file = path.join(dir, String(userId) + ".json");
  const lock = file + ".lock";
  const lockHandle = await open(lock, "wx", 0o600); // Concurrent writers fail closed.
  let temp: string | null = null;
  try {
    const prior = await readUserMessageReceipt(root, instanceId, areaId, userId);
    const stamp = now.toISOString();
    const messages = { ...(prior?.messages ?? {}) };
    // Preserve the original read timestamp on repeated opens.
    if (!Object.hasOwn(messages, messageId)) messages[messageId] = { readAt: stamp };
    if (Object.keys(messages).length > 10000) throw new Error("Receipt capacity exceeded");
    // Pointer updates require a caller-verified contiguous JAM sequence and matching
    // persisted JSON receipts. Missing numbers cannot be silently skipped.
    let lastReadJamNumber = prior?.lastReadJamNumber ?? null;
    if (pointer) {
      if (!Number.isSafeInteger(pointer.baseline) || pointer.baseline < 0 || pointer.baseline > 0xffffffff ||
          !Array.isArray(pointer.contiguousRead) || pointer.contiguousRead.length > 10000)
        throw new RangeError("Invalid JSON pointer evidence");
      if (lastReadJamNumber !== null && pointer.baseline !== lastReadJamNumber)
        throw new Error("Stale JSON pointer baseline");
      let cursor = lastReadJamNumber ?? pointer.baseline;
      for (const item of pointer.contiguousRead) {
        if (!Number.isSafeInteger(item.number) || item.number !== cursor + 1 ||
            !/^mw_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(item.id) ||
            !Object.hasOwn(messages, item.id)) throw new Error("Noncontiguous or unread JAM pointer evidence");
        cursor = item.number;
      }
      lastReadJamNumber = cursor;
    }
    const receipt: UserMessageReceipt = {
      schemaVersion: 1, instanceId, userId, areaId, messages,
      ...(lastReadJamNumber === null ? {} : { lastReadJamNumber }), updatedAt: stamp,
    };
    const payload = JSON.stringify(receipt);
    if (Buffer.byteLength(payload) > 1048576) throw new Error("Receipt too large");
    temp = path.join(dir, "." + userId + "." + randomUUID() + ".tmp");
    const handle = await open(temp, "wx", 0o600);
    try {
      await handle.writeFile(payload, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temp, file);
    temp = null;
    return receipt;
  } finally {
    if (temp) await rm(temp, { force: true });
    await lockHandle.close();
    await rm(lock, { force: true });
  }
}
