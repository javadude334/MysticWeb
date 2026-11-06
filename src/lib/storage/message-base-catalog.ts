import "server-only";
import { readFileSync, lstatSync, realpathSync, openSync, readSync, closeSync } from "node:fs";
import path from "node:path";
import { parseMysticAreas } from "../mystic/config";
import { isJamBaseName } from "../mystic/jam";
import { resolveMysticPath, type MysticDirectories } from "../mystic/directories";

export interface DiscoveredMessageBase {
  areaId: number;
  name: string;
  category: "local" | "netmail" | "echomail";
  jamBase: string;
  directory: string;
}
export interface MessageBaseScan {
  bases: DiscoveredMessageBase[];
  skipped: { areaId: number; reason: string }[];
}

const MAX_CONFIG = 8 * 1024 * 1024;
const JAM_EXTENSIONS = ["jhr", "jdx", "jdt"] as const;

/** A47 mbases.dat: type byte at 260 (verified against supplied sandbox).
 * Never classify an area by its display name. A type-0 area is local, but
 * only the configured Local Mail choice is included in the mail catalog.
 */
export function scanMysticMessageBases(directories: MysticDirectories): MessageBaseScan {
  const filename = path.join(directories.dataDir, "mbases.dat");
  const stat = lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_CONFIG || stat.size % 768 !== 0) {
    throw new Error("Invalid Mystic message-base configuration file");
  }
  const areas = parseMysticAreas(readFileSync(filename));
  const skipped: MessageBaseScan["skipped"] = [];
  const bases: DiscoveredMessageBase[] = [];
  const local = areas.find(a => a.baseType === 0 && a.jamBase.toLowerCase() === "email")
    ?? areas.find(a => a.baseType === 0 && a.id === 1);
  for (const area of areas) {
    const category = area.baseType === 3 ? "netmail"
      : area.baseType === 1 ? "echomail"
      : area.baseType === 0 && area.id === local?.id ? "local" : null;
    if (!category) continue;
    try {
      if (!area.name.trim() || !isJamBaseName(area.jamBase)) throw new Error("Invalid area name or JAM filename");
      // A47 stores an optional absolute per-base directory. Do not silently
      // fall back to the global message directory when an explicit path is bad.
      const directory = area.storagePath.trim()
        ? resolveMysticPath(directories, area.storagePath) : directories.messageDir;
      if (!(path.isAbsolute(directory) || path.win32.isAbsolute(directory))) {
        throw new Error("Invalid absolute Windows message path");
      }
      const resolved = realpathSync.native(directory);
      if (!lstatSync(resolved).isDirectory()) throw new Error("Message directory is not a directory");
      for (const extension of JAM_EXTENSIONS) {
        const expected = path.join(resolved, `${area.jamBase}.${extension}`);
        const entry = lstatSync(expected);
        if (!entry.isFile() || entry.isSymbolicLink()) throw new Error(`Unsafe JAM .${extension} file`);
        const actual = realpathSync.native(expected);
        if (path.dirname(actual).toLowerCase() !== resolved.toLowerCase()) {
          throw new Error("JAM file escapes configured directory");
        }
        if (extension === "jhr") {
          if (entry.size < 1024) throw new Error("Invalid JAM header size");
          const fd = openSync(actual, "r");
          try {
            const header = Buffer.alloc(24);
            if (readSync(fd, header, 0, 24, 0) !== 24 ||
                header.toString("ascii", 0, 3) !== "JAM" || header[3] !== 0 ||
                header.readUInt32LE(16) !== 0xffffffff ||
                header.readUInt32LE(20) === 0) throw new Error("Invalid or protected JAM header");
          } finally { closeSync(fd); }
        } else if (extension === "jdx" && entry.size % 8 !== 0) {
          throw new Error("Invalid JAM index length");
        }
      }
      bases.push({ areaId: area.id, name: area.name, category, jamBase: area.jamBase, directory: resolved });
    } catch (error) {
      skipped.push({ areaId: area.id, reason: error instanceof Error ? error.message : "Invalid message base" });
    }
  }
  // Duplicate physical JAM locations must not be represented by two areas.
  const seen = new Set<string>();
  const unique: DiscoveredMessageBase[] = [];
  for (const base of bases) {
    const key = path.join(base.directory, base.jamBase).toLowerCase();
    if (seen.has(key)) skipped.push({ areaId: base.areaId, reason: "Duplicate JAM base path" });
    else { seen.add(key); unique.push(base); }
  }
  return { bases: unique, skipped };
}
