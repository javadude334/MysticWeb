# MysticWeb recovery checkpoint — October 28, 2026

Reviewed draft PR #15 at `90526cdfb84632993d7ea4482bee853e721cf2d0`.
Frontend/deployment run 40750171325 passed at that exact head. Windows diagnostic
run 40750135986 passed at ancestor `2585529f1489f02955093fbfc82e52edf665d687`;
no Windows run was returned for the exact head (documentation-only follow-up).

Authentication remains NOT CERTIFIED. Embedded-session password evidence is
operator-reported; it does not prove a standalone verifier, complete account
eligibility, permanent-ID binding, or requested-user group/ListACS/ReadACS.
Keep production authentication disabled. Do not implement guessed password hashes.

Next safe change: harden the metadata-only PowerShell preflight. Check every
path component before traversal, fail nonzero on errors or missing prerequisites,
derive checkout location from the script, and emit output without TEMP/clipboard
side effects. Git metadata commands were removed to avoid repository hooks or
filesystem monitors during this diagnostic. Tool discovery does not execute tools.

Remaining blocker: Pascal diagnostics use lexical root equality and do not yet
protect file opens against junctions or path replacement. Do not execute that
binary against BBS data until its own handle/path boundary is reviewed. PowerShell
checks are sequential metadata checks, not protection against concurrent path
replacement, an audit of Mystic configuration/service references, or certification
of a complete isolated installation. No native execution is authorized by a PASS.

All tests in this continuation belong below E:\mystic. Never open or change
production D:\mystic. Historical runbooks mentioning tests on D: are superseded
for this continuation. The separate DOORS Windows 10 32-bit VirtualBox clone and
D:\DoorServer are separate work; no state, bitness compatibility or isolation was
verified here. Do not treat that clone as MysticWeb authentication evidence.

Existing uncommitted sandbox-auth work in ../implementation was preserved.
The recovery work is isolated in ../gateway-review on
fix/gateway-sandbox-path-boundary; no merge or activation is implied.

## Validation in this continuation

The copied PowerShell source and regression script ran with Windows PowerShell
5.1 only under `E:\mystic\.mysticweb-preflight-b36661fe097f43478a5d361802872b4e`.
Six path cases passed: ordinary empty file, optional missing file, required missing
file denial, direct junction denial, intermediate junction denial, and missing
child under a junction denial. Both junction ends were inside that disposable
fixture directory. Fixtures are retained there; no recursive cleanup was run.
The actual metadata-only preflight returned exit 0 and found all required files.
No native executable was launched, no account contents read, and no D: path opened.
No standalone authentication, account policy, ACS or native concurrency test ran.
No new hosted CI run was triggered because testing is constrained to E:\mystic.
