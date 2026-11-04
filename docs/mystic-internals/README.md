# Mystic internals — evidence-first reference

Target: Mystic BBS 1.12 A48 Linux 32-bit executable; SHA-256 `2d02b37ea2910eda0ef9741061910c43e4eb0bede27353e50fb9a0f01d90aef3`.

Use the separately saved `MysticWeb_Mystic_Internals_Recovery_2026-11-04.zip` for executable, complete assembly, strings, and Ghidra pseudocode export script. **No original Pascal source or completed C pseudocode is included.**

Evidence levels: **binary-confirmed** (verified instruction-level control flow with addresses); **binary-string only** (labels, not semantics); **configuration-observed** (one installation); **sandbox-tested** (runtime); **hypothesis** (unverified).

Workflow: check binary and existing research before asking for experiments; record addresses and evidence; implement only verified semantics; reject unknown permissions; test remaining uncertainty in sandbox. Keep private user databases, credentials and messages out of public repos.

See `acs.md`, `authentication.md`, `message-areas.md`, `jam-messaging.md`, `netmail.md`, `scripting.md`, and `binary-reference.md`.
