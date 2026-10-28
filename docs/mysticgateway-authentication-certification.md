# Mystic A48 authentication certification plan

Status: **BLOCKED — native verification not available to the standalone gateway**. This document does not authorize production activation.

## Verified evidence
- A disposable 64-bit Mystic BBS 1.12 A48 installation is at `E:\mystic`. Production `D:\mystic` must not be touched.
- The standalone Free Pascal diagnostic executable is built by Windows GitHub Actions and passes read-only structural diagnostics on two user-record slots (1,536 bytes each).
- In a native embedded Mystic Python session, `mystic_bbs.getuserid(uid)` and `mystic_bbs.isuserpw(record["pwdata"], candidate)` verified a real sandbox password and rejected an incorrect one.
- This does **not** establish that a separate executable can call `isuserpw`, nor certify account flags or ACS semantics.

## Unresolved integration choice
Investigate **documented Mystic-supported native invocation** first. Require a bounded, authenticated, identity-bound interface which does not borrow another terminal session's user context, does not put credentials in process arguments or logs, and does not require an additional deployed runtime. Do not assume such an interface exists. If unavailable, investigate a standalone verifier only with authoritative A48 password encoding and independent native comparison. Never guess a hash algorithm.

## Required proof before any login endpoint
1. Authoritative A48 user schema, ID lookup, account flags, and eligibility rules verified from Mystic's own definitions/behavior.
2. Native verification or an independently certified equivalent for correct password, wrong password, empty password, cross-account password, disabled/locked/deleted account, and password-change-required state.
3. No credential logging, no command-line passwords, no plaintext persistence, timing/rate limiting and transport authentication.
4. Session identity bound to the verified account across requests and logout; no cross-user data exposure.
5. Requested-user group/ListACS/ReadACS evaluation independently validated before any message browsing.
6. Concurrency and file sharing tested in sandbox without mutating live BBS state.
7. Separate explicit security review and activation decision. Production remains disabled until then.

## Current executable behavior
`--authenticate` is intentionally rejected with exit code **11**, including when invoked with extra arguments. It does not read or process credentials. CI asserts this denial, along with sandbox-root and default-invocation denial. `--diagnose-all` remains the consolidated read-only structural diagnostic. A green CI build is **not** authentication certification.

## Next research input
Obtain the relevant A48 native record definitions (sandbox `docs\records.112`), and documented supported Mystic scripting/module invocation methods. Review without copying real passwords, pwdata, or identifiable account records into GitHub, chat, or logs. Identify a supported native verification path before implementing any credential handling.
