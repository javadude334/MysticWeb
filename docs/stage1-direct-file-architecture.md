# MysticWeb Stage 1 — direct-file architecture (2026-11-04)

## Binding decision
MysticWeb accesses Mystic 1.12 A48 native DAT and JAM files directly through the local filesystem. There is **no Mystic SSL/TCP/SSH/Telnet listener, native bridge, mTLS worker, or socket authorization service** in the supported design. Browser-to-Next.js HTTPS is independent of this decision.

Development sandbox root: `C:\MysticSandbox`. Production root is separately operator-configured and must not be touched during Stage 1 certification. Do not assume historical `E:\mystic` paths remain valid. Resolve the configured message-base directory inside the sandbox and inspect any old absolute paths in copied `mystic.dat` before attempting a read.

## Stage 1 completion gates
1. Read-only validation of copied `data/groups_g.dat`, `data/mbases.dat`, `data/users.dat`, `mystic.dat` and referenced JAM files, including path containment and reparse-point/junction protections.
2. Establish the *effective* per-user group membership, account eligibility, area kind, List ACS and Read ACS semantics from verified A48 native records and documentation/test evidence. An inferred G/S security-level candidate is NOT sufficient authorization. Unknown expressions and ambiguous mappings deny.
3. Implement an in-process, local-file authorization provider. Bind every read to permanent native user ID, current account snapshot, verified catalog revision and area/group access. Recheck before each direct message read and fail closed on mutations.
4. Compose the authenticated reader in a **sandbox-only** deployment and test two accounts with different permissions. Keep production activation disabled until reviewed separately.
5. Verify group dropdown, clickable areas, message bodies, pagination, reply links, hidden/private filtering, and no JAM opens for denied requests. Run lint, typecheck, tests and build.

## Current limitations
The existing `NativeFileProvider` authenticates and checks partial account status but deliberately denies area authorization. `productionAccess()` returns null. `sandboxMessages()` is an explicitly allowlisted development preview, not a native-ACS-certified reader. The existing native transport/worker code is legacy exploratory material, **not** the selected integration mechanism.

Reading DAT/JAM files does not require a running Mystic process. Direct JAM writes for Stage 2 require independent investigation of locking, durability, reply linkage and network export; do not infer that safe writing follows from safe reading.

## Offline operator validation
From the MysticWeb checkout in PowerShell, with the sandbox copied locally:

```powershell
$env:MYSTIC_DATA_ROOT = 'C:\MysticSandbox'
npm run mystic:validate
npm run mystic:jam:validate
```

The JAM validator currently follows the message-base path embedded in `mystic.dat`; a copied sandbox may still reference an obsolete drive. Do not modify the live BBS to make this check pass. The outputs are aggregate diagnostics, not authorization proof. Do not upload user credentials, raw `users.dat` or private message bodies.
