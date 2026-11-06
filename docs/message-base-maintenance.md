# Mystic message-base catalog refresh

MysticWeb scans Mystic 1.12 A47 `data\\mbases.dat` at application
initialization, and can rescan through an authenticated maintenance endpoint.

The A47 message-base record is 768 bytes. The scanner uses the native
area ID, name, JAM filename (offset 138), configured message directory
(offset 179), and type byte (offset 260). The supplied A47 sandbox
confirms types 0 (local), 1 (EchoMail), and 3 (NetMail).

For local mail, the scanner first selects a type-0 base whose JAM filename
is `email` (case-insensitive). If none exists it selects type-0 area ID 1.
Other local message bases are not treated as private mail. Every configured
NetMail and EchoMail base is considered independently.

Only bases with a valid name, safe JAM filename, existing configured
directory, and readable, structurally plausible `.jhr`, `.jdx`, and
`.jdt` files enter the catalog. An explicitly configured path is never
silently replaced with the default directory. Invalid bases are skipped
and reported. The scanner does not write to Mystic data.

The SQLite `discovered_message_bases` table is a derived catalog,
replaced in one transaction after a successful scan. Message history,
sessions, and application settings are not deleted. If the scan itself
fails, the previous catalog is retained. Catalog entries are **not**
permission grants: every message read/post must continue to check native
Mystic account and area access.

## Schedule from Mystic

1. Set a strong, random `MYSTICWEB_MAINTENANCE_TOKEN` (32+ characters)
   in the MysticWeb process environment **and** the scheduler environment.
   Keep it out of the repository and scheduler command arguments.
2. Ensure MysticWeb is running and reachable locally at the chosen URL.
3. In Mystic's Event Editor, create a nightly external-command event,
   preferably after MUTIL maintenance, that runs:

   `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "C:\\path\\to\\MysticWeb\\scripts\\refresh-message-bases.ps1" -BaseUrl "http://127.0.0.1:3000"`

   Adjust the script path and URL for the installation. For a remote
   MysticWeb instance, use HTTPS and restrict the maintenance endpoint
   to trusted hosts.
4. Review the event output. Nonzero exit means the refresh failed.
   The response includes counts and skipped-area diagnostics.

The endpoint is `POST /api/internal/maintenance/message-bases` with
`Authorization: Bearer <token>`. It is not a public GET endpoint.
Do not expose the maintenance token to browsers or users.

Note: Internet email transport configuration is distinct from Mystic
message-base type. This catalog intentionally does not classify an area
as Internet Email based on its name. External email delivery will be
integrated separately once its native configuration is verified.
