# Mystic Mail: local private mail and FidoNet NetMail

## Implementation status
- Existing JAM read/encode/write primitives are reusable.
- `src/lib/mystic/mailbox.ts` introduces an isolated mailbox scope and
  fail-closed local sender/recipient filtering, with synthetic tests.
- **No private message body reader or mail API is enabled.**
- **No NetMail send/export is enabled.** JAM append alone does not route FTN mail.

## Local mail
The operator reports that Mystic internal email uses the first message base.
This is a useful sandbox observation, **not** authorization to treat public
message-area ID 1 as a private inbox. Verify the actual native area configuration,
message attributes, user handle/real-name/alias behavior and mailbox visibility
rules against controlled local messages. The public JAM reader hides private mail
and must remain unchanged.

A dedicated private JAM reader must authorize the user and mailbox scope
*before* exposing message headers or bodies. Filter inbox/sent by native identity
and enforce recipient-only access to private mail, including ambiguous names and
case/encoding handling. Check whether sysop mail and group recipients need
separate policies. Only then wire a private API and compose/reply UI.

## NetMail
NetMail requires its own verified base configuration, address ownership, message
flags, origin/destination metadata, MSGID/REPLY and outbound export/semaphore
behavior. Local sender/recipient matching is not a NetMail authorization policy.
Never classify NetMail as EchoMail to bypass access checks. No production send
until actual Mystic outbound routing has been demonstrated in the sandbox.

## Write coordination
The existing offline writer uses a MysticWeb-only lock file, not a verified
native Mystic header lock. It remains development-only. Do not enable writes
while Mystic or a tosser can write to the same base until compatibility is tested.

## Next acceptance tests
1. Controlled first-base local mail from A to B: A sees Sent, B sees Inbox,
   C cannot see either message or metadata.
2. Replies and sender identity match native Mystic after round trip.
3. Controlled NetMail from/to distinct FTN addresses, with isolation and
   confirmed native export (not merely a JAM record).
4. Concurrent native Mystic and MysticWeb writes with integrity checks.
5. Production feature remains off until all of the above are verified.
