# Messaging implementation sequence — 2026-11-03

## Scope and priority
Navigation design is paused except where required for messaging. Ship authenticated public EchoMail reading, posting and replies first. Next build a unified communications workspace for Mystic private/local mail, EchoMail, FTN NetMail and internet email. These are distinct delivery mechanisms, not interchangeable message stores.

## Verified source audit (main branch)
- `src/lib/mystic/jam.ts`: read-only JAM parser for index and individual body, no `.jlr` writes. It filters hidden/private/netmail attributes and checks for file changes.
- `src/lib/mystic/reader.ts`: inspect for area catalog, native ACS, and configured message path handling.
- `src/components/message-workspace.tsx`: area list, message list, single-message reader, reply-link navigation; currently read-only.
- `src/app/api/messages/route.ts`: GET only, delegates to `productionAccess()`.
- `src/lib/auth/service.ts`: `productionAccess()` returns null; public API fails closed (503). Existing reader UI cannot be declared operational in the deployed app.
- `src/lib/mystic/poster.ts`: strict draft validation, `NativeMessagePoster` interface and timeout/receipt checks; **no actual native writer**.
- `tests/message-poster.test.cjs`: validates boundary behavior, not native posting.
- `docs/private-messaging-plan.md`: older preview plan; reconcile when implementing unified workspace.

## Release 1: public EchoMail
1. Confirm sandbox message directory, area catalog, ACS, JAM encoding, identity and native Mystic posting mechanism. Do not hardcode `E:\\mystic\\msgs` or `D:\\mystic\\messages`; paths are operator-configured.
2. Implement a reviewed native runtime/transport and explicitly compose `WebAccess` for sandbox only. Validate auth, account revocation, read ACS, write/post ACS and message area revision.
3. Add a native writer implementing `NativeMessagePoster`; Mystic must own locking, message number, reply chain, network export and durability. Never directly append to JAM files from the browser API.
4. Add POST endpoint with origin/CSRF protection, strict JSON body limits, authenticated caller and server-side post ACS, rate limits and safe failures. Bind to writer, not to browser-provided filesystem paths.
5. Add Compose / Reply controls to message workspace; preserve draft on errors, show accepted receipt and refresh thread. Support area selection and recipient/subject/body.
6. Test with two disposable sandbox users: allowed/denied area read, post, reply, threading, newscan, concurrent writes, encoding, transport failures and live reload. Do not send production mail.

## Release 2: unified communications
- One UI: inbox / sent / drafts / compose with account/source filters; adapters for (a) local Mystic private messages, (b) EchoMail, (c) FTN NetMail, (d) internet SMTP/IMAP or provider integration.
- Keep distinct routing, permissions, sender identities, addressing, delivery receipts, and retention for each transport.
- Never infer private-mail permission from public EchoMail read ACS; do not expose private JAM messages through the public reader.
- Confirm available native scripting integration, local mail storage, FTN config and internet mail provider before selecting transport implementations.
- Implement local private mail first, then FTN and internet mail integrations as separately tested milestones.

## Blocking evidence and next steps
A real native writer and configured auth bridge are missing from this repo; cannot truthfully mark posting/replies as working yet. The next code change should implement the sandbox native adapter after confirming the available Mystic runtime interface. Maintain direct-to-main workflow; verify typecheck, tests and build on Windows before deployment. Preserve deployment safety: no unreviewed live-site writes.

## Message group navigation decision — 2026-11-03
- Group-first navigation: enumerate Mystic-configured message groups in their configured order; under each group display areas with a verified matching group requirement in their native ACS/configuration.
- Do **not** display areas without a verified group association in MysticWeb (no catch-all or "Other" folder).
- Match group tokens structurally, never by substring (e.g. group 1 must not match group 10); distinguish `G1` from `AG1` and other ACS operators using verified Mystic syntax before enabling the mapping.
- An area can appear under multiple groups if its verified group rules associate it with multiple groups; maintain a single underlying area identity.
- Group association is **not authorization**. Revalidate user account and native list/read/post ACS independently for every operation. Never grant access because a group was found.
- Current `MessageReader.areas()` exposes only `{id,name}`, and `CatalogArea` lacks group metadata. Extend the trusted catalog and public response only after confirming the group/config file format and ACS semantics.
- Do not hardcode sample group names or infer membership from area titles. Unknown or ambiguous group association fails closed for navigation.
