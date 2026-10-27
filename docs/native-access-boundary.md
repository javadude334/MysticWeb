# Native identity and message authorization boundary

`src/lib/auth/native.ts` defines and tests the server-side trust boundary for a
future native Mystic adapter. **It does not implement that adapter**, and no live
route, environment switch or permissive default provider enables it. Supplying no
provider denies every operation. Native authentication is not yet working end to end.

## Native provider contract

Each request has protocol version 1, a random 256-bit one-use nonce, an explicit
operator-configured native instance and one operation:

- `authenticate`: exact username/password in bounded transient memory.
- `account`: permanent native user ID.
- `authorize`: permanent user ID, numeric area ID and a server-selected catalog
  revision (a lowercase SHA-256 digest of the exact trusted configuration snapshot).

Every response must contain exactly version, nonce, operation, instance, permanent
user ID and a normalized account state. Authentication also requires
`passwordVerified: true`. Account and authorization replies must match the requested
permanent ID. The account object must explicitly report existence and that deleted,
locked, expired and forced-password-change states are all false. Missing or unknown
states deny. These are protocol field names, not guessed Mystic record offsets or
dictionary keys: the native adapter must map them from verified runtime semantics.

Authorization additionally requires the same area ID and catalog revision and a
permissions object with exact fields `list`, `read`, `group`, `context`, `kind`,
`private`, and `personal`. All four checks must be true, kind must be `echo`, and
both privacy flags must be false. Local/personal areas, Netmail, news and unknown
types remain denied. Unknown syntax or group context must return deny, never an
approximation or inferred group. A native authorization result must evaluate the
current user's effective permissions, not the operator/service user's permissions.

The catalog revision must be computed and verified independently by the native
adapter against the configuration it evaluates. **Blindly echoing the requested
revision is invalid.** This prevents authorizing one configuration while selecting
JAM storage using a different area's ID mapping. The web catalog reader and native
adapter still require compatible snapshot/version verification before activation.

Replies with extra fields are rejected to prevent accidentally accepting or
returning raw user records. The web boundary returns only instance and permanent
ID for login; it never returns native credentials, profiles or configuration paths.
Requests are individually nonce-bound, bounded by a 1.5-second deadline, cancelled
on completion/timeout and never cached. Errors, malformed responses, mismatches and
timeouts deny. A slow provider must honor cancellation to prevent resource buildup.

## Transport and runtime requirements still open

No production transport is implemented because the A48 native invocation and user
context must first be tested. A provider must authenticate both peers over an
encrypted private channel, enforce request/response size and concurrency limits,
avoid credential logging/persistence and use native password verification. A nonce
is freshness protection, not server authentication. Do not implement a provider
that trusts arbitrary HTTP JSON, SSH transport acceptance, a guessed password hash
or a username supplied by the browser as account identity.

If a suitable native password API cannot be invoked securely, use possession of an
authenticated Mystic session to link a short-lived single-use web challenge. This
must still establish permanent native identity and support current account status
and current per-area authorization; linking alone is insufficient.

## Protected data access

`readArea` requests a fresh native account and permission decision **before**
invoking its server-selected storage callback. Denied requests never touch storage.
Callbacks must select paths from the same trusted catalog snapshot, return minimal
DTOs, and preserve the JAM reader's private/deleted/NODISP filtering. URLs may select
numeric area/message IDs only. No JAM file access or UI is wired by this change.

SSR and HTTP handlers must share this service, disable shared caching, and map
failures to generic inaccessible responses. They must obtain identity from a valid
server session and revoke sessions when native account state becomes invalid.
Neither a session nor previous allow result may replace the per-read native check.

Synthetic provider tests exercise the trust boundary, including denied storage,
cross-account/installation and configuration confusion, response replay, account
revocation, private/Netmail exclusion, unsupported metadata, timeouts and error
redaction. They are not certification of the real Mystic installation.
