import "server-only";
import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";

/**
 * Resolve the single MysticWeb database location without asking the SysOp for
 * a database path. This function never creates or changes Mystic files.
 *
 * The caller must supply the trusted, locally installed Mystic root (not a
 * request parameter). The SQLite opener must separately enforce filesystem
 * permissions and reject network/shared filesystems.
 */
export function mysticWebDatabasePath(mysticRoot: string): string {
  if (!path.isAbsolute(mysticRoot)) throw new Error("Mystic installation path is invalid");
  const root = realpathSync(mysticRoot);
  const data = path.join(root, "data");
  const entry = lstatSync(data);
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw new Error("Mystic data directory is unavailable");
  }
  const resolved = realpathSync(data);
  if (path.dirname(resolved) !== root) {
    throw new Error("Mystic data directory must be inside the installation");
  }
  return path.join(resolved, "mysticweb.db");
}
