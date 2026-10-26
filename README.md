# MysticWeb frontend

A responsive, dark Next.js dashboard inspired by ANSI art and bulletin board systems.

## Current behavior

Dashboard, Messages, Private Mail, Files, Relay Chat, Door Games, and My Profile are navigable. Every destination is a disconnected preview. There is no BBS API, authentication, account storage, message sending, chat connection, game launch, or file download. No live Mystic data is read.

Before adding a backend, implement server-side authentication and per-resource authorization. Expose only explicitly approved public areas; never serve Mystic data directories directly.

## Run and check

Use Node 24 (already installed through nvm on the Ubuntu development server).

```bash
cd ~/projects/mysticweb
source ~/.nvm/nvm.sh
nvm use 24
npm ci
npm run lint
npm run build
npm run dev -- --hostname 0.0.0.0
```

Open http://localhost:3000 on the development machine, or use the Ubuntu development server's address from another device. Binding to 0.0.0.0 makes the development server reachable on the network. Use `npm run dev` for localhost only.

For a local production-mode check:

```bash
npm run build
npm run start -- --hostname 127.0.0.1 --port 3100
```

## Sync the dashboard branch

Commit or stash unrelated local edits before switching branches. Do not force-push or reset your working tree.

Ubuntu:

```bash
cd ~/projects/mysticweb
git status --short
git fetch origin
git switch feature/dark-dashboard
git pull --ff-only
source ~/.nvm/nvm.sh
nvm use 24
npm ci
npm run lint
npm run build
```

Windows PowerShell, for the existing repository:

```powershell
cd E:\work\javadude_dev\MysticWeb
git status --short
git fetch origin
git switch feature/dark-dashboard
git pull --ff-only
npm ci
npm run lint
npm run build
npm run dev
```

On first switch, Git creates the local branch from the matching origin branch. If the branch already exists locally, it is reused.

## Review checklist

- Dashboard and every navigation destination load.
- The current destination is indicated in navigation.
- Keyboard users can use the skip link and see focus outlines.
- Navigation scrolls horizontally on narrow screens; cards reflow.
- Preview labels and disconnected states appear throughout.
- An unknown URL returns a 404.
- No browser requests go to a BBS or private-data endpoint.

This change does not configure production hosting, nginx, or any live Mystic files. The original scaffold README is retained as ORIGINAL_README.md.
