# Authentication session foundation

This is internal infrastructure, not a working login integration. There are no
new routes, forms, credential collection or permission grants. Native Mystic
verification and the shared data-access authorization service remain prerequisites.

## Trust boundary

Only a verified native identity adapter may call `AuthStore.create`. Its identity
is the permanent native user ID **and** an operator-configured instance identifier.
C: and D: installations must not be treated as the same identity source just
because they share JAM paths. Never accept either field from browser input.

Sessions hold no password, hash, security level, inferred group, area permission,
account name or native record. They return identity only. Every protected read must
still verify current account status and enforce current native area permissions.
No administrator override or guest fallback is provided.

## Storage and lifetime

`src/lib/auth/store.ts` uses Node 24's built-in `node:sqlite` implementation;
Node 24 must include that module. The repository's older Node TypeScript typings
do not declare it, so its small private API boundary is typed locally. The runtime
may emit Node's experimental SQLite warning. No third-party native addon is used.

The operator supplies an absolute path to a **private directory on local disk**,
outside the application release tree, BBS installation, shared folders and JAM
mount. The constructor creates the database file only, never its parent. On POSIX,
the parent must have mode 0700 and the database mode 0600; symlink parents/files
are rejected. On Windows, the operator must enforce equivalent NTFS ACLs. Parent
ancestors and the OS account are trusted. Protect backups as identity data.

SQLite transactions serialize token rotation, revocation, activity updates and
rate-limit increments across processes on one host. Rollback journals are used;
do not place this database on SMB, VirtualBox shared folders or network filesystems.
Multiple application hosts require a shared database service instead of copying
this SQLite file. Lock acquisition times out after one second and fails closed.

Tokens contain 256 random bits. Only SHA-256 token digests are stored; cookies
contain the opaque token. Rotation atomically deletes the old session and creates
a new one. Logout revokes one token; account status/credential changes can revoke
every session for that instance and permanent user ID.

Sessions expire after 30 minutes without activity and have an eight-hour absolute
limit. Reads update activity without extending the absolute expiry. Backward clock
movement relative to the last activity revokes the session. Expired sessions are
removed on reads or new logins. Session and rate-limit tables are each capped at
10,000 live rows; exhaustion or unavailable storage rejects operations.

No production database is opened automatically. No service configuration or state
directory has been installed. When integrating, the existing systemd sandbox will
need a dedicated private `StateDirectory` and a configured database path. Keep
auth state outside release directories so deployments preserve revocation and
rate limits. Do not weaken `ProtectSystem` globally.

## Request protections for future endpoints

`src/lib/auth/http.ts` produces `__Host-mysticweb_session` cookies with Secure,
HttpOnly, SameSite=Strict, Path=/ and no Domain. Logout uses the same attributes
with an empty token and Max-Age=0. Development must use HTTPS for login; there is
no insecure cookie fallback.

The mutation guard requires POST and an exact Origin match against an explicitly
configured HTTPS origin. It never derives trust from Host or forwarded headers.
Missing/null/malformed/cross-origin origins and contradictory Fetch Metadata are
denied. This applies to login as well as logout. Future handlers must call the
guard **before** reading credentials, enforce bounded request bodies, use generic
failure responses and disable response caching. Session reads must be request-time
operations under the project's Next.js Cache Components rules, never shared cache.

`rateBucket` derives bucket keys with HMAC-SHA256 using a persistent, randomly
provisioned key of at least 32 bytes shared by all app processes. No key or default
secret is supplied by this code. Stable keys retain limits across restarts; key
rotation intentionally changes buckets. Do not store raw account names or client
addresses. Normalize account identifiers before deriving their bucket. A trusted
proxy must strip and set client-address headers; never trust an arbitrary
X-Forwarded-For value.

Consume account, client and global buckets before native verification, each with
a fixed policy and separate scope name. A denied attempt does not move the reset
time; `retryAfter` is the remaining window in seconds. The endpoint must reject if
any bucket denies or storage fails. These primitives do not themselves protect a
route: endpoint integration and adversarial HTTP tests are still required.

Tests cover restart persistence, expiry boundaries, fixation-resistant rotation,
revocation and installation separation, process-shared rate limits, keyed buckets,
private POSIX storage, strict Origin validation and cookie attributes. All account
and token data used by tests is synthetic.
