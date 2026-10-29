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
