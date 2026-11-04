# Sandbox message-group security (temporary fail-closed policy)

MysticWeb has **not yet verified the binary offset or evaluation semantics of Mystic 1.12 A48 group List ACS**. Do not treat an area List/Read ACS as permission to expose its parent group.

The development-only sandbox message endpoint now requires an operator-maintained environment variable:

```dotenv
MYSTICWEB_SANDBOX_GROUP_MIN_SECURITY=<group-id>:<minimum-security>,<group-id>:<minimum-security>
```

Use **actual numeric group IDs from the sandbox's `data/groups_g.dat`** and verified minimum security requirements from Mystic -cfg. For example, the rule for a group configured with `s255` must specify `<its-id>:255`. Do **not** copy guessed IDs or grant `0` to a group with unverified ACS.

- Rules are exact numeric IDs, not group names.
- Unlisted groups are denied (including their areas and search results).
- Duplicate, malformed, out-of-range entries deny the request.
- An account must meet the group's configured minimum **and** the existing area eligibility checks.
- This does not interpret arbitrary Mystic ACS expressions or group membership. Only configure groups with a verified, simple security threshold; leave complex expressions unlisted.
- Never use this as a production authorization substitute. Production must obtain native Mystic authorization.

To validate: sign in as sandbox user #5 (`s20`), verify the group configured `s255` is absent, then attempt direct `/api/messages?group=<restricted-id>` and a known restricted area ID; both must deny. Sign in as a legitimate `s255` account and verify the configured group appears only if the area's independent checks also pass.

Without this variable, the catalog intentionally contains no accessible message groups. This is a safe but disruptive default until native group List ACS can be decoded and enforced.
