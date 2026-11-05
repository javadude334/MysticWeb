# MysticWeb — Dave's BBS

**New to GitHub or Node.js?** Start with the [plain-language SysOp Guide](docs/sysop/README.md). It explains the current development status and safe local preview steps.

A public front door and developing web interface for Dave's BBS, powered by Mystic BBS.

## Authentication progress (operator update — November 1, 2026)

The operator reports that native Mystic password verification and live login were completed and tested in the MysticWeb development workflow, including recognition of a connected Mystic user on the dashboard (User #2). **Treat this as completed development progress, not a request to reimplement login from scratch.**

**Branch/integration distinction:** The historical staging and production notes below describe the state of the `main` branch and its disabled production composition. They have not been superseded by a verified merge of the latest native-login work. Before calling authentication production-ready, reconcile the authentication implementation branches with `main`, run regression and security tests, and verify the live login/session/logout path. Do not enable production authentication solely because of this status note.

Relevant work branches include `feature/native-file-password-verification`, `feature/auth-reader-integration`, and `feature/native-session-readiness`. Check actual code and commit history rather than assuming all work has been merged.

## Pages

- `/`: public information, a `telnet://davesbbs.com` link, and a web-login link.
- `/login`: clearly marked as coming soon; no credential form or collection.
- `/connect`: connection instructions, a copy-address button and Telnet troubleshooting; no live availability claim or credential collection.
- `/dashboard`: the original disconnected dashboard preview.
- Messages, Private Mail, Files, Relay Chat, Door Games, and My Profile: disconnected previews.
- `/api/health`: uncached runtime status and deployed commit revision.

No live Mystic messages, files, callers, or account data are loaded. Authentication and
server-side authorization must be implemented before connecting account features.

The server-only, read-only JAM reader and its aggregate validation command are
documented in [Mystic integration](docs/mystic-integration.md), including current
authentication and authorization prerequisites. Run `npm test` for synthetic JAM
and configuration fixtures. No message content is connected to web routes yet.

The [authentication session foundation](docs/auth-sessions.md) adds tested private
session storage, revocation, shared rate-limit primitives and request protections.
Native account verification and endpoint integration remain disabled.

## Native sandbox environment

Development-only native sign-in requires `MYSTICWEB_APP_URL` (canonical loopback origin) and optionally `MYSTICWEB_ALLOWED_ORIGINS` (comma-separated loopback origins). For example, set `MYSTICWEB_APP_URL=http://localhost:3000` and `MYSTICWEB_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000`. Only exact HTTP loopback origins are accepted in development; a malformed or non-loopback entry rejects sandbox authentication. The demo launcher binds to localhost. These settings do not activate production authentication.\n\nDevelopment-only sandbox authentication now derives its private SQLite database location and persistent rate-limiting key automatically from `MYSTIC_DATA_ROOT` and the verified Mystic A47 `MYSTIC.DAT` directory settings. For the **first migration startup only**, keep the old `MYSTICWEB_SESSION_DB` and `MYSTICWEB_RATE_KEY` values so existing sessions and rate buckets can be preserved. After a successful startup and restart test, remove both. See [automatic SQLite storage](docs/unified-sqlite.md) for Windows ACL requirements, migration steps and limitations. Production authentication remains disabled pending native adapter verification.

## Development on Ubuntu

```bash
cd ~/projects/mysticweb
git status --short
git fetch origin
git switch main
git pull --ff-only
source ~/.nvm/nvm.sh
nvm use 24
npm ci
npm run lint
npm run build
npm run dev -- --hostname 0.0.0.0 --port 3000
```

Commit or stash unrelated edits before switching branches. Use the existing dev
session or stop it first if port 3000 is occupied. Open http://ubuntu:3000 on the
local network. Use `npm run dev -- --hostname 127.0.0.1` for localhost-only access.

## Windows checkout

```powershell
cd E:\work\javadude_dev\MysticWeb
git status --short
git fetch origin
git switch main
git pull --ff-only
npm ci
npm run lint
npm run build
npm run dev
```

Use Node 24. The scaffold dependency versions and lockfile are retained.

## Production deployment

See [deploy/README.md](deploy/README.md) for the nginx, systemd, HTTPS, and
CI-gated automatic deployment setup for both davesbbs.com and www.davesbbs.com.
The administrator installer prepares inactive files. Site activation and the
first production start are separate manual steps.

Deployments build separate releases outside the development checkout. They do
not change live Mystic files, existing nginx sites, or DNS. The original
scaffold README is retained in ORIGINAL_README.md.

## Deployment tests

```bash
for script in deploy/*.sh; do bash -n "$script"; done
python3 -m unittest discover -s deploy/tests -v
```

Tests use temporary files, mock deployment commands, and loopback-only HTTP.
They do not install services, execute sudo, or activate nginx.

The [staged authentication and message reader](docs/auth-reader-deployment.md) adds
fail-closed HTTP services and a BBS dispatcher contract. Production remains
disabled pending native driver, secure invocation and end-to-end verification.

## Local functional workspace

See [development workspace](docs/development-workspace.md) for disposable account selection, authorized synthetic message reading, pagination and logout. Run npm run dev:demo and open http://127.0.0.1:3000/development. Native authentication remains disabled.

## November 2 integrated testing

The [integration test checklist](docs/integration-test-2026-11-02.md) covers the current mainline application plus the [MysticMail demo](mysticmail/README.md) and its [SYSOP.DOC](mysticmail/SYSOP.DOC). The MysticMail demo is synthetic and does not connect to live mail.
