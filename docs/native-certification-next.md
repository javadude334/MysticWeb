# Focused A48 continuation after PR #12

Status on October 28, 2026: **NOT CERTIFIED / PRODUCTION AUTH OFF**.
PR #12 merged as 01e0c36dc667763cb2903dcc7c204e6f6fdfc4f7 after review of
0f425759ece65e9ed474db85837348887f4e9d18. Both jobs passed in
[main CI](https://github.com/javadude334/MysticWeb/actions/runs/40729663761).

## Deliver useful public access first

The next safe functionality is /connect: visible/copyable BBS address, a Telnet
launch link, manual connection steps, troubleshooting and accurate web-login
status. It needs no native data, credentials, account bypass, listener or new
package. Browser clipboard refusal has a manual selection fallback. This does
not supply browser BBS sessions or authenticate anyone. Keep Messages and all
account features disconnected until the gates below pass.

## Sandbox boundary and execution availability

All native work belongs exclusively to disposable E:/mystic, with modifications
already authorized. Before running anything, verify that executable paths,
working directories, data/config paths and service targets resolve inside that
copy; reject junctions or configuration references into production. Stop only
identified sandbox writers when taking offline snapshots. Never open, modify,
launch, stop or reconfigure production D:/mystic as part of certification.

Interactive native Windows app control is unavailable in this session. No native
editor changes or native password/ACS execution were performed in this review.
Do not substitute binary record edits or a terminal echoing secrets for supported
editor and masked-input evidence. Existing operator reports stay attributed as
reports; synthetic tests and loopback mTLS are separate evidence.

## Ordered milestones and stop conditions

1. **Prove requested-user ACS feasibility early.** Use installed A48 documentation
   and an isolated native session to establish a supported way to evaluate another
   permanent ID's actual effective group, area, ListACS and ReadACS, including
   context restoration after failures. Dictionary lookup does not switch context.
   If no supported mechanism exists, stop native integration here and design a
   separate session-link approach; it must still solve current account and area
   checks. Never use the operator's access() result or saved user impersonation.
2. **Bind identity and password data.** Create ordinary disposable A/B accounts
   with distinct passwords and IDs, including an ID different from its physical
   slot. Establish the real dictionary ID mapping and lossless pwdata/opaque
   record binding. Prove coherent snapshot loading and exact handle decoding.
   In both signed-in contexts prove A/A and B/B succeed, crossed credentials and
   nonexistent IDs deny, and the original session identity is unchanged. Missing
   binding or unmasked input stops the milestone. No guessed dictionary keys or
   unconditional callback success is acceptable.
3. **Certify current account policy.** Using the native editor, change only one
   disposable state at a time: locked, deleted, forced password change, expiration
   and password-age rules. Verify native behavior, mapped policy, rejected login
   and existing web-session revocation after a fully isolated composition exists.
   Locked/deleted/forced-change bits already have synthetic veto tests; zero flags
   are not evidence that an account is active. Unknown status must deny.
4. **Certify each permission gate.** Alternate A/B across allowed and denied areas.
   Independently deny group, ListACS, ReadACS and context; test group-dependent
   rules, exceptions/restoration, permission revocation and catalog changes.
   Denials must disclose no area name/body and perform zero JAM opens. Compute
   catalog revision independently at both ends; do not echo the requested hash.
5. **Review and bound the embedded worker.** Establish an authenticated/encrypted
   private channel, serialized native context, deadlines, cancellation, restart
   behavior and minimal service ACLs. The provided modern-Python mTLS listener
   requires an explicit driver, but cannot cancel arbitrary hung native code.
   Missing or stalled workers, replay, wrong CA/client certificate and malformed
   or oversized traffic must fail closed. No credentials in process arguments,
   files, environment, logs, traces or plaintext IPC.
6. **Run isolated native-to-web acceptance.** With disposable private session
   storage and test-only explicit composition, prove B/B creates B's session;
   A-password/B creates zero sessions and no cookie; denied listing/direct-body
   requests perform zero JAM reads. Test restart, rotation, logout, concurrent
   A/B, revocation, pagination and hidden/private filtering. Test record and
   permission changes during reads; do not call snapshot comparisons an atomic
   authorization transaction. Production composition stays null throughout.

## Evidence ledger

Every native milestone above is **NOT RUN in this review**. Record installation
build, code/policy revision, test name, sanitized permanent IDs, PASS/FAIL and
session/JAM-open counts. Retain no credentials, pwdata, hashes, raw user records
or message text. Mark an incomplete test NOT RUN, not PASS. Restore/clean only
disposable accounts and test services after the run.

The detailed [binding test sequence](a48-binding-certification.md) and
[offline status comparison procedure](a48-status-investigation.md) remain the
technical runbooks. Only complete live evidence and a separate production
composition/activation review can authorize authentication enablement.

## Merge verification and deployment distinction

The exact PR head passed hosted frontend and Linux deployment CI, plus local
50 application tests (one Windows permissions skip), 31 Python integration tests
including real loopback mTLS, lint, TypeScript, production build and disabled-auth
HTTP smoke. Windows cannot run the POSIX activation fixtures correctly; the
hosted Ubuntu job passed them. Local Python runtime-revision smoke encountered
a Windows child-process permission restriction; that hosted check passed.

No manual deployment was performed. A public HTTPS health read after the merge
reported revision 67c8ddcdf80ba5585032a6667c1387e53059dc05, so deployment of the
merge was not confirmed at that observation. The configured CI-gated deployment
timer may advance later. Recheck /api/health and compare the exact revision before
calling any release deployed. Merging or passing CI alone is not deployment.
