# MysticWeb internal SQLite integration

## Design
MysticWeb uses one internal SQLite database for session tokens, rate limits,
message UID mappings, and application settings. SysOps do not manage tables
or migrations.

The intended location is `<Mystic root>/data/mysticweb.db`. The trusted
path resolver is implemented in `src/lib/storage/database-path.ts`.

## Current integration status
- `AuthStore` already persists sessions and rate limits using Node 24 SQLite.
- Opening `AuthStore` now initializes version 1 of the shared schema in a
  transaction, after validating the existing session/rate-limit table shapes.
- New tables: `message_uids` and `mysticweb_settings`.
- The database-path resolver is **not yet wired** into the session-store
  construction. Existing callers still supply the database filename.
- No message UIDs are assigned yet. A JAM identity/reconciliation strategy
  must be verified before populating mappings.
- No migration from a legacy separate session database has been performed.
- No sandbox or live Mystic files are changed by repository commits.

## Security and deployment gate
The existing `AuthStore` requires a private directory and private database
file. Mystic's ordinary `data` directory may not meet these requirements,
especially on Linux, Windows installations with broad ACLs, or shared mounts.
Do **not** bypass the checks or silently change permissions on Mystic's
directory. Before enabling the default path, implement and test appropriate
file/ACL isolation, local-filesystem detection, backup and migration behavior,
and secure deployment ownership. Failure must deny authentication rather
than create a less-protected session store.

## Next checks
1. Run typecheck, unit tests and build on Node 24.
2. Add migration tests: empty DB, existing session DB, incompatible schema,
   newer schema, failed migration and restart persistence.
3. Wire trusted Mystic root resolution to the store after security review.
4. Migrate any old session database safely with a backup and rollback plan.
5. Implement message identity and reconciliation independently of JAM numbers.
