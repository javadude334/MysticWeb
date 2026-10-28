# MysticWeb — Dave's BBS

A public front door and developing web interface for Dave's BBS, powered by Mystic BBS.

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
