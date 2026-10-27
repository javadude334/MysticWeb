# PR #8 security review

Reviewed the session store, cookie/Origin helpers, tests and intended trust boundary.
The changes have no live routes or native identity provider. This review is a
source-and-regression review, not a claim that Mystic web authentication is working.

## Findings fixed

1. Existing SQLite tables were accepted without validating their columns. An
   incompatible/restored schema could omit expiry fields and make comparisons
   evaluate against NaN. The constructor now refuses unexpected column layouts,
   and session reads validate identity, integer dates and the exact lifetime.
2. One account could retain the entire global session quota. New logins now retain
   at most eight sessions per native instance and permanent user ID, evicting
   oldest sessions atomically without touching other installations.
3. Invalid persisted rate counters and unsafe clock arithmetic now fail closed.
   Constructor cleanup preserves the generic storage error even if close fails.

Added regression coverage for incompatible schemas, malformed lifetime/identity,
quota isolation and oldest-session eviction. Existing tests cover failed rotation
rollback, contention, capacity limits, multi-process rate limits and expiration.

## Reviewed protections

Tokens are generated with 256 random bits and stored only as SHA-256 digests.
SQL uses bound parameters for values. Rotation and revocation are transactional.
Cookie helpers are Secure, HttpOnly, SameSite=Strict, host-only and rooted at `/`.
Mutation helpers require POST and the configured exact HTTPS Origin and reject
contradictory Fetch Metadata. POSIX parent/file permissions and symlinks are checked;
Windows deployments require operator-managed equivalent ACLs. Storage remains on
private local disk with trusted parent ancestors and OS account.

## Integration requirements still open

Do not accept identity from a form or trust SSH transport login as proof of a BBS
account. Native authentication must return the verified permanent identity and
current account state. Read permissions require native, context-correct area
decisions for each request. Sessions convey identity only. No private message,
Netmail, personal-mail or unknown area type may be enabled by this work.

Endpoint work must consume trusted client, normalized-account and global rate
buckets before native verification, bound bodies, avoid credential logs, disable
auth response caching, enforce the Origin helper and revoke sessions on logout and
account changes. All instance, origin, state-path and key configuration must remain
server controlled. No bypass or insecure-development fallback is permitted.
