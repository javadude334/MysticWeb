import "server-only";
import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import { AuthStore } from "../auth/store";
import { mysticDirectories, type MysticDirectories } from "../mystic/directories";

export interface MysticWebRuntime {
  readonly directories: MysticDirectories;
  readonly authStore: AuthStore;
  readonly rateKey: Buffer;
}

/**
 * Per-process startup composition. Never use a request-supplied root or
 * silently fall back to a separate sessions.sqlite.
 *
 * IMPORTANT: Call this from the server bootstrap/composition entrypoint.
 * This module does not activate production authentication or bypass native
 * account and message-area authorization.
 */
let runtime: MysticWebRuntime | undefined;

export function initializeMysticWebRuntime(options: { privateLocalDataVerified: boolean }): MysticWebRuntime {
  if (runtime) return runtime;
  const directories = mysticDirectories();
  if (process.platform !== "win32") {
    // This parser currently supports only verified Windows Mystic A47 paths.
    // Do not pass win32 paths to a POSIX SQLite opener.
    throw new Error("MysticWeb SQLite auto-location requires a local Windows Mystic installation");
  }
  const data = lstatSync(directories.dataDir);
  if (!data.isDirectory() || data.isSymbolicLink()) {
    throw new Error("Mystic data directory is not a regular directory");
  }
  const canonical = realpathSync.native(directories.dataDir);
  if (path.win32.normalize(canonical).toLowerCase() !==
      path.win32.normalize(directories.dataDir).toLowerCase()) {
    throw new Error("Mystic data directory must not redirect");
  }

  // Windows NTFS ACL verification and shared-filesystem rejection still
  // require deployment validation. Do not automatically enable authentication
  // on a filesystem whose confidentiality cannot be established.
  if (options.privateLocalDataVerified !== true) {
    throw new Error("MysticWeb data directory security has not been verified");
  }

  const authStore = new AuthStore(directories.databasePath);
  try {
    const legacy = process.env.MYSTICWEB_RATE_KEY;
    const previousKey = legacy
      ? (/^[a-fA-F0-9]{64}$/.test(legacy) ? Buffer.from(legacy, "hex") : undefined)
      : undefined;
    if (legacy && !previousKey) throw new Error("Invalid legacy rate key");
    const rateKey = authStore.getOrCreateRateKey(previousKey);
    runtime = Object.freeze({ directories, authStore, rateKey });
    return runtime;
  } catch (error) {
    authStore.close();
    throw error;
  }
}
