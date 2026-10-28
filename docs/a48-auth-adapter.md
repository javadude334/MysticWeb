# A48 authentication implementation

PR #12 now includes a read-only A48 record adapter and a private mTLS HTTP
listener. PR #11's probe sources and branch are unchanged. Production web
composition still returns null; this change neither installs services nor
enables authentication.

## Concrete architecture

Browser HTTPS -> WebAccess -> persistent AuthStore + NativeAccess ->
BridgeTransport mTLS -> bridge_server -> BridgeDispatcher -> A48Driver + trusted
runtime binding. Protected JAM reads reuse MessageReader and its current account,
group, context, ListACS, ReadACS, catalog-revision and private-message safeguards.

`a48_driver.py` parses only the supplied 1536-byte A48 layout: unsigned
little-endian permanent ID at 0, flags at 4, opaque password bytes [8,109),
and handle bytes beginning at 109. It never treats a physical slot as an ID.
Empty, oversized, partial and duplicate-ID snapshots deny. ID zero is skipped
as an unused slot. IDs outside the existing protocol's signed-positive range deny.
Snapshot size is capped at 16 MiB. Duplicate exact handles deny name resolution.
Passwords and flag meanings are never guessed.

Construct `A48Driver(snapshot, decode_handle, verifier=None, policy=None)`:

- `snapshot()` returns coherent immutable users.dat bytes, read only, from the
  intended installation. The binding must obtain a stable snapshot and reject
  short reads, concurrent writes and untrusted paths. No file loader is silently
  supplied and no production users.dat is opened by this code.
- `decode_handle(tail)` decodes the verified A48 handle field from bytes starting
  at 109. The binding owns exact shortstring width, encoding and name semantics;
  the adapter deliberately makes no guess. Unsupported encoding must raise.
- `verifier.verify(permanent_id, opaque_password_record_101_bytes, candidate)`
  returns literal True only after checking that exact account. Other results
  deny. No verifier means denial. The adapter re-reads the snapshot after the
  call and denies any change to the selected record. Do not assume the native
  function accepts raw users.dat bytes merely because its API accepts pwdata.
- `policy.account(id, flags, complete_record)` returns the exact normalized
  current account state required by bridge_core. Unknown account fields or
  semantics must raise. The complete record is transient trusted-process input,
  never a response, log entry or persisted verifier fixture.
- `policy.authorize(id, area_id)` returns independently computed catalog revision
  and exact effective permissions required by bridge_core. No cached allow list,
  inferred groups or in-session operator ACS results may substitute for the
  requested user's actual native context.

The dispatcher checks active state before password work, re-resolves the name
and rechecks active state afterward. It serializes native calls and binds every
reply to a request nonce and installation. Existing web session revocation and
authorization checks remain in force.

## Listener deployment contract

`bridge_server.py` requires Python 3.10+ with maintained TLS; do not host it in
the BBS Python 2.7 engine. An operator-owned entrypoint imports `serve` and calls
`serve((private_ipv4, port), instance, ca_path, server_cert_path, key_path, driver)`.
Use a dedicated client CA issuing certificates only to the intended web service.
The constructor requires client certificates and TLS 1.2+ and rejects wildcard
or public bind addresses. Restrict the firewall to the web host as well.

The endpoint accepts only POST /v1/native with one Content-Length, application/json,
no compression/transfer encoding and at most 4096 bytes. One worker, an eight-entry
accept backlog, TLS/socket timeouts and a 1.5-second total HTTP connection deadline
bound network work. Errors are generic and access/error logging is suppressed.
Use a dedicated supervised process with OS memory/CPU limits and private key ACLs.
A hung native driver can block this single worker; web timeouts deny access, and
the supervisor must restart an unhealthy bridge. A network deadline cannot safely
interrupt an in-process native call. A remote native worker needs its own
authenticated encrypted bounded channel; no plaintext local-network IPC is supplied.

Missing drivers deny every operation. Certificate provisioning, service installation
and explicit web composition are operator deployment steps after integration proof,
not activation flags in this patch. Keep the origin, trusted client-address source,
private SQLite state and rate key specified in auth-reader-deployment.md.

## One remaining integration blocker

The [binding certification checklist](a48-binding-certification.md) now supplies
the exact isolated test sequence and describes the optional native API candidate
`NativeRecordVerifier`. It is not certified and does not supply account or ACS
policy. No production binding is installed.

**Supply and certify the trusted A48 runtime binding** implementing the five
callbacks above. This includes exact-account password verification, handle decoding,
coherent record loading, account-state semantics and effective ACS context as one
security boundary. The transport and record adapter cannot establish these facts.
There is no invented PBKDF2 encoding, implicit isuserpw invocation or credential
argument launcher. Authentication remains unavailable until this binding is proven.

The smallest next integration test is an isolated two-account test through the
adapter and mTLS endpoint: account B's correct password must return B's permanent
ID; A's password supplied for B must deny with no session. Then, before activation,
the same fixture must show denied/changed account state and denied ListACS/ReadACS
prevent all JAM access. Existing native-session wrong-password evidence need not
be repeated. Never collect passwords, hashes or record bytes in test reports.

## Validation

Synthetic adapter tests cover offsets, permanent identity, duplicate/truncated
records, absent bindings, strict verifier results and changes during verification.
The real loopback TLS test creates disposable synthetic certificates and checks
missing client certificate, untrusted server CA, valid authentication, replay,
malformed JSON, wrong path and oversize bodies. It uses system OpenSSL (CI), or
the bundled cryptography library on Windows; no runtime dependency was added.
These tests prove the adapter/transport contract, not actual A48 password semantics.
