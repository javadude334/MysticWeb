# Sandbox milestone: identity and per-account access

Browser login remains disabled. This milestone uses only E:\mystic native data,
with test (permanent ID 1) and javadude2 (permanent ID 2). The operator independently
confirmed both IDs in the native User Editor and confirmed all E:\mystic data is
disposable. Existing message files and last-read pointers must still be preserved.

## Established facts

- Earlier operator NNTPS results establish correct-password acceptance and generated
  wrong-password denial over certificate-validated TLS. No password-only retest is
  needed. Authenticating the two accounts below establishes their test connections.
- A48 records.112 identifies PermIdx as permanent identity, and flags 1/4/1024 as
  locked/deleted/forced-password-change. Bounded metadata-only reads match the two
  operator-confirmed IDs and handles. Password fields are skipped entirely. Clear
  veto bits are not complete eligibility certification (expiry/password age remain).
- Standard AUTHINFO success is a Boolean protocol result, not a permanent-ID or
  eligibility response. No documented Mystic NNTPS WHOAMI/current-account query was
  found. getuserid and user['id'] are documented in the embedded native runtime;
  no supported secure standalone invocation of those functions has been established.
- Mystic's documented U# ACS predicate checks permanent identity. Controlled U1/U2
  areas can independently test which identity NNTPS evaluates, without implementing
  a guessed account resolver. This is a fixture proof, not yet a general runtime
  binding for arbitrary web users.
- Read-only locking preflight passed on all twelve public .jhr/.jdt/.jdx/.jlr files.
  While locks were held, Windows denied write-capable handles to the existing
  general-message .jhr and .jlr; no bytes were written. Config topology is pinned
  to the locked catalog, with only planned ACS edits allowed between phases.
- Ten focused TLS adapter tests pass, including denial recovery for metadata-only
  probes without reauthentication or message-reading commands. TypeScript and
  focused lint pass. These are helper/transport results, not live ACS proof.

## Run the operator verification

From PowerShell:

```
cd E:\work\javadude_dev\MysticWeb
node .\scripts\sandbox-account-access.cjs
```

The first temporary editor setup is:

| Fixture | Rule |
| --- | --- |
| TestNET group ID 2 ACS | s0 |
| Area ID 2 ListACS / ReadACS | u1 / u1 |
| Area ID 5 ListACS / ReadACS | u2 / u2 |

Only set these in E:\mystic's native editor. The verifier checks saved rules before
prompting for the two masked passwords. It never stores credentials, sends them
as arguments, or silently reconnects. It keeps the original connections alive
with bounded CAPABILITIES calls while the operator makes subsequent editor edits.

The verifier prompts for each isolated phase: identity/list baseline; independent
ReadACS; independent ListACS; TestNET group ACS; correct and wrong group context;
an allowed baseline followed by read-permission revocation; and another allowed
baseline followed by locking user ID 1. Changes happen through the native editor,
not by patching user/configuration records. Each phase validates current config
before and after native calls. It sends only AUTHINFO, CAPABILITIES, LIST, GROUP
and QUIT. ARTICLE, OVER, STAT, HEAD, BODY and direct JAM content reads are absent.

A metadata GROUP success is never an assumed ReadACS grant. The independent
ReadACS phase must demonstrate an allowed selection for ID 1 and a native denial
for ID 2 with ListACS open. If GROUP does not enforce ReadACS, it cannot authorize
the direct JAM reader. The operator output records that failure rather than using
list visibility or a security-level approximation as replacement authorization.
Known complete GROUP denial responses 411/450 can preserve a diagnostic connection;
other errors close it. Content methods retain their original close-on-error rules.

The same open connections are used for revocation; lost connections/restarts are
not silently replaced or counted as proof of account-policy refresh. Native private
or netmail group names appearing in LIST stop the run. No direct message access
will run while identity/current eligibility/read authorization are uncertified.
The report explicitly distinguishes NOT_RUN from a verified denied read.

Q stops the workflow. Restore the recorded original settings through the editor:
user ID 1 Locked Out=No; area 2 ListACS/ReadACS=s10g1; area 5=s10g2; TestNET group
ID 2 ACS=s20. The tool prints this reminder. Area 6 (Amateur Radio) is not edited;
its message data and the all-read/unread fixtures remain intact.

`--preflight` performs only ownership, metadata and read-only-lock checks; it
collects no passwords, sends no native commands, and changes no configuration.

## Current unverified requirements and stop conditions

Native U# identity assertions, ListACS, ReadACS, group/context behavior and live
revocation are awaiting the operator run. Full current eligibility remains missing:
NNTPS has no established current-account query, and all required expiry/password-age
and forced-change semantics are not certified. A successful fixture identity test
will not be turned into a fabricated NativeProvider with active/permissions=true.

Even if all metadata tests pass, the general permanent-ID/current-eligibility
binding must be solved before isolated browser sessions are composed. Until then,
per-account direct message reads, browser login/logout, concurrent web sessions
and browser revocation checks are NOT RUN. Existing routes continue returning
unavailable rather than granting access. No cookies are issued by this verifier.

If native LIST or GROUP requires a write-capable file open, the sharing locks may
make the native probe unavailable. Do not weaken the locks to get a green result.
That is a concrete no-write adapter limitation. The existing direct read-only JAM
reader remains storage-ready, but still needs a verified native permission grant.

References: installed A48 docs/records.112, docs/whatsnew.txt; official ACS U#
reference https://wiki.mysticbbs.com/doku.php?id=access_control; standard AUTHINFO
https://www.rfc-editor.org/rfc/rfc4643. No public documentation substitutes for
live sandbox results.

The guard additionally locks existing private/netmail message files, without
reading their contents. An absent private last-read file is not created. Final
preflight passed with this wider guard. During the run, catalog topology is pinned
so adding bases, changing paths/newsgroup names, changing privacy or replacing group
identities stops probes instead of redirecting them to unlocked files. Only the
planned area 2/5 ListACS/ReadACS and group 2 ACS edits are accepted between phases.

## Operator baseline result — October 29, 2026

Both disposable accounts completed NNTPS authentication. With group 2 ACS s0,
area 2 ListACS/ReadACS u1, and area 5 ListACS/ReadACS u2, both accounts
reported listed=false and GROUP selection status 411 for both areas. Baseline
result: FAIL_OR_INCONCLUSIVE. No identity, group/ListACS/ReadACS separation or
revocation claim follows from these denials. No direct messages or browser
sessions were requested. The harness reported its message/read-pointer locks
were held; this is not an independent before/after file hash measurement.

Unresolved causes include native catalog reload behavior, native area filtering,
and inability to open JAM files under read-only sharing locks. None is yet
established. Do not remove write prevention or weaken ACS to obtain a pass.
Before another credential run, diagnose native catalog/file-open behavior with
metadata-only observation. Restore the documented original fixture settings
when ending this experiment. General NNTPS identity/current eligibility remains
unsupported by the capabilities established so far.

Operator selected group 2 ACS s10 as the restoration baseline after this run;
use s10 for future cleanup, superseding the original s20 setting.


## File-open diagnostic without fixture edits

After configuring Process Monitor for the verified sandbox listener PID and paths
beginning E:\mystic\, enable Drop Filtered Events before capture. Do not capture
network or process-start events or export an unfiltered log. Start capture, run
`node scripts/sandbox-account-access.cjs --diagnostic`, and stop capture promptly.
This mode uses the current ACS settings and one masked test-account login; it
retains all message sharing locks and sends LIST/GROUP only, with no native
ARTICLE/OVER or web session. Results are observations, not authorization grants.
Inspect CreateFile failures for the fixture JAM paths and record only operation,
JAM extension, status and requested access. A sharing violation supports the
lock-conflict explanation; its absence alone does not certify permissions.

## Follow-up after sandbox MIS restart

Operator reran current-settings diagnostic after restarting E: MIS. Both fixture
areas again returned listed=false, selected=false, nativeStatus=411 for test.
The earlier filtered trace contained no mbases.dat or .jhr match; this does not
establish absence of native I/O (cached handles and capture coverage unresolved).
Read-only config inspection confirms SystemPath/DataPath/LogsPath/MsgsPath/
ThemePath resolve lexically to E:\mystic and its subdirectories.
A bounded metadata read of the records.112-derived packed RecUser Security offset
1011 returned 0 for IDs 1 and 2, with LockedOut clear. Password and personal-data
ranges were skipped. Native User Editor confirmation of Security is required
before treating this layout-based observation as verified account state. At the
restored s10/s20 thresholds, level 0 would explain denial; it does not explain or
certify the earlier u1/u2 experiment. Do not lower thresholds or fabricate grants.

## Native User Editor correction

Operator independently confirmed Security Level: test (ID 1) = 255;
javadude2 (ID 2) = 10. These replace the incorrect offset-1011 interpretation
above. That offset has not been validated against the installed account layout
and must not be used for eligibility or security decisions. No production code
uses that one-off diagnostic read as an authorization grant. Both confirmed
levels satisfy an s10 minimum; group context and native NNTP catalog filtering
remain unresolved. No further password test is justified by this correction alone.
