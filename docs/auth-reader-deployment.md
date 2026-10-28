# Authenticated read-only message integration (staging only)

## Delivered and disabled

PR #8 sessions are reused; the PR #10 boundary is brought onto main's lineage
because #10 merged into feature/auth-session-foundation rather than main.
PR #11 owns native probes and runtime evidence; this change does not edit its
branch or those files.

The web service supports bounded JSON sign-in, exact HTTPS Origin checks,
persistent global/client/account throttles, token rotation, logout, current account
checks and per-area native checks before JAM access. Only numeric IDs and bounded
pagination are accepted. Catalogs are capped at 512 areas; area listing has a four-second
budget and discards incomplete results. Responses are private/no-store, plain JSON with minimal
display fields. No JAM writes, last-read writes, native record dumps, credential
files, passwords in command lines, or password logs are implemented. JavaScript
and Python strings cannot be reliably zeroed; passwords exist transiently in
memory. Raw request buffers are cleared where practical. Disable request-body,
exception-local, tracing and crash-dump capture on both hosts.

The Python 2.7-compatible BBS dispatcher validates exact protocol shape, checks
the requested user's password through a supplied native driver, rejects all
unknown account states, and requires current group/context/ListACS/ReadACS
permissions. Use one BridgeDispatcher per runtime; it rejects concurrent native
calls and keeps a bounded 60-second nonce replay cache. Clock rollback and cache
exhaustion deny. It defaults to denial with no driver. It is **not** a verified
Mystic driver or a running bridge server. The HTTPS client requires CA-validated
mutual TLS, bounds concurrency and bytes, times out/cancels and never retries.
No listener or native process launcher is installed.

**Production composition returns null unconditionally.** There is no environment
flag to enable authentication. Endpoints return 503 without reading credentials
when unconfigured; the public login page remains disabled. A later reviewed
composition change must supply a verified runtime driver, server, trusted proxy
client identity, persistent private AuthStore, catalog snapshot loader and mTLS
transport. Synthetic tests do not authorize production activation.

## Operator evidence update — October 27, 2026

The operator reports running the PR #11 native masked-input probe as the ordinary
`javadude` BBS user with one deliberately wrong password:

```text
NATIVE_PASSWORD_MATCH: FALSE
NATIVE_TRUE_CHECK: TRUE
NATIVE_FALSE_CHECK: TRUE
```

The earlier correct-password run returned all three TRUE. The false-check TRUE
means the constant false ACS was correctly denied. These are operator-reported
results, not a local rerun or CI evidence. The latest report establishes ordinary
account context for the negative run; it does not retroactively establish that
context for every earlier run. No credential or password-derived bytes are retained.
The planned wrong-password check is complete; do not ask the operator to repeat it.
Pause and cleanup completion, arbitrary-user verification, account-state and
per-area authorization remain separate checks. PR #11 receives this evidence as
a comment; its branch and probe sources remain untouched.

## Confirmed API semantics and invocation limits

Official [Python changelog](https://www.wiki.mysticbbs.com/doku.php?id=whats_new_112)
documents isuserpw(user_password_data, password) against a user dictionary's pwdata.
It does not document that access() can take an arbitrary remote user identity.
The [Python examples](https://www.wiki.mysticbbs.com/doku.php?id=python_examples)
use getuser(0) for the current session. Never use an operator's getuser(0) record
or access() result as another user's verification.

The [command-line reference](https://wiki.mysticbbs.com/doku.php?id=introduction)
documents -AUTH username password and -U/-P with -X/-Y. These accept credentials
as process arguments. They are unsuitable for this implementation's no-password
logging/storage boundary; do not wrap them in SSH, PowerShell or subprocess.
-AUTH's Boolean result also does not establish permanent ID, account state or
area permissions. No safe unattended native invocation has yet been proved.

Reported Windows A48 results prove callable/schema presence and an in-session
MPL password match with true/false controls. They do not prove arbitrary-user
Python verification, name resolution, permanent ID mapping, account flags or
remote group context. PR #11 remains the source of that evidence.

The [A48 feasibility review](native-driver-feasibility.md) distinguishes the
installed documentation/examples from runtime proof and records the next isolated
two-account experiment. No credential-bearing command was executed during review.

A feasible design still to prove is a bounded native-session worker which accepts
requests only over a private authenticated encrypted channel, serializes context,
evaluates the requested user's actual effective groups and restores context.
It must not mutate user records merely to impersonate a user. If this cannot be
proved safely, use a separately designed short-lived, single-use session-link
challenge. That alternative must still solve current account and per-area checks.

## Native driver contract

resolve(name) returns a verified permanent user ID, never physical slot position.
verify_password(id, password) must load that exact user's native record and call
the supported native password checker. Missing/ambiguous names deny.
account(id) maps every required status field from verified A48 semantics, with
unknown flags/types denying. Never default missing flags to false.

authorize(id, areaId) must independently load a coherent trusted native catalog,
compute the revision and evaluate effective group access and both ListACS and
ReadACS in that user's correct area/group context. No inferredGroupId shortcut.
It returns explicit echo/nonprivate/nonpersonal metadata or denial. List and read
are both required even for listing area names. Unsupported ACS or context denies.
The whole request must be serialized in the runtime; restore context on errors.
Revalidate current account state after authorization.

Catalog revision is SHA-256 of UTF-8 "MysticWeb/catalog/v1" followed by NUL, then
for groups_g.dat and mbases.dat respectively: ASCII decimal byte length, colon,
and exact file bytes. The web and native loader must independently compute it.
Supply the web catalog from the same coherent snapshot, with trusted ID/base
mapping. A catalog hash alone is no proof of correct mapping. The reader checks
the revision again after storage. Preserve the existing JAM confinement, hidden
record filtering and read-only coherent snapshot requirements.

## Windows deployment sequence

These are ordered staging milestones, not instructions to turn on live auth.
Perform one milestone at a time and record only PASS/FAIL plus sanitized IDs/types,
never passwords, hashes, native user records or message text.

1. **Complete:** ordinary-account wrong-password rejection and both constant ACS
   controls were reported on October 27, 2026; see the evidence above.
2. Confirm the probe's pause and cleanup using PR #11 instructions. Retain the
   established PYTHONHOME/PYTHONPATH and 32-bit DLL configuration there.
3. Prove exact other-user record lookup and permanent-ID mapping with two test
   accounts. Prove case/alias handling, no nonexistent-user fallback and no slot/ID
   confusion. Do not enable a bridge until this works without credential arguments.
4. With disposable accounts, test deleted, locked, expired and forced-change
   states separately. Each must deny login and revoke existing web sessions.
5. Prove one allowed and one denied group/ListACS/ReadACS area for each account,
   including changing permissions between reads and group-dependent ACS.
6. Implement/review a native driver and authenticated listener around bridge_core.
   Install outside the public web root with dedicated Windows service ACLs;
   restrict access to the web host's private address and client certificate.
   Never expose a Python 2.7 listener directly to the internet. The modern TLS
   endpoint must authenticate the caller and securely bind to the native worker;
   a reverse proxy alone does not supply native user context. No listener is
   provided here because that invocation is unproved.
7. Provision dedicated CA/server/client certificates, short timeouts, bounded
   workers, no body logs and a cancellation path. Verify wrong CA/client cert,
   unavailable worker, malformed/oversized replies and replay all deny.
8. On the web host use supported Node 24+, private local-disk session storage
   outside releases/mounts, a persistent random rate key, explicit HTTPS origin,
   and a proxy which strips and sets its client identity header. Read-only JAM
   and configuration snapshots must refer to the same Windows installation.
   Do not trust browser-supplied forwarded headers.
9. Review explicit production composition, then in staging test login, restart,
   rotation, logout, account revocation, two simultaneous users, denied areas,
   pagination, direct hidden/private message denial and catalog changes. Confirm
   no credential retention in logs, traces, command lines or files.
10. Only after end-to-end evidence and review, authorize deployment separately.
    Keep login and Messages unavailable until that point.

## Local verification

Run npm test, npm run lint, npx tsc --noEmit and npm run build with the locked
dependencies. Run Python unittest discovery under integrations/mystic/tests.
Run node scripts/smoke-auth-disabled.cjs after building to verify the actual
built HTTP endpoints return 503/no-store without issuing cookies or presenting
a credential form. The check starts and stops its own loopback server.
The dispatcher tests use synthetic drivers on modern Python; A48 Python 2.7
execution is a separate manual check. Neither proves a live native adapter.
