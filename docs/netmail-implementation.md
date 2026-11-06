# NetMail implementation plan (private local mail deferred)

## Decision
Implement FidoNet NetMail using the existing JAM decoding primitives, but not the public EchoMail authorization or presentation path. Local private messaging remains disabled.

## Existing boundary
The current public JAM reader intentionally hides NetMail and private messages, and the message-area catalog admits only verified EchoMail areas. Preserve these defaults. Do not reclassify a NetMail area as EchoMail to bypass them.

## Stage 1 — read-only sandbox
1. Identify actual NetMail area configuration and JAM base in the Mystic sandbox. Confirm whether its messages are JAM or another configured backend; refuse unknown formats.
2. Introduce a separate `netmail` area kind and authenticated, explicitly permitted NetMail reader. Never expose it through public search, unread counts, message lists, or public API routes.
3. Decode and preserve From/To, subject, date, MSGID/REPLY, origin/destination FidoNet addresses and flags from JAM subfields/FTN control lines. Treat unknown or malformed address metadata as unverified, not public.
4. Require native account verification and NetMail-specific permission for each request. Verify the correct mailbox visibility policy (including whether this is a sysop-wide NetMail area) before exposing messages.
5. Keep reads side-effect-free against native JAM and last-read files. Add tests for cross-user isolation, denied area metadata, malformed records, flags, and mixed EchoMail/NetMail bases.

## Stage 2 — sandbox composition
Only after read-only validation, add NetMail composition and reply with explicit destination node address, reply threading, origin address selection, and route/attribute validation. Writing to JAM is not equivalent to successful FidoNet delivery: confirm Mystic's outbound routing/export mechanism before enabling send.

## Safety gates
- No production writes, no public NetMail listing, no private local inbox.
- No assumption that shared JAM storage implies shared authorization.
- Validate behavior on disposable sandbox copies before changing live data.

## Acceptance
A signed-in authorized operator can read only verified permitted NetMail in a dedicated view; public EchoMail remains unchanged; local private messages stay inaccessible; automated security and parser tests pass.
