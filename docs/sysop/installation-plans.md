# Installation, maintenance and customization — planned guides

**Status:** These are proposed SysOp-facing installation chapters, **not executable instructions for an approved public deployment**.

## Windows guide — planned

1. Choose a supported Windows version and verified Node.js runtime.
2. Download a packaged release without needing Git.
3. Run a setup wizard, select Mystic data location, and verify read-only access.
4. Set HTTPS/reverse proxy, native authentication bridge, and service startup.
5. Test login, permissions, messaging and logout with a non-admin account.
6. Back up configuration, document upgrades, and provide a clean uninstall.

The currently verified project checkout can be previewed using [Safe first test](first-test.md). No packaged Windows installer is available yet.

## Linux guide — planned

1. Supported distribution and Node.js version.
2. Installation from a signed release package or verified source.
3. Dedicated unprivileged service account, restricted Mystic mounts, and protected secrets.
4. Reverse proxy/HTTPS and tested service lifecycle.
5. First login, authorization, backup, rollback, and upgrade checks.

For advanced administrators, [Ubuntu deployment](../../deploy/README.md) documents the existing **specific** nginx/systemd setup, not a generic installer.

## Daily operations — planned

- Start/stop/restart, health checks and logs.
- Configuration and customization backups.
- Upgrades with a rollback path.
- Session revocation, credentials and TLS renewal.
- Diagnose unavailable native integration without exposing private BBS data.

## Menu and dashboard customization

Read [Customizing menus and dashboard](customizing-menus.md) and [APIs and scripting](apis-and-scripting.md). Current customization is source-based; a safe SysOp-owned override directory, editor, and isolation are future work.
