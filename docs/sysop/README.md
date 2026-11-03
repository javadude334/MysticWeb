# MysticWeb — System Operator Guide

**Audience:** Mystic BBS system operators, including those who have never used Node.js, web development tools, or GitHub.

> **Development status (November 2026):** MysticWeb is not yet a finished, ready-to-install public web BBS. Parts of native authentication have been tested in development, but the main-branch production composition remains disabled; live message-area authorization, posting, and private mail are not complete. Do not expose development login or message endpoints to the public Internet.

## Start here

1. [What MysticWeb is](overview.md) — what it does and what it does **not** replace.
2. [Getting the software and understanding GitHub](github-basics.md) — no GitHub account needed to download public source.
3. [Safe first-time test](first-test.md) — try a local preview without changing your live BBS.
4. [Common terms and troubleshooting](troubleshooting.md) — Node.js, npm, ports, terminals, and common errors.

5. [Customizing menus and dashboards](customizing-menus.md) — verified source-based edits, sample scripts and current limits.
6. [MysticWeb Scripting Reference Manual](scripting-reference.md) — SysOp commands for bulletins, mail, callers, menus, and future actions.
7. [HTTP APIs and scripting distinction](apis-and-scripting.md) — dashboard helpers versus HTTP endpoints.
8. [Windows/Linux installation and maintenance plans](installation-plans.md) — future installer and daily-operations chapters.

**Advanced installation:** The existing [Ubuntu deployment reference](../../deploy/README.md) is administrator-focused and describes a specific nginx/systemd installation. It is **not** a one-click production installer, and production Mystic integration is not yet enabled.

## Documentation principles

- Each supported platform will eventually have a tested installation walkthrough with prerequisites, screenshots, backups, firewall guidance, upgrade and uninstall instructions.
- Mark steps **tested**, **development only**, or **planned**. Never imply a disabled feature is ready.
- Do not require operators to understand source code, Git branches, or TypeScript to use the finished product.
- Never ask operators to post passwords, session secrets, Mystic user databases, or private mail in GitHub issues.

## Examples

- [Four-source News menu](news-menu-example.md) — menu choices, local Mystic text files and safe rendering.

- [Reusable menu actions](menu-actions.md) — displayText, openMenu, openPage; Bulletins, Demos and Goodbye.

- [SysOp API roadmap](sysop-api-guide.md) — planned functions, status, phases and security gates.
- [Nonproduction test checklist](test-installation-checklist.md) — baseline validation and Mystic integration checks.
