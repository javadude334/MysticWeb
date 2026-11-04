# JAM read-pointer compatibility rehearsal

This step does **not** enable automatic read marking or native Mystic locking.

The offline writer is a test prototype. Its `.mysticweb-offline.lock` marker
only coordinates cooperating test processes; it is not Mystic's native JAM lock.
Never use it against live message files or against a sandbox that Mystic has open.

## Rehearse with a real JAM pointer snapshot

From the MysticWeb repository on Windows, identify an existing sandbox `.jlr`
file and a numeric Mystic user ID already present in that file. The command
below reads the supplied file, makes a disposable copy in the OS temp directory,
attempts a contiguous pointer advance on **the copy**, checks that no other
record bytes changed, and deletes the copy:

```powershell
node scripts/rehearse-jlr-pointer.cjs "C:\MysticSandbox\msgs\YOUR_BASE.jlr" USER_ID MESSAGE_NUMBER
```

Replace the placeholders with actual values. Choose the user's current
`lastReadMsg + 1` to exercise a successful advance. A later number should
produce `gap-or-missing` rather than skipping unread messages. The output
includes `sourceUnchanged`, `before`, `after`, and `changedByteOffsets`.
Do not supply a live `D:\mystic\messages` file.

This verifies byte-level behavior only. Before allowing the web GUI to update
real `.jlr` files, verify Mystic's lock protocol, record creation semantics,
high-water pointer behavior, deleted/gapped message handling, and a two-way
round-trip with Mystic running against a disposable installation.

## Current release gate

- GUI and production routes remain read-only.
- No automatic marking, Mark All Read, or live file writes.
- Offline tests must pass before testing with an actual sandbox snapshot.
- Native concurrent writes remain blocked pending verified Mystic compatibility.
