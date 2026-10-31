# Native current-session evidence — October 30, 2026

The operator ran the prepared read-only context probe inside authenticated
E:\mystic sessions. These are operator-reported native results, transcribed from
the displayed reports. They establish the probe's checks, not web acceptance.

| Permanent user ID | Current group | Area 2 list/read | Area 5 list/read |
| --- | --- | --- | --- |
| 1 (`test`) | 1 (Local) | true / true | false / false |
| 1 (`test`) | 2 (TestNET) | false / false | true / true |
| 2 (`javadude2`) | 1 (Local) | true / true | false / false |
| 2 (`javadude2`) | 2 (TestNET) | false / false | true / true |

Each report returned the expected permanent ID and matching current group. The
probe also checked explicit permanent-ID lookup, positive/negative native ACS
controls, own-ID acceptance, other-ID denial, identity stability and unchanged
catalog bytes. No message bodies or read-pointer files are opened by the probe.
Both users had the same outcomes in each group; these runs do not demonstrate
different per-account permissions within one group or revocation behavior.

All four reports explicitly returned `browserEnabled: false`,
`eligibilityCertified: false`, and `productionIdentityAdapter: false`.
Area 2's result is diagnostic only; it does not override the public-echo-only
web catalog policy. Current-context ACS is not a grant for an arbitrary area
in another context. Do not switch a running user's context to impersonate a user.

## Corrections established during execution

Mystic Python 2 returned the `id` field as `long`, so an exact `int` check rejected
valid IDs. The helper now accepts exact Python 2 `int` and `long` within the
existing range, while excluding booleans, strings and floats. The probe initially
lacked a pause. `bbs.pause()` is not implemented by this installed module;
`bbs.getkey()` successfully waits after a printed prompt. Fixed stage/reason
labels and type-only shape output diagnose failures without dumping user records.
A duplicate menu hotkey caused an unrelated demos menu to execute; the operator
identified that menu configuration issue.

## Next implementation boundary

Use these results for a native-session-owned connection: evaluate identity and
ACS on the authenticated session thread and reject foreign account requests.
A separate process cannot infer those permissions from `getuserid` or NNTPS
password success. Keep production composition disabled until an authenticated,
encrypted, bounded session connection, current account eligibility, revocation,
and isolated browser login/authorized reads are verified together. These pieces
remain unfinished; no deployment or usable-browser claim follows from this matrix.

Do not repeat this four-case matrix unless code or fixture configuration changes
invalidate it. The next operator test should target a new, concrete capability.
