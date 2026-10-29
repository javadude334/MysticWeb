# Native boundary continuation — October 28, 2026

Authentication remains **NOT CERTIFIED**. No password verifier, account policy,
identity binding, requested-user ACS or listener was enabled.

The proposed Pascal guard obtains the executable's module path from Windows,
opens each ancestor with OPEN_REPARSE_POINT, rejects reparse attributes and
checks the resolved handle path. Handles exclude write/delete sharing and remain
held while diagnostics use the same checked user-file handle. This deliberately
denies diagnostics while incompatible writers are present. Diagnostic record
offset arithmetic now uses Int64. These changes require native validation;
source review is not evidence of a working Windows boundary.

The existing E:\mystic\MysticGateway.exe was not replaced or run. No account
contents were read. Production D:\mystic and VM 192.168.150.59 were untouched.
Existing uncommitted work in ../implementation was preserved.

Validation ran only inside
`E:\mystic\.development-validation-ef9c3c2f5b364e8483208d9ace5c79ec`:
six PowerShell boundary cases passed and four BBSDoorServer contract tests passed.
No Free Pascal compiler was found in the checked local locations. Pascal build
and native runtime checks remain blocked pending a compiler. The new
`scripts/tests/native-boundary.tests.ps1 -Compiler <fpc.exe>` is an unexecuted
synthetic regression runner: run from a copied checkout below E:\mystic. It never
replaces the installed executable or opens real account data. It covers regular
file/write exclusion, junction traversal, missing files, auth denial and nested
executable denial. File reparse points, ancestor rename races, handle/path alias
cases and exact-root preflight still need native verification before acceptance.

Keep changes draft. Do not trigger hosted native tests for this continuation:
native execution is restricted to E:\mystic. Do not certify authentication based
on these boundary tests.
