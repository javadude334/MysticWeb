# Local Mystic Mail — sandbox test setup

Implemented on the existing **Private Mail** navigation page (`/private-mail`).
The alternative `/mail` URL uses the same UI.

## Required setup
1. Use a **disposable Mystic sandbox**, not a live BBS message directory.
   Stop Mystic and all tossers before enabling any JAM writes. The existing
   MysticWeb lock does **not** coordinate with native Mystic.
2. Inspect the sandbox `data/mbases.dat` in Mystic -cfg and identify the
   actual JAM filename for its **first message base**. Confirm it is the
   private internal mail base and that its JAM files exist under the
   configured sandbox message directory.
3. Set `MYSTICWEB_LOCAL_MAIL_BASE` to the **exact JAM base filename without
   extension**, for example `email` only if that is what your sandbox uses.
   The server refuses to enable mail unless it matches the first parsed area.
4. Start MysticWeb in development mode (`npm run dev`) with the sandbox
   environment and sign in using a native Mystic user.
5. Open **Message Center → Private Mail** or visit `/private-mail`.

## Test
- Inbox and Sent show only records whose To or From field exactly matches
  the signed-in native handle. Opening a message reads its body.
- Compose: type at least two characters of a native handle/real name,
  select a returned account, enter subject/body and send.
- Sending rechecks the permanent user ID against `users.dat`, marks the
  JAM record private and writes via the **offline-only** JAM writer.
- Sign in as the recipient and confirm delivery; reply and verify threading.
- Sign in as a third user and confirm the messages are not exposed.
- Run `npm test` and `npm run build`; neither was executed through the
  GitHub connector.

## Current limitations / release blockers
- **Do not enable against active Mystic or live data.** Native-compatible
  cross-process JAM locking and crash recovery are not certified.
- Matching sender/recipient text is the current native mailbox rule; native
  aliases, real-name delivery and shared/special recipients need controlled
  verification. A spoofed From field is not cryptographic authorship proof.
- The existing public EchoMail area permissions must not include the internal
  mail base. Confirm this before testing with real user data.
- This implementation does not change Mystic's native .jlr last-read pointers.
- NetMail and nodelist routing are separate future work.
- This is sandbox integration code; test results and native compatibility
  must be verified before calling it production-ready.
