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
