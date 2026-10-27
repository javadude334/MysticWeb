# Native runtime verification checkpoint

The operator successfully ran the native password and schema probes on Windows
Mystic 1.12 A48 32-bit. The results below verify this limited native runtime
checkpoint; account-state enforcement and area/group authorization remain unverified.
Do not guess native dictionary keys, password storage or group context.

This PR contains read-only diagnostic sources and documentation, not an installer.
The runtime results were reported by the operator, not reproduced by CI. No web
authentication or JAM integration is enabled by these probes.

## Prepared files

- `integrations/mystic/native_schema_probe.mpy`: reads the current native user and
  first area/group dictionaries, then prints field names and selected field types.
  It reports whether a Python password function exists, without invoking it.
  It evaluates only the constant true/false ACS expressions. No record values,
  names, IDs, security expressions, paths, passwords/hashes or message bodies are
  printed. Native exceptions are replaced by a fixed unavailable message.
- `integrations/mystic/native_password_probe.mps`: loads the current native user,
  accepts this non-admin test account's password through Mystic's masked input,
  calls native CheckPW, clears the variable and prints only match/ACS booleans.
  It does not claim to securely erase interpreter memory. It never saves accounts,
  changes passwords, scans other users or reads/writes messages.

The password probe compiles successfully with the isolated A48 Windows/32
compiler copied from D:. Its generated MPX is a build artifact, not a committed
binary. Python synthetic tests verify schema-only output and error redaction;
they cannot certify the installed native module or account/group context.

## Operator-reported results — October 27, 2026

Environment: Windows Mystic **1.12 A48 32-bit**, using the D: VM installation
and Python **2.7**. In `startbbs.bat`, the environment variable was corrected
to `PYTHONHOME` (not `PYTHON_HOME`), with `PYTHONPATH=C:\Python27\Lib`.
The configured Python DLL was `D:\mystic\python\python27.dll`. These are
operator-reported configuration details, not paths emitted by the schema probe.

The compiled `native_password_probe.mpx` returned:

```text
NATIVE_PASSWORD_MATCH: TRUE
NATIVE_TRUE_CHECK: TRUE
NATIVE_FALSE_CHECK: TRUE
```

The `native_schema_probe.mpy` report returned `python: "2.7"`,
`acs_always_true: true`, `acs_always_false: true`, and
`native_password_function_present: true`. Both false-check result fields mean
the constant false ACS expression was correctly denied. The Python password
function was detected only; it was not invoked.

The `user`, `first_area`, and `first_group` schemas returned field names and
selected types only. Selected observed types:

| Schema | Integer fields | String fields | Boolean fields |
| --- | --- | --- | --- |
| user | flags, id, mbase, mgroup | — | — |
| first_area | flags, id, nettype | listacs, readacs | — |
| first_group | id | acs | flags |

The user schema includes `level`; it does not establish account expiry or
lock-state semantics. Field names such as `pwdata` and `obj` are schema
metadata only; their values were neither serialized nor retained. Returned IDs
do not establish permanent identity or group/area mapping semantics.

The checked-in entry point now pauses with `mystic_bbs.writeln("|CR|PA")`
immediately after `run(mystic_bbs)`. This uses Mystic's native pause instead
of Python 2's evaluating `input()` or a misindented input block. The PR's
previous source had no pause block. Report collection and redaction are unchanged;
the pause sits outside the report markers. Recheck the updated pause in the
native menu; the reported successful schema run does not certify this revision.

These results demonstrate a successful current-user native password match and
constant ACS checks in the tested session. They do **not** verify live web login,
Python password-call behavior, account restrictions, or per-area authorization.
Test-account privilege level, wrong-password rejection and cleanup completion
are not established by the captured booleans.

## Operator-approved runtime test

1. Use the VM's D: Mystic instance and a dedicated ordinary account. Keep C:'s
   local instance separate. Log in normally through the local VM console or an
   encrypted BBS SSH session; do not send passwords through chat, command-line
   arguments, a shell history, an environment variable or the Ubuntu PuTTY key.
2. After approval, copy the schema source and the locally compiled password MPX
   to the VM instance's active theme scripts directory. Keep their filesystem
   permissions limited to the administrator and native BBS process.
3. Create temporary test-only menu entries restricted to that test account. Use
   GY for the Python 2 engine or GZ for Python 3 and data `native_schema_probe`;
   use GX with data `native_password_probe` for the compiled MPL script. The
   installed Python engine's availability/bitness must match the 32-bit runtime;
   do not install or switch Python runtimes as part of this probe.
4. Run the schema probe within that signed-in account. Capture only its output
   between `MYSTICWEB PROBE BEGIN` and `MYSTICWEB PROBE END`.
5. Run the password probe in the same session. Enter that test account's own
   password locally when prompted. Capture only the three TRUE/FALSE result lines,
   never the password or terminal input. Do not repeat failed checks blindly.
6. Remove the temporary menu entries/files after verification. Retain only the
   sanitized schema report and result booleans for implementation evidence.

Primary menu-command reference:
https://wiki.mysticbbs.com/doku.php?id=menu_commands (GX/GY/GZ).
Native CheckPW semantics are documented in the installed `docs/whatsnew.txt` and
https://wiki.mysticbbs.com/doku.php?id=whats_new_112.

## What this unblocks, and what it does not

The sanitized report identifies the native schema/version binding and verifies
that password checking works in the current user's context. It does not expose
credentials to the web or itself create an authentication service.

Remaining tests before integration:

- Confirm the dedicated ordinary test-account context, a controlled wrong-password
  rejection, and completion of temporary menu/file cleanup.
- Re-run the updated schema entry point to confirm the native pause returns cleanly.
- Verify effective account lock/deletion/expiry/forced-change behavior and area/group ACS
  semantics against dedicated permitted/denied test areas using that native API,
  including group switching, ListACS versus ReadACS, identity/area mapping and
  denied or unavailable contexts.

Only then implement and test an authenticated, encrypted native invocation channel
or an authenticated-session link-code flow. Recheck current account state and
native per-area permissions on every protected request. A transport-level SSH
login, inferred group, previous successful probe or cached allow list is not a
permission grant. Private/personal mail, Netmail and unknown types stay closed.

The user interface must remain disconnected until real native account validation
and authorization pass these tests. Synthetic provider tests alone are insufficient.
