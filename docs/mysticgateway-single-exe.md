# MysticGateway: single-file deployment target

Status: Windows diagnostic executable compiled and tested in disposable sandbox. **No certified native login or operational gateway exists yet.**

## Operator contract

Target a single `MysticGateway.exe` copied into the root of the Mystic installation. No installer, database, Node/Python runtime, separately installed DLLs, or Mystic process patching. A static executable is preferred, but a standard Windows system library dependency may be acceptable after explicit inspection. Runtime configuration should use an optional file beside the executable or tightly scoped command-line switches **without credentials**. No secrets in arguments or environment variables.

The gateway must discover its root from its executable directory and reject paths outside the approved installation. It must not assume the current working directory is the BBS root. Initial experiments use **E:\mystic** only. Production **D:\mystic** must never be touched by tests.

## Boundary

Mystic remains the sole owner of user records, messages, read pointers, bulletins, and door data. The A48 user file is located at `data\\users.dat` relative to the Mystic installation root; never assume `users.dat` resides beside the executable. MysticWeb owns only short-lived web session/security state; no mirrored BBS database. The gateway exposes a small authenticated encrypted interface, preferably bound to loopback or an explicitly private network. No public unauthenticated listener.

Native Mystic `isuserpw` has been demonstrated in an interactive embedded session, but a standalone process **cannot call that Python function by itself**. A record reader is not a password verifier. Do not implement a guessed password algorithm, pass passwords in process arguments, or declare authentication working based on synthetic tests.

The first functional gateway build must prove one of: (a) a separately validated standalone verifier matching native A48 behavior and identity/status policy, or (b) a supported, authenticated, bounded native invocation that does not expose credentials or impersonate sessions. If neither is available, fail closed. Requested-user ACS remains a separate gate before exposing message areas.

## Build choice

Investigate Free Pascal for a compact Windows executable with no third-party runtime. Confirm actual executable size and dependencies before promising a single-file result. Cross-platform portability is secondary to safe A48 integration.

## Read-only Windows preflight

Run from the updated MysticWeb checkout:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\gateway-preflight.ps1
```

It reports only file presence/sizes, compiler availability, Git revision, and platform metadata. It does **not** read account contents, execute Mystic, launch services, change settings, or access D:. The report is saved to the user's TEMP directory and copied to the clipboard when available.

## Acceptance criteria

1. Copy one executable to a disposable E:\mystic installation; no external runtime installation.
2. Fail closed when the identity, password binding, account state, native context, or gateway channel cannot be established.
3. Demonstrate real A/A and B/B login, crossed-password rejection, session identity stability, and logout with sanitized evidence.
4. Do not expose messages until requested-user group/ListACS/ReadACS checks are proven.
5. Verify concurrent BBS usage and file locking before any write to Mystic read-state files.
6. Keep production auth disabled until an independently reviewed activation and native certification.

## Current diagnostic scope

The sandbox-only executable supports `--preflight`, `--inspect-layout`, `--inspect-identities`, and `--inspect-flag-patterns`. These are read-only diagnostics. The last mode counts distinct raw patterns in candidate account flags at bytes 4–7 without displaying values or interpreting account status. No standalone native password verifier or requested-user ACS evaluator has been certified.
