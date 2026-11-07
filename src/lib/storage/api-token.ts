import "server-only";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { closeSync, existsSync, lstatSync, openSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { acceptablePrivateMode } from "../auth/store";

const NAME = "mysticweb-api.json";
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

/** Store the machine-to-machine credential beside the private SQLite database,
 * never in the generally readable Mystic data root. */
export function apiTokenFile(privateDirectory: string): string {
  return path.join(privateDirectory, NAME);
}

function readToken(filename: string): string {
  const stat = lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024) throw new Error("Unsafe API token file");
  if (!acceptablePrivateMode(filename, stat))
    throw new Error("API token file permissions are too broad");
  const parsed: unknown = JSON.parse(readFileSync(filename, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
      !("version" in parsed) || parsed.version !== 1 ||
      !("token" in parsed) || typeof parsed.token !== "string" ||
      !TOKEN_PATTERN.test(parsed.token)) throw new Error("Invalid API token file");
  return parsed.token;
}

/** Called only after the private directory ACL is established. */
export function ensureApiToken(privateDirectory: string): string {
  const filename = apiTokenFile(privateDirectory);
  if (!existsSync(filename)) {
    const token = randomBytes(32).toString("hex");
    // Exclusive create: never overwrite a token installed by another process.
    let fd: number | undefined;
    try {
      fd = openSync(filename, "wx", 0o600);
      writeFileSync(fd, JSON.stringify({ version: 1, token }) + "\n");
      closeSync(fd); fd = undefined;
    } catch (error) {
      if (fd !== undefined) {
        closeSync(fd);
        try { unlinkSync(filename); } catch { /* preserve original error */ }
      }
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  readToken(filename);
  return filename;
}

export function verifyApiToken(filename: string, authorization: string | null): boolean {
  if (!authorization?.startsWith("Bearer ")) return false;
  const candidate = authorization.slice(7);
  if (!TOKEN_PATTERN.test(candidate)) return false;
  try {
    const expected = readToken(filename);
    return timingSafeEqual(
      createHash("sha256").update(candidate).digest(),
      createHash("sha256").update(expected).digest(),
    );
  } catch { return false; }
}
