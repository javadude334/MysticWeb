# Mystic Linux 1.12 A48 — Ghidra export status

## Verified source archive

User-supplied `MysticWeb_Full_Decompilation_2026-11-04.zip` contains `decompiled/mystic_all_functions.c` (4,258,985 bytes), saved Ghidra project, original `mystic_elf32`, disassembly, and previous reference materials. Ghidra 12.2 log reports **1,964 functions exported, 0 export failures**. Export failure count does not establish completeness or correctness of reconstructed program semantics. The C-like pseudocode is not original Mystic source.

**Archive custody:** Keep original ZIP outside public repository and retain a local backup. The GitHub documentation is not a substitute for the executable and Ghidra project. Future investigations require the ZIP to be accessible again (attach to conversation or place in an accessible private repository).

## ACS security status

The new decompilation is enough to begin instruction-level tracing, but does **not yet prove** correct authorization logic. A first scan of exported pseudocode found no plain-text references to `listacs`, `readacs`, `postacs`, or `acsnogroup`: string references must be traced through the executable's data addresses and code cross-references in the saved Ghidra project. Labels in binary strings alone are not proof of semantics.

Before broadening message-area access:
1. Identify evaluator function addresses and call sites for List/Read/Post ACS; annotate evidence.
2. Establish actual grammar, conjunction/disjunction, default/empty expressions, group/security/flag checks and unknown tokens.
3. Decode group Access/Hidden, area kind/hidden and any per-user access attributes.
4. Verify exceptional area #1 and exclude private/NetMail/unknown area types from public reader.
5. Compare authorized and denied cases with Mystic's native behavior across users and groups.
6. Add regression tests and fail closed on unsupported cases.

**Do not remove** `MYSTICWEB_SANDBOX_READ_AREAS=23,119` merely because the decompilation succeeded. `src/lib/mystic/acs-candidate.ts` remains diagnostic-only, and native provider message-area authorization remains denied until evidence and tests support implementation.

## Research workflow

For each question: consult the Ghidra project and decompiled pseudocode, record function address + code/data xrefs + conclusion + confidence, update topic-specific docs, implement TypeScript, then run focused sandbox verification. Keep recovered proprietary binary and pseudocode outside the public application source repository unless redistribution rights are confirmed.
