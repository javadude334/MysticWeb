# MysticWeb automatic SQLite storage (Windows Mystic A47 sandbox)

## Final environment after the first successful migration

```dotenv
MYSTICWEB_APP_URL=http://localhost:3000
MYSTICWEB_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
MYSTIC_DATA_ROOT=C:\\MysticSandbox
```

`MYSTICWEB_SANDBOX_READ_AREAS` and `MYSTICWEB_SANDBOX_JAM_ROOT` are obsolete.
`MYSTICWEB_SESSION_DB` and `MYSTICWEB_RATE_KEY` are only read during the
**first migration startup**; remove them after verifying successful login.

## Startup behavior

Next.js `src/instrumentation.ts` initializes the runtime on Node development
startup. It reads `MYSTIC.DAT` from `MYSTIC_DATA_ROOT`, validates the verified
Mystic 1.12 A47 layout, and caches the configured data and message directories.
Unsupported layouts fail closed. The current parser does not discover a global
file-area directory; individual file-area paths require their own parser.

The database is placed at
`<configured data directory>\\mysticweb\\mysticweb.db`, **not** directly
beside `users.dat`. The dedicated child directory is necessary because
session data must not inherit broad BBS data-directory permissions. Startup
creates and protects that child directory with Windows ACLs (current service
identity and SYSTEM only) and rejects non-fixed drives. No database settings
are needed for subsequent restarts.

The schema stores session digests, rate-limit counters, a persistent 256-bit
HMAC key, message UID mappings, and MysticWeb settings. Native Mystic remains
authoritative for users, message areas and JAM contents.

## First migration (one time)

1. Stop all running MysticWeb/Next.js processes. Back up the old
   `sessions.sqlite`, the Mystic configuration and data.
2. Keep your existing `MYSTICWEB_SESSION_DB` and `MYSTICWEB_RATE_KEY`
   for **one** startup. If no new database exists, startup validates and
   copies the old database into the private child directory, leaving the
   original intact. A present SQLite journal/WAL file blocks migration.
3. Run `npm run dev` on the Windows sandbox with Node 24. Check that startup
   succeeds and that authentication and session persistence work.
4. Stop the server, remove the two legacy variables, and restart. The key
   is loaded from SQLite, and sessions continue to use the new database.
5. Retain the original database backup until the migration is confirmed.

If the new database already exists, the old database is not copied again.
Do not delete the new database when removing the legacy environment variables.

## Boundaries

This implementation is **Windows local fixed-disk only**, matching the supplied
A47 sandbox sample. It does not automatically support Linux or a network share.
Production authentication remains disabled pending verified native adapters.
Message posting and file-area discovery are separate work.

The runtime protects the database directory and its database file; do not
grant BBS users access to that private directory or expose it through the web
server. SQLite journals must remain on the same local filesystem.

## Verification

Run `npm run typecheck`, `npm test`, `npm run build` on Node 24, and perform
a real Windows startup/migration smoke test. These checks are not substitutes
for production-native authentication and ACL verification.
