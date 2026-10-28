# A48 status investigation — 2026-10-28

**Not certified; production web authentication remains disabled.**

## Evidence and limits

The operator reports isolated E:\mystic cross-account `getuserid(1)` and
`isuserpw(pwdata, password)` success. `getstr(11,40,120,'')` works but echoes;
do not enter real passwords through it. `access('s20')` evaluates the signed-in
session even after retrieving another account. These are operator observations,
not a completed adapter/bridge/web certification. Two disposable records had
1536-byte size and zero flags at offset 4. Zero flags do not certify active state.

Read-only inspection of installed `E:/mystic/docs/records.112` lines 426–466:

| Field/mask | Documented meaning | Certification use |
| --- | --- | --- |
| PermIdx, first LongInt | Permanent user number | Never use slot as identity |
| Flags, second LongInt | User bitmap | Offset 4 matches observed layout |
| `0x00000001` | UserLockedOut | Candidate locked denial |
| `0x00000004` | UserDeleted | Candidate deleted denial |
| `0x00000400` | UserForcePW | Candidate password-change-required denial |
| `0x00000020` | UserNoPWChange | Not the force-change bit |
| Expires / ExpiresTo | Julian date / expiry security level | Separate from flags |
| LastPWChange | Julian date | Requires configured password age policy |

The installed changelog lines 466–467 says Force password change applies at next
login; lines 2408–2409 document Julian day dates. The primary
[user editor reference](https://wiki.mysticbbs.com/doku.php?id=config_user_editor)
and [changelog](https://wiki.mysticbbs.com/doku.php?id=whats_new_112) provide context,
but the installed A48 definitions must govern this build. Full expiration behavior,
automatic password-age rules, other flags and runtime dictionary mapping still
need verification. Do not turn these three masks into an allow policy.

## Read-only comparison procedure (Python 3.10+)

Run from the repository root in PowerShell. This is ordinary Python, not an MPY
script: do not copy PowerShell `@'` / `'@` wrappers into a `.mpy` file.
`python` below means a Python 3.10+ interpreter; if it is absent from PATH,
invoke its full executable path with PowerShell's `&` operator. The BBS's
embedded Python 2.7 runtime cannot run this offline tool.

1. Stop all sandbox BBS/MIS processes that can write users.dat. Retain only
   disposable accounts. Production D:\mystic is excluded by the capture tool.
2. Capture a sanitized baseline:

   ```powershell
   python integrations/mystic/a48_status_probe.py capture --input E:\mystic\data\users.dat > before.json
   ```

3. **Local Windows/native editor step:** start the sandbox configuration editor,
   independently identify B's permanent ID, toggle exactly one of Locked Out,
   Deleted or Force Password Change, save, close the editor and stop writers.
   This requires interactive editor access. The probe never edits a user record.
4. Capture and compare:

   ```powershell
   python integrations/mystic/a48_status_probe.py capture --input E:\mystic\data\users.dat > after.json
   python integrations/mystic/a48_status_probe.py compare before.json after.json
   ```

5. Check B alone changed, with XOR `1`, `4`, or `1024` respectively. Unexpected
   changes mean stop and investigate; an unchanged flags word does not imply a
   failed date/policy change. Restore through the editor and repeat separately.
   Retain sanitized PASS/FAIL, build, code revision, IDs and flag reports only.

Output contains only permanent IDs, numeric flags and three decoded booleans.
No handles, password bytes, hashes or full-record diffs are emitted. Reads are
bounded and checked twice plus file metadata; this detects some races but is
**not** a coherent live database snapshot guarantee. This tool is offline
diagnostics and is deliberately not wired into A48Driver or account policy.

## Remaining certification gates

- Native masked input must be established before any further password probe.
  MPL masked input documentation does not establish Python getstr mode semantics.
- Verify native dictionary identity and lossless pwdata/snapshot binding without
  displaying secrets; the existing verifier callbacks remain mandatory.
- Use the editor to establish locked/deleted/forced-change and expiration cases,
  including date boundary, ExpiresTo downgrade/deletion and password-age rules.
  Unknown normalized status must deny before password work and on every read.
- Effective requested-account group, area, ListACS and ReadACS evaluation remains
  unavailable. Current-session `access` is unsuitable; offline s20 evaluation is
  not a complete ACS engine. The primary [ACS reference](https://www.wiki.mysticbbs.com/doku.php?id=access_control)
  includes session-dependent rules, so a security-level-only approximation fails.
- The modern-Python mTLS listener cannot directly import the embedded Python 2.7
  runtime. A reviewed authenticated, encrypted, bounded worker channel and
  supported native execution lifecycle remain unimplemented. Do not send passwords
  via command arguments, environment, shell commands, files or plaintext IPC.

Synthetic regression and transport tests can run unattended. Editor changes,
native terminal input and live end-to-end certification need interactive Windows
access; this run does not claim those steps passed. D:\mystic must remain untouched.

## This run's read-only observation

The new capture tool read the sandbox successfully and reported permanent IDs 1
and 2, both flags zero, with `certified: false`. Sandbox processes were running;
this is an observational read, not the quiescent editor comparison above. No
processes were stopped and no sandbox records were changed. No native terminal
or editor automation was performed. Production files were not opened.
