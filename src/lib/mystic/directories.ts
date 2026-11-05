import "server-only";
import { readFileSync } from "node:fs";
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
}

/** Windows paths are parsed with win32 regardless of the build host. */
export function parseMysticDirectories(bytes: Buffer, configuredRoot: string): MysticDirectories {
  if (bytes.length !== RECORD_BYTES || bytes[0] !== 8 ||
      bytes.subarray(1, 9).toString("ascii") !== "1.12 A47") {
    throw new Error("Unsupported MYSTIC.DAT layout; directory discovery unavailable");
  }
  const win = path.win32;
  const root = win.resolve(configuredRoot);
  if (!win.isAbsolute(configuredRoot) || !/^[a-z]:\\/i.test(root)) {
    throw new Error("A local absolute Windows Mystic root is required");
  }
  const fromFile = win.resolve(pascalPath(bytes, ROOT_OFFSET));
  if (fromFile.toLowerCase() !== root.toLowerCase()) {
    throw new Error("MYSTIC.DAT installation root does not match MYSTIC_DATA_ROOT");
  }
  function resolveField(offset: number): string {
    const raw = pascalPath(bytes, offset);
    const resolved = win.resolve(root, raw);
    if (!win.isAbsolute(resolved) || !/^[a-z]:\\/i.test(resolved)) {
      throw new Error("Invalid Mystic directory path");
    }
    return resolved;
  }
  const dataDir = resolveField(DATA_OFFSET);
  const messageDir = resolveField(MESSAGE_OFFSET);
  return { rootDir: root, dataDir, messageDir,
    databasePath: win.join(dataDir, "mysticweb.db") };
}

let cached: MysticDirectories | undefined;

/** Read once per Node process. Changes to MYSTIC.DAT require a restart. */
export function mysticDirectories(): MysticDirectories {
  if (cached) return cached;
  const root = process.env.MYSTIC_DATA_ROOT;
  if (!root) throw new Error("MYSTIC_DATA_ROOT is required");
  const config = readFileSync(path.win32.join(root, "mystic.dat"));
  const parsed = parseMysticDirectories(config, root);
  cached = Object.freeze(parsed);
  return cached;
}
