# MysticWeb scheduled message-base refresh

## Shared maintenance credential

On startup MysticWeb creates `mysticweb-api.json` (version 1, 64-character
random hex token) inside the private `<Mystic data>/mysticweb/` directory,
beside `mysticweb.db`. It is never checked into Git or passed as a
command-line argument. The file remains stable across restarts. The endpoint
reads the file when authenticating each request, so deleting or replacing it
invalidates the old token. **Do not place the token in the general data root.**

The directory and token must be accessible to the MysticWeb service identity
and the Windows Mystic scheduler identity, but **not** to ordinary BBS users.
The existing Windows startup code protects the directory with an ACL for the
current process identity and SYSTEM; a separate scheduler account will need
explicit administrator-configured read permission. On Linux, token permissions
must remain restricted (mode 0600). Never relax permissions for all users.

## Windows Mystic Event Editor

Create a Shell event named `MysticWeb Message Base Refresh`, with
`Prefix ./` set to No. Configure a time and enable desired weekdays.

Shell command for the Windows sandbox:

`C:\work\javadude_dev\MysticWeb\scripts\refresh-message-bases.cmd`

The wrapper calls `refresh-message-bases.ps1`, which reads the shared
credential and invokes
`POST /api/internal/maintenance/message-bases`. The default URL is
`http://127.0.0.1:3000`, for local testing only. To target a remote Ubuntu
MysticWeb instance, configure `MYSTICWEB_BASE_URL` for the Mystic scheduler
process (e.g. `https://mysticweb.example.com`). Remote requests require
HTTPS. Set `MYSTIC_DATA_ROOT` for the scheduler process if Mystic is not at
`C:\MysticSandbox`. If the actual data directory differs from `<root>\data`,
invoke the PowerShell script with its `-TokenFile` parameter.

Run the .cmd manually under the scheduler account before enabling the event.
A successful sandbox scan previously found 1 local, 3 netmail, and 403
echomail bases. The endpoint returns counts and skipped diagnostics. Failures
exit nonzero.

## Deployment constraints

The Windows-side event only calls the REST endpoint; **the Ubuntu server
performs the scan and SQLite update**. The Windows offline CLI
(`refresh-message-bases.cjs`) is an alternative for a same-host
installation, not the preferred two-VM approach.

**Ubuntu deployment is not yet supported by the existing runtime**: its
Mystic A47 directory parser and private SQLite initialization explicitly
require Windows paths and Windows ACL tools. The shared mount path mapping,
cross-platform native JAM scanning, and safe database locking must be
implemented and verified before using this event in production. A shared
filesystem alone does not resolve those limitations.

The maintenance endpoint continues to require a Bearer token. No anonymous
maintenance access is permitted. The scanner never modifies JAM messages.


## Dave's BBS nightly maint.cmd integration (2026-11-08)

The Windows host runs `D:\mystic\maint.cmd` at 03:00. After
`mutil -exec PurgeMessageBases,PackMessageBases,LinkMessages` succeeds,
invoke the existing `scripts/refresh-message-bases.ps1` to refresh the
message-area catalog. Do **not** call this while MUTIL is packing files.

The Windows batch integration requires these two **process environment
variables** (do not embed secrets in the batch file):

- `MYSTICWEB_BASE_URL=https://davesbbs.com`
- `MYSTICWEB_TOKEN_FILE=<absolute restricted Windows path to mysticweb-api.json>`

The token must be the **same token used by the Ubuntu MysticWeb server**,
not an unrelated locally generated Windows token. Do not copy it to a
publicly readable Mystic data directory. Ensure the Windows scheduler
account can read it and ordinary BBS users cannot. Use HTTPS and confirm
that the Ubuntu service has access to the actual live Mystic message
configuration and JAM files.

The PowerShell client is
[`scripts/refresh-message-bases.ps1`](../scripts/refresh-message-bases.ps1).
Copy it to `D:\mystic\scripts\refresh-message-bases.ps1` and invoke it
after successful MUTIL message maintenance:

```bat
if errorlevel 1 (
    echo ERROR: Message maintenance failed; skipping MysticWeb refresh. >> "%LOG%"
) else (
    if defined MYSTICWEB_BASE_URL if defined MYSTICWEB_TOKEN_FILE (
        powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass ^
          -File "%MYSTIC_ROOT%\scripts\refresh-message-bases.ps1" ^
          -BaseUrl "%MYSTICWEB_BASE_URL%" ^
          -TokenFile "%MYSTICWEB_TOKEN_FILE%" >> "%LOG%" 2>&1
        if errorlevel 1 echo ERROR: MysticWeb area refresh failed. >> "%LOG%"
    )
)
```

**Important:** The existing route
`POST /api/internal/maintenance/message-bases` refreshes the area
catalog only. It does not reconcile per-user read receipts or native
`.jlr` pointers. A pack-aware read-pointer reconciliation service remains
unimplemented; never schedule an invented endpoint or blindly advance
pointers after packing. Verify the Ubuntu runtime's `MYSTIC_DATA_ROOT`,
shared mount, Mystic version/layout support, token path and scan response
before enabling the production call. A 200 response with `updated:true`
and plausible counts is required for acceptance. Inspect `skipped` areas.

Do not log Bearer credentials. Preserve a copy of the original batch
file and run a supervised manual test before relying on the 03:00 event.
