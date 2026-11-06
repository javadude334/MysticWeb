# Mystic message-base catalog refresh

MysticWeb scans Mystic 1.12 A47 message bases at application startup. For
periodic refreshes on Windows, Mystic's Event Scheduler can execute the offline
CLI directly. **No HTTP server or maintenance token is required for this job.**

## Sandbox event (Mystic Event Editor)

Create a Shell event named `MysticWeb Message Base Refresh`. Set `Prefix ./`
to No. Select the desired days and execution time.

For the development machine, use the short wrapper:

`C:\work\javadude_dev\MysticWeb\scripts\refresh-message-bases.cmd`

The wrapper runs Node from the repository root. The CLI reads
`MYSTIC_DATA_ROOT` from the process environment or the project's `.env.local`.
It validates the Mystic A47 configuration and JAM file structures, then
atomically replaces the derived SQLite catalog.

Run the wrapper manually from a command prompt to verify the output before
enabling the event. Expected sandbox counts currently: local 1, netmail 3,
echomail 403, skipped 0.

The application must have initialized its private SQLite database at least
once before the offline refresh. The CLI refuses to create the private database
or modify its schema. Run it under the same Windows account as MysticWeb so
the protected database ACL permits access. A failed scan or SQLite transaction
does not replace the last successful catalog. The CLI exits nonzero on errors.

The refresh does **not** alter Mystic JAM messages, user records, or access
permissions. Message access must still be checked against native Mystic
authorization. Configure the event after nightly MUTIL when practical.

The legacy authenticated HTTP maintenance endpoint and PowerShell client
remain available for deployments that need remote invocation; do not remove
its token protection or expose it publicly. Local scheduling should use the
offline CLI instead.
