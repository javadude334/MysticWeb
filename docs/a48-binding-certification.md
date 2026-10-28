# A48 binding certification — October 28, 2026

## Merge disposition update

PR #12 was reviewed and merged to main as
`01e0c36dc667763cb2903dcc7c204e6f6fdfc4f7` with production authentication
unconditionally disabled. Earlier instructions below to keep the PR draft are
historical and superseded by this disposition. Every native activation gate
remains in force. Merge is not native certification or permission to enable auth.
See [the focused continuation plan](native-certification-next.md) for the next
sandbox milestones and evidence requirements.

Status: **NOT CERTIFIED / AUTH DISABLED**. No BBS execution or changes were
performed. This work continues PR #12 from dcbcfda. PR #11 remains at 1949d39;
its in-session MPL evidence is not evidence for arbitrary-user Python checks.

## Windows continuation — October 28, 2026

Continues published status-tool commit `32fa2b1`. The installed sandbox
`records.112` was reread and confirms locked `0x1`, deleted `0x4`, and forced
password change `0x400`. The adapter now independently vetoes these bits for
account queries, password verification, and authorization, even with a permissive
policy callback. Clear bits never supply an active policy: expiration, password
age and other account semantics still require a verified binding. Account and
authorization callbacks now require the complete requested record to remain
unchanged across evaluation. This detects changes, not a coherent snapshot or
an atomic transaction with subsequent JAM reads.

The mTLS listener refuses startup before socket creation when an explicit driver
or any required driver method is absent. This is structural validation only;
passing a driver is not certification. No launcher, subprocess password input,
plaintext pipe, dynamic driver import or Python-2-to-3 worker channel was added.
Do not improvise those mechanisms to bypass the outstanding secure-worker gate.

| Check | This continuation | Remaining evidence |
| --- | --- | --- |
| Locked/deleted/forced-change rejection | Synthetic adapter/dispatcher tests, including direct password calls and permissive policy | Native editor changes, native login behavior, web-session revocation on E:\\mystic |
| Requested-user ACS | Synthetic alternating IDs 42/73; independent list/read/group/context failures; post-ACS revocation | Supported requested-account effective ACS and context restoration on A48 |
| Runtime invocation | Missing/incomplete driver rejected before bind; existing real loopback mTLS tests | Reviewed encrypted/authenticated bounded embedded worker and lifecycle |
| Status races | Full-record changes during account/ACS callbacks deny | Coherent native loading and live concurrency evidence |

Automated synthetic and loopback transport checks can run remotely or unattended
on this host. Native editor/terminal checks require interactive Windows control;
native app APIs are disabled in this session. E:\\mystic is available and sandbox
modifications are authorized, but no editor changes or native password probes
were performed. A process inventory identified the running Mystic executable
as D:\\mystic\\mystic.exe; it was not stopped or operated. Production files were
not opened or modified. No sandbox user records were changed. Production
authentication remains disabled and PR #12 must remain draft.

Validation for this continuation: 31 Python tests passed, including real loopback
mTLS and five new regression cases. Application tests: 50 passed, one expected
Windows/POSIX permissions skip. `git diff --check` passed. These results certify
only the tested synthetic and transport behavior, not native A48 integration.

Follow-up: [status investigation and offline comparison procedure](a48-status-investigation.md)
records newer operator cross-account evidence, the echoed-input limitation and
installed A48 status masks. It does not certify the complete runtime binding.

## Implemented candidate

`integrations/mystic/a48_native_verifier.py` supplies `NativeRecordVerifier` for
the existing `A48Driver` verifier interface. It retrieves the requested permanent
ID with `bbs.getuserid(uid)` and passes that dictionary's `pwdata` to
`bbs.isuserpw`. It never falls back to `getuser(0)` for password data. It rejects
missing/swapped identities, unbound records, nonliteral True results, exceptions,
changed record binding and changed signed-in identity. The adapter still checks
the complete raw record after verification. The dispatcher still checks account
status before and after verification, and permissions before protected reads.

Two installation-specific callbacks are deliberately required:

- `identity(dictionary)` extracts the independently verified permanent ID,
  including from `getuser(0)`. No assumed dictionary ID key is supplied.
- `matches_record(uid, opaque101, dictionary)` returns literal True only if the
  selected native password data is bound to the same adapter snapshot record.
  Its representation must be established on A48. Never implement this as an
  unconditional True, identity-only check or guessed hash/encoding conversion.

The synthetic tests use an invented `id` key and byte-valued `pwdata` solely as
fixtures. They MUST NOT be copied as production callbacks. The candidate is
not a complete binding: coherent loading, exact handle decoding, both callbacks,
account policy, effective ACS and secure embedded-runtime invocation remain
uncertified. There is no worker channel or production composition in this change.

## Evidence for choosing the native API

Read-only installed `E:/mystic/docs/whatsnew.txt:2024` documents `getuserid(ID)`
as permanent-ID lookup returning None when absent. Line 5264 documents
`isuserpw(user_password_data, password)` against a user dictionary's password
data. The public [Python development notes](https://wiki.mysticbbs.com/doku.php?id=python_devnotes)
and [changelog](https://wiki.mysticbbs.com/doku.php?id=whats_new_112)
describe those APIs. This supports a candidate implementation, not a claim that
this installation passes cross-account tests. Neither `access(acs)` nor
`acsnogroup(acs)` establishes arbitrary-user context. Dictionary lookup does not
switch native session, group or area context. Do not implement policy using A's
`access` result for B or by changing/saving user variables.

## Exact isolated BBS test sequence

1. Use a disposable Windows/32 A48 copy matching the reported 2023/01/15 build,
   isolated from production data/services. Record the build and test-copy identity.
   Create ordinary A and B with different passwords and distinct permanent IDs;
   include B whose physical slot differs from its ID. Use the native editor to
   establish expected IDs separately. Do not put passwords in arguments, files,
   environment, logs or transcripts. Do not copy user records into evidence.
2. In a native session as A, verify `getuserid(B_ID)` returns B, missing ID returns
   None, and `getuser(0)` still identifies A. Establish the dictionary permanent-ID
   key by schema plus independent editor comparison. Record PASS/FAIL only.
3. Establish a lossless native `pwdata`/opaque-record comparison from versioned
   A48 definitions or a controlled in-memory comparison. Emit only match/mismatch,
   never repr, bytes, hash, salt or lengths derived from real secrets. If the
   mapping cannot be established, stop: `matches_record` remains unavailable.
4. Supply reviewed callbacks and invoke `NativeRecordVerifier` in the embedded
   runtime with candidates entered using verified native masked input. Test B/B
   succeeds, A-password/B denies, A/A succeeds, B-password/A denies and missing
   ID denies. Repeat while signed in as B. Assert signed-in identity unchanged.
   Any unexpected result stops certification; do not weaken callbacks.
5. Establish every normalized status from A48 semantics: exists, deleted, locked,
   expired and passwordChangeRequired. Change one fixture state at a time using
   the isolated native editor. Verify the dispatcher denies login and existing
   sessions lose access on the next protected request. Unknown fields deny.
6. Require a documented supported mechanism to evaluate requested-account
   effective group, area, ListACS and ReadACS context, with restoration on errors.
   **No such mechanism has been established by this work. Stop here until one is
   verified; do not use current-session access checks as a replacement.** Once
   available, alternate A/B and test group-only, ListACS-only and ReadACS-only
   denial, context-dependent rules, revocation between reads, missing areas and
   independently computed catalog revision mismatch. Every denial must prevent
   area listing, message listing and direct message-body reads before JAM opens.
7. Only after steps 1–6 and a reviewed authenticated/encrypted bounded worker
   channel, connect isolated `A48Driver` -> dispatcher -> mTLS -> `NativeAccess`
   -> `WebAccess` with a disposable persistent session store. B/B must issue a
   session containing B's permanent ID; A-password/B must issue no cookie and
   create zero sessions. Denied areas must expose no names or message content
   and perform zero JAM reads. Test account revocation with an existing session.
8. Save build, revision, callback/policy source revision, named PASS/FAIL results
   and sanitized transport/session/read counts only. Remove disposable accounts,
   credentials, certificates and test services. Keep PR #12 draft and production
   authentication disabled pending evidence review and separate activation work.

## Automated coverage and limits

The new Python tests run the native API candidate through the adapter and
dispatcher with synthetic A/B records; the real loopback mTLS test now includes
B/B success, A-password/B denial and denied authorization. The web regression
uses distinct synthetic A/B passwords, checks B's persisted session identity,
counts session creation on rejection, and checks zero storage reads for denied
list/body requests. These are separate layer tests, not a full live BBS-to-web
certification. Existing session and authorized-reader safeguards are reused.
