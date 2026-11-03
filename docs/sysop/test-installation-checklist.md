# MysticWeb nonproduction test installation checklist

**Not a production installation guide.** Do not point an unverified development deployment at a live Mystic user database or private mail.

## Before deployment
- [ ] Use a test Mystic installation or read-only copy of its data.
- [ ] Back up existing Mystic files and configuration.
- [ ] Verify supported Node.js version and install dependencies with `npm ci`.
- [ ] Run `npm run typecheck`, `npm test`, and `npm run build`.
- [ ] Keep development login/message endpoints private; do not expose them publicly.
- [ ] Set an absolute `MYSTIC_DATA_ROOT` and check the configured `MYSTICWEB_BULLETIN_THEME` directory.
- [ ] Grant the web app read-only access to the required theme text files.

## Functional checks
- [ ] Dashboard loads and main menu links work.
- [ ] News menu lists four configured sources and displays generated `.asc` files.
- [ ] Missing news files show an unavailable message without exposing a server path.
- [ ] Bulletins parse the existing `bulletin.asc` menu and individual bulletin files.
- [ ] Demos displays its configured links and optional `demos.asc` text.
- [ ] Goodbye displays optional `goodbye.asc`; it must not claim to end a terminal session.
- [ ] Invalid menu IDs and text basenames cannot traverse directories.
- [ ] Unknown menu actions and external `openPage` URLs are rejected.
- [ ] Restricted routes do not become accessible merely by hiding/showing navigation.

## Future native integration gates
- [ ] Authentication: valid/invalid/disabled users and session expiry.
- [ ] Authorization: per-area ACS, direct URL attempts and no cross-user mail.
- [ ] Message and file readers: malformed records, encodings, paging and size limits.
- [ ] Windows and Linux: path conventions, permissions and upgrade/rollback.

Record the commit SHA, test OS, Node version, Mystic version, results and issues. Do not mark a feature production-ready solely because the UI renders.

## Native authentication integration: evidence required before enabling

The staged `NativeFileProvider` reads local Mystic user records and deliberately denies all `authorize` requests. `NativeAccess` supports a strict protocol, and `BridgeTransport` provides an mTLS transport, but **neither constitutes a verified Mystic ACS implementation**. The production composition function still returns `null`; do not bypass this guard with an environment flag.

For the next integration test, use a **separate, nonproduction Mystic 1.12 A48 installation** and record:

- [ ] Exact Mystic build, operating system, and test data locations (do not commit private paths, passwords or user files).
- [ ] Two disposable users with distinct credentials and security levels, plus one locked/deleted test account.
- [ ] At least two echo message areas: one allowed to both users and one restricted to the higher-security user.
- [ ] Native ListACS, ReadACS, group membership, area kind and private/personal flags verified against actual Mystic behavior.
- [ ] Password verification and account status rechecked after account lock and credential changes.
- [ ] Bridge replies bound to the requested instance, user ID, area ID, catalog revision, operation and nonce.
- [ ] Denied areas produce no JAM file access and do not appear in the area listing.
- [ ] Revoking permission between requests immediately denies access.
- [ ] No real user credentials or mail exposed in test logs.

**Activation gate:** implement a reviewed native authorization driver, test it with these fixtures, and only then design explicit production composition. A successful TypeScript build or synthetic test alone does not satisfy this gate.
