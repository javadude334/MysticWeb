import "server-only";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";

/**
 * Directory fields observed in the supplied 8192-byte Mystic 1.12 A47
 * MYSTIC.DAT sample. This is deliberately version-gated: do not silently
 * parse other Mystic layouts using these offsets.
 */
const RECORD_BYTES = 8192;
const FIELD_BYTES = 81;
const ROOT_OFFSET = 17;
const DATA_OFFSET = ROOT_OFFSET + FIELD_BYTES;
const MESSAGE_OFFSET = ROOT_OFFSET + 3 * FIELD_BYTES;

function pascalPath(bytes: Buffer, offset: number): string {
  const length = bytes[offset];
  if (length < 1 || length > 80) throw new Error("Invalid Mystic directory field");
  const value = bytes.subarray(offset + 1, offset + 1 + length).toString("latin1");
  if (/[\x00-\x1f]/.test(value)) throw new Error("Invalid Mystic directory");
  return value;
}

export interface MysticDirectories {
  rootDir: string;
  dataDir: string;
  messageDir: string;
  databasePath: string;
  windowsRoot?: string;
}

/** Map absolute Windows Mystic paths to a Linux-mounted installation.
 * Reject paths outside the installation, including symlink escapes.
 */
export function resolveMysticPath(directories: MysticDirectories, windowsPath: string): string {
  if (!directories.windowsRoot) return path.win32.resolve(windowsPath);
  const win = path.win32;
  if (!win.isAbsolute(windowsPath) || !/^[a-z]:\\/i.test(windowsPath))
    throw new Error("Invalid absolute Windows Mystic path");
  const relative = win.relative(directories.windowsRoot, win.resolve(windowsPath));
  if (relative === ".." || relative.startsWith(".." + win.sep) || win.isAbsolute(relative))
    throw new Error("Mystic path escapes the configured installation");
  const mapped = path.resolve(directories.rootDir, ...relative.split(win.sep).filter(Boolean));
  const root = realpathSync.native(directories.rootDir);
  const resolved = realpathSync.native(mapped);
  const physicalRelative = path.relative(root, resolved);
  if (physicalRelative === ".." || physicalRelative.startsWith(".." + path.sep) || path.isAbsolute(physicalRelative))
    throw new Error("Mystic path escapes the mounted installation");
  return resolved;
}

/** Windows paths in MYSTIC.DAT are parsed with win32 on all hosts. */
export function parseMysticDirectories(bytes: Buffer, configuredRoot: string): MysticDirectories {
  if (bytes.length !== RECORD_BYTES || bytes[0] !== 8 ||
      bytes.subarray(1, 9).toString("ascii") !== "1.12 A47") {
    throw new Error("Unsupported MYSTIC.DAT layout; directory discovery unavailable");
  }
  const win = path.win32;
  const fromFile = win.resolve(pascalPath(bytes, ROOT_OFFSET));
  if (!/^[a-z]:\\/i.test(fromFile)) throw new Error("Invalid Mystic installation root");
  const linuxMount = process.platform !== "win32" && path.posix.isAbsolute(configuredRoot);
  if (!linuxMount) {
    const root = win.resolve(configuredRoot);
    if (!win.isAbsolute(configuredRoot) || !/^[a-z]:\\/i.test(root))
      throw new Error("A local absolute Windows Mystic root is required");
    if (fromFile.toLowerCase() !== root.toLowerCase())
      throw new Error("MYSTIC.DAT installation root does not match MYSTIC_DATA_ROOT");
    function resolveField(offset: number): string {
      const resolved = win.resolve(root, pascalPath(bytes, offset));
      if (!/^[a-z]:\\/i.test(resolved)) throw new Error("Invalid Mystic directory path");
      return resolved;
    }
    const dataDir = resolveField(DATA_OFFSET);
    const messageDir = resolveField(MESSAGE_OFFSET);
    return { rootDir: root, dataDir, messageDir, databasePath: win.join(dataDir, "mysticweb.db") };
  }
  const root = realpathSync.native(configuredRoot);
  const base: MysticDirectories = {
    rootDir: root, dataDir: root, messageDir: root,
    databasePath: path.join(root, "data", "mysticweb.db"), windowsRoot: fromFile,
  };
  const dataDir = resolveMysticPath(base, win.resolve(fromFile, pascalPath(bytes, DATA_OFFSET)));
  const messageDir = resolveMysticPath(base, win.resolve(fromFile, pascalPath(bytes, MESSAGE_OFFSET)));
  return { ...base, dataDir, messageDir, databasePath: path.join(dataDir, "mysticweb.db") };
}

let cached: MysticDirectories | undefined;

/** Read once per Node process. Changes to MYSTIC.DAT require a restart. */
export function mysticDirectories(): MysticDirectories {
  if (cached) return cached;
  const root = process.env.MYSTIC_DATA_ROOT;
  if (!root) throw new Error("MYSTIC_DATA_ROOT is required");
  const config = readFileSync(path.join(root, "mystic.dat"));
  const parsed = parseMysticDirectories(config, root);
  cached = Object.freeze(parsed);
  return cached;
}
