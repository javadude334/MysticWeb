# MysticWeb native message-reader integration checklist

Status: **not activated**. The production `/api/messages` route intentionally returns 503 while `productionAccess()` is unconfigured. Passing unit tests does not establish real Mystic ACS compatibility.

## Verified sandbox baseline (2026-11-03)

- Mystic sandbox: `C:\MysticSandbox` (Windows).
- 406 configured message areas; group selector displays 404 areas across five groups.
- Group 1 Default Message Group: 1 visible area; group 2 Test Network Group: 3; group 3 General Interest: 72; group 4 Other Networks & International: 209; group 5 Technology & BBS: 119.
- The two-area difference must be investigated using native visibility rules; do not expose them by inference.
- The organizer changed List/Read/Post ACS to `g3`, `g4`, or `g5` for 400 areas; existing Sysop ACS and restricted areas were preserved.
- A read-only JAM validator previously accessed 419 bases before cleanup; rerun against the **current** 406-area configuration.

## Existing implementation

- `src/lib/mystic/config.ts` parses group and area records. It **does not authorize** users.
- `src/lib/mystic/jam.ts` reads public JAM headers/bodies and excludes private, netmail, deleted, hidden and protected messages.
- `src/lib/mystic/reader.ts` requires a verified catalog with explicit `kind: "echo"` and verified `groupIds`; it calls `NativeAccess.readArea` before opening storage.
- `src/lib/auth/native.ts` checks a nonce-bound response from an independently trusted native provider.
- `src/lib/auth/native-user-login.ts` is a limited, read-only password candidate; it is not full Mystic account policy.
- `src/lib/auth/transport.ts` supports mTLS but is not a native driver.
- `src/lib/auth/service.ts` has an explicit `productionAccess(): null` guard. Do not bypass it.

## Required before enabling live reads

1. Establish Mystic A48 group and area ACS semantics against native `mystic -cfg` and test accounts (including group access, security levels, blank ACS, unusual `%` expressions, and area membership). Never treat `gN` text matching alone as authorization.
2. Verify the native group identifiers, ordering, area kind and storage paths from the binary records. Do not infer echo/private/netmail classification from filenames.
3. Implement a local sandbox native driver that verifies account eligibility on **every** request, evaluates the current group/List/Read ACS, and returns exact nonce, instance, user ID, area ID, and catalog revision. It must deny by default on unsupported ACS.
4. Bind catalog revision to the exact `groups_g.dat` and `mbases.dat` snapshot and reject any change during authorization and JAM access.
5. Reconcile per-area JAM paths: the existing `MessageReader` takes a single root; do not assume all configured areas share that root.
6. Ensure the 406-area catalog is performant: the current `MessageReader.areas()` performs sequential native checks with a 4-second deadline. Do not simply raise the deadline or disable checks; design a bounded, revision-bound batch authorization path.
7. Compose `WebAccess` explicitly for sandbox only after an end-to-end integration test. Keep deployment on davesbbs.com disabled until verified and approved.

## Acceptance tests

- A valid Mystic account can list only the groups/areas allowed by native group, List and Read ACS, and read a real public JAM message body.
- A lower-security account cannot see Group 3/4 where group access is `s20`; revoked, locked, deleted and forced-change accounts cannot reuse sessions.
- Private mail, netmail, password-protected bases, malformed JAM and areas with unsupported ACS never leak metadata or body content.
- A configuration edit or account permission change invalidates previously authorized reads.
- Native Mystic and MysticWeb show the same accessible group/area membership for two distinct accounts.
- Posting and replies remain disabled until a separate, authenticated, atomic JAM writer is verified against native Mystic.
