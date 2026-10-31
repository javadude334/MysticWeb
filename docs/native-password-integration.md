# Native Mystic password verification — staged integration

This branch adds `src/lib/mystic/native-password.ts`, a **read-only** verifier for
Mystic BBS 1.12 A48 password storage method 2.

## Verified algorithm
- Native user record: 1,536 bytes
- User ID: little-endian 32-bit at offset 0
- Method: byte at offset 8; method 2 supported
- Iterations: little-endian 32-bit at offsets 9–12
- Salt: bytes 13–44 (32 bytes)
- Stored derived key: bytes 45–108 (64 bytes)
- Derivation: `PBKDF2-HMAC-SHA512(SHA512(UTF8(password)), salt, iterations, 64)`
- Compare with timing-safe equality

## Integration boundary
The verifier is server-only and can be called by the existing native identity
adapter. It is **not yet connected to `productionAccess()` or the public
`/login` form**, because doing so without the remaining account policy would
permit locked/deleted/expired users to obtain sessions.

Before enabling live sign-in:
1. Map username/handle to permanent user ID using authoritative 1.12 record layout.
2. Map and enforce deleted, locked, expired and password-change-required fields.
3. Revalidate account status on every protected request and enforce area permissions.
4. Configure the existing persistent session/rate-limit service and HTTPS origin.
5. Test against disposable sandbox records and negative cases; never use real credentials in tests.

Do not commit `users.dat`, salts, hashes, passwords, or Mystic executables.

## 2026-10-31 — Username and status research

The controlled two-record A48 sandbox file has Pascal length-prefixed handles at
record offset **109** (maximum 30 bytes) and real names at **140** (maximum 30
bytes). Both records consistently exhibit these positions. This is stronger
evidence than an offset guess, but does not establish whether the BBS permits
login by real name, handle, or both.

`src/lib/mystic/native-user-login.ts` stages read-only handle lookup, method-2
password verification and conservative rejection of locked (0x1), deleted
(0x4), and forced-password-change (0x400) records. It rejects duplicate
handles and unsupported non-ASCII handle encodings. The lockout and forced
password change flags were observed in A48 machine code; deleted 0x4 is
supported by older Mystic Pascal source but still needs direct A48 confirmation.

**Not production-ready:** current A48 password-change interval and account
expiration semantics, full username matching, legacy password methods, and
live account status revalidation remain unresolved. The public login endpoint
must remain disabled. No test account files were committed.

## Synthetic regression tests (2026-10-31)

Run `npm test` (or `node --test tests/native-user-login.test.cjs`) after checking out this branch and installing dependencies. The tests construct synthetic 1,536-byte A48-style method-2 user records; they exercise handle lookup, PBKDF2-SHA512 verification, rejection of locked/deleted/forced-change accounts, duplicate handles, malformed records and invalid input. These are **not** evidence of successful login against a real Mystic installation. The tests have been committed but were not executed in the GitHub connector environment. Do not enable production login until live sandbox compatibility, native account expiry semantics and safe session revalidation have been verified.
