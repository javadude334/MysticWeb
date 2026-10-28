# A48 binding certification — October 28, 2026

Status: **NOT CERTIFIED / AUTH DISABLED**. No BBS execution or changes were
performed. This work continues PR #12 from dcbcfda. PR #11 remains at 1949d39;
its in-session MPL evidence is not evidence for arbitrary-user Python checks.

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
