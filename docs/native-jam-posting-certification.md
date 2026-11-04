# Native JAM posting: implementation and certification gate

Status: **writer not implemented; web posting disabled**. This document distinguishes
facts verified by MysticWeb's reader from assumptions requiring a disposable Mystic
runtime. Never run this procedure against the live `D:\\mystic\\messages` tree.

## Existing interfaces

- `src/lib/mystic/poster.ts`: `NativeMessagePoster.post(identity,draft,signal)`
  returns `{areaId,messageNumber,replyTo}`. The boundary checks instance,
  draft shape, timeout and receipt; it does **not** authorize an area.
- `src/lib/mystic/native-post-preflight.ts`: pure Post ACS/public echo
  preflight and reply-parent check. This is not a substitute for native
  authorization.
- `src/lib/mystic/disposable-post-model.ts`: test-only in-memory ordering
  model. It does not write JAM or prove locking compatibility.
- `src/lib/mystic/jam.ts`: read-only JAM reader. It expects `.jhr`, `.jdx`,
  `.jdt`; `.jlr` remains read-only. Its accepted layouts are **reader
  expectations**, not proof of Mystic's writer semantics.

## Known reader expectations, not a writer recipe

The reader observes a 1024-byte JAM base header with signature `JAM\\0`,
first-message number at offset 20, 8-byte index entries, and 76-byte message
headers followed by subfields. It checks revision 1, index/header message
number consistency, body offsets and sizes, and rejects hidden/private/netmail
records. These observations do not establish the correct writer transaction,
CRC fields, timestamps, counters, reply-chain mutation, text encoding,
echomail export or locking behavior. Do not append records from these offsets.

## Certification steps (all NOT RUN until operator evidence exists)

1. **Disposable copy and isolation.** Use a dedicated offline sandbox area,
   not a shared or live message base. Record the exact Mystic version and
   filesystem paths. Resolve junctions/symlinks and verify every writable path
   stays inside the disposable root. Preserve an immutable before-snapshot.
2. **Native reference behavior.** In the Mystic UI, post one new public echo
   message and one reply with distinct subjects. Snapshot all associated files
   before and after each operation. Identify changes to `.jhr`, `.jdx`,
   `.jdt`, `.jlr`, `.xlr` and any network queue/metadata files without
   assuming the last two are safe to edit.
3. **Locking and concurrent writes.** Establish the installed Mystic version's
   supported JAM lock mechanism and ownership semantics from native code/docs
   or a controlled experiment. Test simultaneous Mystic-native posts and
   reads. A successful single append is insufficient.
4. **Message identity and replies.** Verify how new numbers are allocated,
   what happens after deletions/packing, how parent first-reply and sibling
   next-reply links change, and whether Message-ID/Reply-ID are required.
5. **Encoding and network export.** Confirm the native charset, subfield
   formatting, message flags, origin/tearline and echomail tossing/export
   behavior. A locally readable message is not necessarily exportable.
6. **Atomicity and recovery.** Test interrupted writes on disposable copies;
   establish a safe rollback/recovery mechanism. Never test interruption on
   live files. Verify a failed operation leaves a readable, consistent base.
7. **Identity/ACS.** Revalidate active account, current catalog revision,
   group/List/Read/Post ACS, public echo kind, and visible reply parent inside
   the native writer immediately before mutation. Recheck after queueing.
   Browser-supplied IDs and paths are never authoritative.
8. **Acceptance matrix.** Native Mystic and MysticWeb must both read new posts
   and replies after restart. Concurrent posting, revocation, stale catalog,
   missing/deleted parent, timeout, cancellation, disk error, malformed draft,
   private/netmail area and path escape must all fail safely.
9. **Explicit activation review.** Only after runtime evidence passes, build
   a separate, reviewed sandbox-only composition and API route with same-origin
   CSRF protection and session/account checks. Keep production disabled until
   a separate approval.

## Evidence log template

| Gate | Version / fixture | Result | Evidence / issue |
| --- | --- | --- | --- |
| Disposable path isolation | | NOT RUN | |
| Native before/after diff | | NOT RUN | |
| Locking and concurrency | | NOT RUN | |
| Numbering and reply chain | | NOT RUN | |
| Charset and export | | NOT RUN | |
| Crash/recovery | | NOT RUN | |
| Current-account Post ACS | | NOT RUN | |
| Dual-reader acceptance | | NOT RUN | |
| Activation review | | NOT RUN | |

**Stop condition:** if locking, native authorization or recovery cannot be
established, do not enable web posting and do not substitute a direct
Next.js file append. Use a certified Mystic-native posting mechanism instead.
