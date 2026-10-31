# MysticWeb — Native Mystic authentication research

Updated: 2026-10-31. Status: **research only; no validated verifier**.

## Goal
Reproduce Mystic BBS 1.12 A48 `isuserpw` using **read-only native .dat files**. No SSH, gateway, or second password database. Windows sandbox: `E:\mystic`. Do not modify production (`D:\mystic`).

## Confirmed observations
- Controlled before/after sandbox `users.dat` files are each 3,072 bytes, apparently two 1,536-byte records. Changed account is second record, candidate permanent ID 2.
- Second record offset 8 contains `02`; offsets 9–12 contain little-endian integer 1,000. These align with the configured PBKDF2-SHA512 method and 1,000 iterations, but **field interpretation is not independently verified against 1.12 source**.
- Record-relative offsets 13–108 (96 bytes) changed after the password update. Salt/derived-key structure is a hypothesis, not yet established.
- Linux i386 Mystic 1.12 A48 executable was extracted from supplied installation archive; ELF32, stripped.

## Linux executable landmarks
| Virtual address | Observation | Confidence |
|---|---|---|
| `0x08170310` | SHA-512 round constants | High |
| `0x081123BC` | Reference to SHA-512 round table | High |
| `0x08170590` | SHA-512 initial-state constants | High |
| `0x0811360F` | Copies initial SHA-512 state | High |
| `0x0811366D` | 128-byte block-processing check | High |
| `0x08111F30` | Apparent SHA-512 compression routine | Moderate-high |

## Attempts without a match
- PBKDF2-HMAC-SHA512, 1,000 iterations, obvious 32+64 and 64+32 salt/hash splits.
- Password case/encoding variants and candidate username/user-ID combinations.
These were reported in prior investigation, but exact parameter sweeps were not fully preserved; do not treat as exhaustive.

## Outstanding questions
1. Locate the actual compiled `isuserpw` and HMAC/PBKDF2 caller.
2. Identify exact salt/hash layout, lengths, encoding, and any password preprocessing.
3. Confirm handling of legacy password methods and disabled accounts.
4. Demonstrate correct password accepted, incorrect password rejected, unknown account rejected, all without writing native files.

## Next investigation
Trace SHA-512 callers to HMAC, then PBKDF2 loop and record-field reads. Save each disassembly excerpt, binary fingerprint, test parameters, and outcome. Implement a standalone read-only verifier before integrating into MysticWeb.

## Source fingerprints (SHA-256)
- Linux executable `mystic_linux32_extracted`: `2d02b37ea2910eda0ef9741061910c43e4eb0bede27353e50fb9a0f01d90aef3`
- Windows executable `mystic_sandbox.exe`: `b497e4029349fad3d6aca02d39995df3d56cc4d888aa1e8cdd756fd3a068ebce`
- Before user data: `d5f160c21a2ae1b037e05df835eaebdd5e297ed308e26c105c0a069e427f2f2f`
- After user data: `f12b9f9c6ad2d0a0692c2166466eda0fa91ee4c0a3501e0c450b04744f0525e8`

**Security:** Never commit raw `users.dat`, hashes, salts, credentials, or proprietary executables without explicit authorization. The test password shared during investigation must not be reused on real accounts.
