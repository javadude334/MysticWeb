import "server-only";
import path from "node:path";
import { lstat, open, realpath } from "node:fs/promises";
import { prepareJamLastReadAdvance, parseJamLastRead } from "./jam-last-read";

/**
 * OFFLINE SANDBOX TOOL ONLY. Do not invoke from an HTTP request or while
 * Mystic can access the same base. A lock file is NOT Mystic's native lock.
 *
 * Writes only the existing user's 8-byte last/high pointer pair, in place,
 * after re-reading the complete .jlr. Never replaces the file or adds users.
 * This cannot guarantee safety against an independently running Mystic.
 */
export async function advanceOfflineSandboxJamPointer(
  sandboxRoot: string, jamRoot: string, base: string, userId: number,
  messageNumber: number, offlineConfirmed: boolean,
): Promise<"advanced" | "already-read" | "gap-or-missing"> {
  if (process.env.NODE_ENV !== "development" ||
      process.env.MYSTICWEB_OFFLINE_JLR_TEST !== "I_HAVE_STOPPED_MYSTIC" ||
      !offlineConfirmed)
    throw new Error("Offline JAM writes are disabled");
  if (!path.isAbsolute(sandboxRoot) || !path.isAbsolute(jamRoot) ||
      !/^[A-Za-z0-9_.-]{1,80}$/.test(base) || base === "." || base === ".." ||
      !Number.isSafeInteger(userId) || userId < 1 || userId > 0xffffffff)
    throw new Error("Invalid sandbox pointer request");
  const [sandbox, directory] = await Promise.all([realpath(sandboxRoot), realpath(jamRoot)]);
  const relative = path.relative(sandbox, directory);
  if (!relative || relative === ".." || relative.startsWith(".." + path.sep) ||
      path.isAbsolute(relative)) throw new Error("JAM root is outside disposable sandbox");
  const [rootStat, jamStat] = await Promise.all([lstat(sandboxRoot), lstat(jamRoot)]);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() ||
      !jamStat.isDirectory() || jamStat.isSymbolicLink())
    throw new Error("Unsafe sandbox directory");
  const filename = path.join(directory, base + ".jlr");
  const stat = await lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1048576)
    throw new Error("Unsafe pointer file");
  const resolved = await realpath(filename);
  if (path.dirname(resolved) !== directory) throw new Error("Unsafe pointer path");

  // This exclusive marker only serializes cooperating offline test writers.
  // It must NEVER be presented as compatibility with Mystic's own locking.
  const marker = filename + ".mysticweb-offline.lock";
  const lock = await open(marker, "wx", 0o600);
  try {
    const file = await open(filename, "r+");
    try {
      const currentStat = await file.stat();
      if (!currentStat.isFile() || currentStat.size !== stat.size ||
          currentStat.size > 1048576 || currentStat.ino !== stat.ino ||
          currentStat.dev !== stat.dev) throw new Error("Pointer file changed");
      const bytes = Buffer.alloc(currentStat.size);
      const read = await file.read(bytes, 0, bytes.length, 0);
      if (read.bytesRead !== bytes.length) throw new Error("Short pointer read");
      const updated = prepareJamLastReadAdvance(bytes, userId, messageNumber);
      if (!updated) return "gap-or-missing";
      const records = parseJamLastRead(bytes);
      const index = records.findIndex(record => record.userId === userId);
      if (index < 0) return "gap-or-missing";
      const offset = index * 16 + 8;
      if (updated.equals(bytes)) return "already-read";
      // One 8-byte update to the same record, not a wholesale file rewrite.
      // Offline only: this is not crash-atomic or safe against Mystic processes.
      const write = await file.write(updated.subarray(offset, offset + 8), 0, 8, offset);
      if (write.bytesWritten !== 8) throw new Error("Short pointer write");
      await file.sync();
      return "advanced";
    } finally { await file.close(); }
  } finally {
    await lock.close();
    const { unlink } = await import("node:fs/promises");
    await unlink(marker);
  }
}
