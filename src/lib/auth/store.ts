import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { lstatSync, openSync, closeSync } from "node:fs";
import path from "node:path";

// Node 24's built-in SQLite is not declared by this project's Node 20 typings.
// Keep the small boundary typed without adding a native third-party dependency.
type Row = Record<string, string | number>;
interface Database {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...values: (string | number)[]): unknown;
    get(...values: (string | number)[]): Row | undefined;
  };
  close(): void;
}
const { DatabaseSync } = createRequire(path.join(process.cwd(), "package.json"))("node:sqlite") as {
  DatabaseSync: new (filename: string, options: { timeout: number }) => Database;
};

export const SESSION_SECONDS = 8 * 60 * 60;
const IDLE_MS = 30 * 60 * 1000;
const ABSOLUTE_MS = SESSION_SECONDS * 1000;
const MAX_ROWS = 10000;
const MAX_IDENTITY_SESSIONS = 8;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const DIGEST = /^[a-f0-9]{64}$/;

export class AuthStoreError extends Error {
  constructor() { super("Authentication storage unavailable"); }
}

export interface Identity {
  // Instance identity is mandatory: C: and D: installations must not be conflated.
  instance: string;
  userId: number;
}

/** Use an operator-provisioned, stable random key shared by all app processes.
 * Raw client addresses and account names are never stored in rate-limit rows.
 */
export function rateBucket(secret: Buffer, scope: string, value: string): string {
  if (secret.length < 32 || !/^[a-z0-9_-]{1,64}$/.test(scope) || !value || Buffer.byteLength(value) > 256) throw new AuthStoreError();
  return createHmac("sha256", secret).update(JSON.stringify([scope, value])).digest("hex");
}

function digest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function validIdentity(identity: Identity) {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(identity.instance) &&
    Number.isSafeInteger(identity.userId) && identity.userId > 0 && identity.userId <= 0x7fffffff;
}

/** Persistent primitives only. Callers MUST verify identity natively before create,
 * and revalidate current account status and area permissions on protected reads.
 * A session contains identity only; it is never an authorization grant.
 */
export class AuthStore {
  private db: Database;
  constructor(filename: string, private readonly clock: () => number = Date.now) {
    let opened: Database | undefined;
    try {
      if (!path.isAbsolute(filename)) throw new AuthStoreError();
      const directory = lstatSync(path.dirname(filename));
      if (!directory.isDirectory() || directory.isSymbolicLink() ||
        (process.platform !== "win32" && (directory.mode & 0o077) !== 0)) throw new AuthStoreError();
      try { closeSync(openSync(filename, "ax", 0o600)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
      const file = lstatSync(filename);
      if (!file.isFile() || file.isSymbolicLink() ||
        (process.platform !== "win32" && (file.mode & 0o077) !== 0)) throw new AuthStoreError();
      opened = new DatabaseSync(filename, { timeout: 1000 });
      // Local private disk only. Transactions coordinate multiple app processes.
      opened.exec(`PRAGMA journal_mode = DELETE;
        PRAGMA secure_delete = ON;
        CREATE TABLE IF NOT EXISTS sessions (
          digest TEXT PRIMARY KEY, instance TEXT NOT NULL, user_id INTEGER NOT NULL,
          created INTEGER NOT NULL, seen INTEGER NOT NULL, expires INTEGER NOT NULL
        ) STRICT;
        CREATE INDEX IF NOT EXISTS sessions_identity ON sessions(instance, user_id);
        CREATE TABLE IF NOT EXISTS rate_limits (
          bucket TEXT PRIMARY KEY, used INTEGER NOT NULL, resets INTEGER NOT NULL
        ) STRICT;`);
      const expected: Record<string, string> = {
        sessions: "digest:TEXT:1,instance:TEXT:0,user_id:INTEGER:0,created:INTEGER:0,seen:INTEGER:0,expires:INTEGER:0",
        rate_limits: "bucket:TEXT:1,used:INTEGER:0,resets:INTEGER:0",
      };
      // Refuse incompatible/restored databases instead of silently accepting a
      // legacy table whose missing expiry columns could turn comparisons into NaN.
      for (const table of Object.keys(expected)) {
        const columns = opened.prepare(`SELECT group_concat(name || ':' || type || ':' || pk, ',') AS shape FROM pragma_table_info('${table}')`).get();
        if (columns?.shape !== expected[table]) throw new AuthStoreError();
      }
      this.db = opened;
    } catch {
      try { opened?.close(); } catch { /* preserve the generic failure */ }
      throw new AuthStoreError();
    }
  }

  private now() {
    const now = this.clock();
    if (!Number.isSafeInteger(now) || now < 0 || now > Number.MAX_SAFE_INTEGER - ABSOLUTE_MS) throw new AuthStoreError();
    return now;
  }

  private transaction<T>(work: () => T): T {
    let begun = false;
    try {
      this.db.exec("BEGIN IMMEDIATE"); begun = true;
      const result = work();
      this.db.exec("COMMIT");
      return result;
    } catch {
      if (begun) { try { this.db.exec("ROLLBACK"); } catch { /* unavailable */ } }
      throw new AuthStoreError();
    }
  }

  /** Rotate by passing the old cookie; revoke and insert are one transaction.
   * The browser may never choose a session token or an identity.
   */
  create(identity: Identity, oldToken?: string): string {
    if (!validIdentity(identity)) throw new AuthStoreError();
    return this.transaction(() => {
      const now = this.now();
      this.db.prepare("DELETE FROM sessions WHERE expires <= ? OR seen <= ?").run(now, now - IDLE_MS);
      if (oldToken && TOKEN.test(oldToken)) this.db.prepare("DELETE FROM sessions WHERE digest = ?").run(digest(oldToken));
      // Keep the newest seven before inserting the new eighth session. Scope
      // eviction to this native account and installation, in the same transaction.
      this.db.prepare(`DELETE FROM sessions WHERE digest IN (
        SELECT digest FROM sessions WHERE instance = ? AND user_id = ?
        ORDER BY created DESC, rowid DESC LIMIT -1 OFFSET ?
      )`).run(identity.instance, identity.userId, MAX_IDENTITY_SESSIONS - 1);
      const count = this.db.prepare("SELECT count(*) AS count FROM sessions").get();
      if (Number(count?.count) >= MAX_ROWS) throw new AuthStoreError();
      const token = randomBytes(32).toString("base64url");
      this.db.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?)")
        .run(digest(token), identity.instance, identity.userId, now, now, now + ABSOLUTE_MS);
      return token;
    });
  }

  read(token: string | undefined): Identity | null {
    if (!token || !TOKEN.test(token)) return null;
    return this.transaction(() => {
      const now = this.now(), hash = digest(token);
      const row = this.db.prepare("SELECT * FROM sessions WHERE digest = ?").get(hash);
      if (!row) return null;
      const identity = { instance: String(row.instance), userId: Number(row.user_id) };
      const created = Number(row.created), seen = Number(row.seen), expires = Number(row.expires);
      if (!validIdentity(identity) || ![created, seen, expires].every(Number.isSafeInteger) ||
        created < 0 || seen < created || expires !== created + ABSOLUTE_MS || seen >= expires ||
        now < seen || now >= expires || now - seen >= IDLE_MS) {
        this.db.prepare("DELETE FROM sessions WHERE digest = ?").run(hash);
        return null;
      }
      this.db.prepare("UPDATE sessions SET seen = ? WHERE digest = ?").run(now, hash);
      return identity;
    });
  }

  revoke(token: string | undefined): void {
    if (!token || !TOKEN.test(token)) return;
    this.transaction(() => { this.db.prepare("DELETE FROM sessions WHERE digest = ?").run(digest(token)); });
  }

  revokeIdentity(identity: Identity): void {
    if (!validIdentity(identity)) throw new AuthStoreError();
    this.transaction(() => {
      this.db.prepare("DELETE FROM sessions WHERE instance = ? AND user_id = ?").run(identity.instance, identity.userId);
    });
  }

  /** bucket must be an HMAC of a server-derived scope and key (e.g. verified
   * client address or normalized account). Never trust forwarded headers unless
   * the deployment proxy strips and sets them. Increment BEFORE native login.
   * Combine account, client and global buckets in the endpoint.
   */
  consume(bucket: string, maximum: number, windowMs: number): { allowed: boolean; retryAfter: number } {
    if (!DIGEST.test(bucket) || !Number.isSafeInteger(maximum) || maximum < 1 || maximum > 10000 ||
      !Number.isSafeInteger(windowMs) || windowMs < 1000 || windowMs > ABSOLUTE_MS) throw new AuthStoreError();
    return this.transaction(() => {
      const now = this.now();
      this.db.prepare("DELETE FROM rate_limits WHERE resets <= ?").run(now);
      const row = this.db.prepare("SELECT * FROM rate_limits WHERE bucket = ?").get(bucket);
      if (row) {
        if (!Number.isSafeInteger(Number(row.used)) || Number(row.used) < 1 || Number(row.used) > 10000 ||
          !Number.isSafeInteger(Number(row.resets)) || Number(row.resets) > now + ABSOLUTE_MS) throw new AuthStoreError();
        if (Number(row.used) >= maximum) return { allowed: false, retryAfter: Math.ceil((Number(row.resets) - now) / 1000) };
        this.db.prepare("UPDATE rate_limits SET used = used + 1 WHERE bucket = ?").run(bucket);
      } else {
        const count = this.db.prepare("SELECT count(*) AS count FROM rate_limits").get();
        if (Number(count?.count) >= MAX_ROWS) throw new AuthStoreError();
        this.db.prepare("INSERT INTO rate_limits VALUES (?, 1, ?)").run(bucket, now + windowMs);
      }
      return { allowed: true, retryAfter: 0 };
    });
  }

  close(): void { this.db.close(); }
}
