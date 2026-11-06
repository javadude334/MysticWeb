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
