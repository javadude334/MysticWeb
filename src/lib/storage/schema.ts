/**
 * Internal SQLite schema for MysticWeb. No user-facing database setup.
 * Keep migrations additive and transactional; never drop session data.
 */
export interface SchemaDatabase {
  exec(sql: string): void;
  prepare(sql: string): { get(...values: (string | number)[]): Record<string, string | number> | undefined };
}

export const MYSTICWEB_SCHEMA_VERSION = 1;

export function initializeMysticWebSchema(db: SchemaDatabase): void {
  const versionRow = db.prepare("PRAGMA user_version").get();
  const version = Number(versionRow?.user_version);
  if (!Number.isSafeInteger(version) || version < 0 || version > MYSTICWEB_SCHEMA_VERSION) {
    throw new Error("MysticWeb database schema is incompatible");
  }
  if (version === MYSTICWEB_SCHEMA_VERSION) return;

  db.exec("BEGIN IMMEDIATE");
  try {
    if (version === 0) {
      // Sessions and rate_limits are created and validated by AuthStore.
      // A UID is scoped to a trusted area key; message numbers are hints,
      // not stable identity. No automatic assignment occurs until the JAM
      // identity and maintenance reconciliation design is verified.
      db.exec(`
        CREATE TABLE IF NOT EXISTS message_uids (
          uid TEXT PRIMARY KEY NOT NULL,
          area_key TEXT NOT NULL,
          identity_key TEXT NOT NULL,
          jam_number INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(area_key, identity_key)
        ) STRICT;
        CREATE INDEX IF NOT EXISTS message_uids_location
          ON message_uids(area_key, jam_number);
        CREATE TABLE IF NOT EXISTS mysticweb_settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        ) STRICT;
        PRAGMA user_version = 1;
      `);
    }
    db.exec("COMMIT");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* retain original failure */ }
    throw error;
  }
}
