# MysticWeb authentication: current path and obsolete experiments

**Project decision (2026-11-01): Direct, read-only native Mystic user-file authentication is the current development path. The older SSH authentication experiment is OBSOLETE and must not be suggested, run, repaired, or integrated as the default path.**

## Current implementation

- `src/lib/mystic/native-user-login.ts`: native Mystic method-2 password verification.
- `src/lib/mystic/native-account-status.ts`: native account status rechecks.
- `src/lib/auth/sandbox-login.ts`: development-only browser authentication and persistent sessions.
- `src/app/api/auth/login/route.ts`: routes development login to the sandbox implementation.
- Configure `MYSTIC_DATA_ROOT` to point to a read-only Mystic root containing `data/users.dat`, plus a valid `MYSTICWEB_SANDBOX_RATE_KEY`. Development login requires localhost origin; access from another computer via an SSH **port-forward tunnel to the web dev server** if needed. This tunnel is transport to the website, **not Mystic SSH authentication**.
- Development authentication is not production authorization. Complete account-expiry policy, area ACS, private-message permissions, and native write/delivery integration before granting those capabilities.

## Obsolete — historical only

- `feature/browser-native-ssh` and associated SSH worker/terminal protocol experiments.
- `scripts/ubuntu-sandbox-ssh-login.cjs` and other direct Mystic SSH authentication probes.
- Any native login path that logs in by opening an SSH session to Mystic at `192.168.150.58:8022`.
- Related historical PRs, including #22, are research artifacts, not the implementation plan.

**Do not resume SSH_CONNECTION troubleshooting or recommend old SSH diagnostics for browser login.** Consult the current native user-file login and its configuration instead.

## Working practice

MysticWeb is one application under active development. Use `main` as the integration branch for native login, bulletins, and private messaging. Keep experimental code only as history; do not merge old SSH authentication code to 'complete' native login. Verify the implementation and tests before changing deployment on www.davesbbs.com.

This decision is intentionally recorded in the repository so future sessions and contributors do not repeat the obsolete SSH investigation.
