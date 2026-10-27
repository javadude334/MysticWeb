# Mystic message integration: verified boundary

## Current status

The server-only JAM reader is implemented. It is deliberately not connected to
pages or HTTP endpoints until native identity and area authorization are verified.
No message-base writes or last-read writes are performed. No password collection
or authentication fallback is enabled.

## JAM reader

`src/lib/mystic/jam.ts` implements the JAM-001 revision 1 fixed header, index,
subfields, body offsets and reply pointers. Message numbering uses BaseMsgNum,
including packed databases whose numbering does not begin at 1. Dates retain raw
JAM seconds and TZUTCINFO because legacy locally written timestamps may encode
local wall time. Consumers must not assume UTC.

`readJam(root, base, options)` is an internal storage primitive, not an authorized
service. `root` must be an operator-controlled JAM directory. `base` must be selected
from verified configuration after area authorization; URLs must contain numeric
area IDs, never storage paths or base names. Names allow ASCII letters, digits,
underscore and verified filename punctuation (`&!'.-`), starting with a letter,
digit or underscore; `..` and path separators are forbidden. No shell is used.
Resolved file paths must stay under the resolved
root. Host filesystem administrators are trusted; the BBS mount must remain
read-only for the web service account.

Pages contain at most 50 messages and scan at most 1,000 index slots. Empty pages
may still have `nextBefore` when deleted/hidden records exhaust the scan budget.
Continuation is exclusive and newest-first. Direct reads use `message` and return
at most that record. Lists do not read bodies. Subfields are capped at 64 KiB and
bodies at 1 MiB. Oversized or malformed records are skipped, not allocated.
Reply pointers and MSGID/REPLYID are preserved; callers must authorize each linked
message and bound traversal to prevent cycles or hidden-message disclosure.

Supported text: default CP437, explicit UTF-8 and Windows-1252 CHRS declarations.
Unsupported encodings and invalid UTF-8 are skipped. Plain-text output normalizes
line endings and strips control characters, including bidi overrides. Render with
React text nodes, never raw HTML or a terminal emulator. CP850/other code pages
require explicit additional mappings and fixtures before support is claimed.

Deleted, private, Netmail, NODISP, encrypted, compressed, escaped, unknown secondary
attributes and password-protected records are excluded, including direct reads.
Password-protected conferences are rejected. Attachments and arbitrary subfields
are not returned. `.jlr` is neither read nor modified: Mystic's permanent user IDs
and scan semantics must be verified before reporting unread status.

Concurrent modification checks compare open-handle and current path identity,
size, nanosecond timestamps and the file header/modification counter before and
after reading. A detected change rejects the entire result as `CHANGED`; clients
should retry a later request, never return partial results. This is best-effort:
SMB caching, in-progress writes and maintenance can evade optimistic detection.
For a strict consistent view, an operator must provide coherent snapshots made
while Mystic holds its native lock. This reader never acquires a write lock.
Pagination across requests is a live view, not a snapshot; packing can change
which messages exist. Reply chains can be incomplete.

Local operator validation (aggregate metadata only):

```sh
MYSTIC_JAM_ROOT=/mnt/mystic-readonly/messages npm run mystic:jam:validate
```

The command scans at most 1,000 index records per base, reads at most one visible
header per base, and reports counts only. It does not establish that any area is
authorized for the web. It must never be wrapped in a public API.

Validation on October 27, 2026 against the read-only Ubuntu mount covered 416
bases, sampled 212 visible headers, scanned 1,212 index entries, skipped 1,000
hidden/deleted/malformed entries, and reported zero changed or unavailable bases.
This is a bounded compatibility sample, not a complete integrity audit. Eleven
JAM fixture tests also passed on Ubuntu, including symbolic-link confinement.

## Native authentication investigation

Official sources:

- https://www.mysticbbs.com/features.html describes PBKDF2/SHA-512 with variable iterations.
- https://www.wiki.mysticbbs.com/doku.php?id=introduction documents `MYSTIC -AUTH`.
- https://wiki.mysticbbs.com/doku.php?id=access_control documents ACS.

The actual mounted `docs/records.112` identifies itself as **1.12 A39**, dated
1997–2018, and defines `UserPasswordRecord = Array[1..101] of Byte`. It does not
define the cryptographic format, salt, iteration encoding or algorithm revision.
No user records, hashes or passwords were inspected. Installed documentation can
be stale, so these definitions do not establish the running binary version.

### Windows verification, October 27, 2026

The operator identified `D:\mystic` as the 32-bit VM installation and `C:\mystic`
as the separate 64-bit local Windows installation. They use the same message-base
paths. Do not infer that user databases or effective security configurations are
shared, and do not switch between these installations for authentication.

SHA-256 checksums of both `mystic.exe` and `mis.exe` in `D:\mystic` match their
counterparts on Ubuntu's `/mnt/mystic-readonly` mount. The mount reports `vboxsf`.
The D: runtime's documented `-VER` command reports **Mystic BBS v1.12 A48,
Windows/32, compiled 2023/01/15 15:29:45**. Its compiler reports A48 Windows/32,
compiled six seconds later. This supersedes any inference of a runtime version
from the A39 record documentation. The visible host's running MIS executable is
under C:, which is expected for the separate local installation and does not
identify the VM's running process.

An isolated copy of the D: compiler successfully compiled
`integrations/mystic/capabilities.mps`: native `CheckPW`, `ACS` and `GetUser` are
recognized. The installed changelog documents that `CheckPW` verifies against the
currently loaded native user. The compile probe never invokes these functions
at runtime; compilation is **not** proof of authentication, correct user context,
group context, account expiration enforcement or web integration.

This makes native verification a concrete integration candidate without
reimplementing password hashing. A production adapter still needs a safe,
authenticated invocation channel with credentials in bounded in-memory input,
never process arguments, and runtime tests using an explicit test account.
Do not launch an authenticated script by silently selecting an existing account,
creating an administrator, or bypassing Mystic's login process. An authenticated
BBS-session link flow remains an alternative. No BBS files were changed during
this inspection; only the documented version command ran against the D: runtime.

Do not implement a guessed password verifier. The documented `-AUTH` interface
takes the password as a process argument, potentially visible to process monitors;
it is not an acceptable production web password transport. The Windows binary
cannot simply be executed from the Ubuntu read-only mount. Do not use Telnet,
command interpolation, shell execution or password-bearing command lines as a
web authentication workaround.

Preferred next integration: a small native service inside the Windows VM that
verifies passwords via a version-verified native API, receives bounded requests
over an authenticated private channel, and returns only permanent identity plus
current account status and per-area read decisions. A Mystic-side authenticated
link-code flow is the alternative: prove possession inside the existing BBS
session and exchange a random, short-lived, single-use code with the web service.
Neither is implemented or presumed available. Deployment requires knowing the
installed version and a supported native interface/VM execution channel.

Before enabling login, implement and test shared persistent session/rate-limit
storage (not per-process memory), opaque random session tokens stored as hashes,
rotation on login, revocation on logout/account changes, absolute and idle
expiration, Secure/HttpOnly/SameSite cookies, strict Origin/CSRF protection for
mutations, bounded request bodies, generic failures and secret-free logging.

## Authorization investigation

The mounted definitions distinguish ListACS, ReadACS, PostACS, SysopACS and two
additional expressions. Existing parser offsets retain the first four as raw
data; inferred groups are informational. Official ACS includes Boolean logic,
security, group context, permanent user ID, access flags and session-dependent
conditions. A user profile containing only a security level is insufficient.
Group selection/context and profile expiration must be verified natively.

Use current native per-area allow/deny decisions or a version-verified evaluator;
unknown syntax/context, stale identity, missing area or unavailable bridge must
deny. Exclude private/local-personal and Netmail areas using verified area type
metadata, not names or inferred groups. Filter private messages again at the
storage boundary. Centralize checks in a server-only data access service reused
by SSR and API handlers, and test both surfaces against bypasses and revocation.

## JAM attribution

JAM(mbp) - Copyright 1993 Joaquim Homrighausen, Andrew Milner,
Mats Birch, Mats Wallin. ALL RIGHTS RESERVED.

Format source: JAM-001, revision 001, July 1, 1993, by those authors;
https://gist.github.com/barvaz2/a7375c615bc4add732bff0e3d352813c
(mirror of the original specification).
