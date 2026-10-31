# Direct browser login: native SSH connection progress

The required user flow is browser username/password login. A user must not open
Telnet, pre-authenticate a BBS session or paste a linking token. Any native session
must be established and managed by MysticWeb after the web login request.

## Implemented connection layer

`src/lib/auth/ssh-session.ts` creates one SSH connection using the supplied
credentials, validates an exact SHA-256 host-key pin before authentication, and
waits for a native worker readiness marker. No password is passed in arguments,
written to a credential file or included in native bridge JSON. Authentication
objects drop their password references on success/failure; JavaScript strings
cannot be reliably zeroed. Raw client/terminal logging is not enabled.

The connection has an eight-second total establishment deadline, seven-second
SSH readiness limit, 1.5-second native request deadline, bounded traffic, one
outstanding request, cancellation and close-on-malformed-response behavior.
No shell commands or menu-navigation sequences are sent. A native bridge-only
start menu must launch the worker itself. The connection does not issue cookies,
infer account eligibility or supply a production NativeProvider composition.

The native worker protocol begins with exactly `MYSTICWEB/1 READY` on a line by
itself after authenticated native session establishment. After that, requests
are bounded newline-delimited JSON without passwords; responses use
`MYSTICWEB/1 ` followed by JSON containing the exact request nonce. Readiness
is not identity proof. NativeAccess must still validate the complete identity,
current account policy, catalog revision and permission response before use.

The worker, native automatic-login/bridge-only menu configuration, session
registry/logout cleanup, account policy and production composition are not
implemented by this connection layer. This document must not be presented as
working direct browser login. Existing native-session probe evidence remains
valid and should not be repeated just to test this transport.

## Live sandbox inspection, October 30, 2026

- `E:\mystic\data\servers.dat` describes an active SSH listener on port 8022.
- Windows identified the listener as `E:\mystic\mis.exe`, PID 37980 at inspection.
- The installed `cl64.dll` reports version 3.4.5.
- A no-credential SSH2 negotiation selected host-key algorithm `rsa-sha2-256` but
  failed before authentication with `no matching C->S cipher`.
- The server offered `aes128-cbc`, `aes256-cbc`, `3des-cbc`; the adapter's unmodified
  modern default list contains GCM, CTR and ChaCha20 alternatives. No legacy
  cipher was enabled in that initial probe, no host pin was bypassed and no BBS
  credential was sent.
- Initial multi-connection key scanning triggered the native four-attempt/
  120-second limiter and added an exact localhost deny rule. That diagnostic-
  created `127.0.0.1` entry was removed with the original file backed up locally;
  all other rules and native thresholds were preserved. Use single probes and
  respect this rate limit. Do not treat an IP ban as an authentication result.

The official Cryptlib v3.4.9.6 archive contains an x64 DLL and modern CTR cipher
support, but it is not a safe drop-in replacement for this compiled Mystic build.
Comparing the vendor 3.4.5 header with the current official header found numeric
API changes: NETWORKSOCKET 6014 -> 6015 and SSL_OPTIONS 6026 -> 6029. The installed
DLL has not been replaced. MIS was subsequently restarted as described below. The
official current DLL SHA-256 inspected was
`191c5c18f139eb02db1ea49f75305eec2bf4e6131f5bc51943420fbb4d3a41ab`.

An explicit `localCompatibility: "aes256-cbc"` option is prepared and tested,
disabled by default. It is rejected for every host except literal `127.0.0.1`;
there is no automatic fallback and no 3DES support. This would permit an older
cipher solely for the Windows-local gateway-to-Mystic hop, with a modern mTLS
channel from Ubuntu to the gateway. It is not configured for real credentials
or a live native instance by default. The operator subsequently approved this
mode for the sandbox's local-only hop. A credential-free live handshake then
succeeded and captured the verified sandbox listener's SHA-256 public host-key pin:
`d133e0feb8209cb665a525f1cfb0f95505b5aac850b720f5bab2e86d19ac6732`.
Do not enable this compatibility mode for remote hosts or production implicitly.

The sandbox MIS process was restarted after confirming no sandbox native BBS
sessions were active. Its stale semaphore was preserved outside the BBS tree.
The replacement process was verified at `E:\mystic\mis.exe`; other MIS processes
were not stopped. The Cryptlib DLL and message/read-pointer files were not changed.

## Prepared automatic native login check

A new non-overwriting `after_login.mps` was installed and compiled in the E:
default theme. It invokes the existing context probe only for native SSH sessions
(`ServerType = 2`), then hangs up. Other protocols retain their existing flow.
The installed A48 changelog documents that `after_login.mpx` executes after the
normal native login checks. No arbitrary username impersonation is implemented.
This is a temporary diagnostic hook, not the native JSON worker or a web grant.

The operator can run this new masked-input check without opening Telnet:

```powershell
& 'C:\DevApps\nvm\installs\v24.22.1\node.exe' 'E:\work\javadude_dev\MysticWeb\scripts\sandbox-ssh-login.cjs'
```

It uses the confirmed `javadude2` / permanent ID 2 fixture, strict host-key pinning
and approved local compatibility, waits for the authenticated native probe report,
and then tries a random wrong password. Only fixed result stages and sanitized
identity proof are emitted. SSH authentication without the native identity report
is not a positive result. A timeout or generic protocol failure is not wrong-
password rejection evidence. No native message/read-pointer command is sent;
normal native login/logout can update BBS call statistics. Real credential-bearing
execution remains pending the operator's local input; do not send passwords in chat.

## Next bounded steps

1. Establish a supported modern-cipher native endpoint. Investigate a compatible
   Cryptlib update in an isolated copy, including ABI compatibility and rollback,
   before replacing a library. Do not silently enable CBC/3DES or plaintext
   credential transport to make a handshake pass.
2. Verify SSH credentials actually complete Mystic account login, with correct/
   wrong credentials and locked/expired/forced-change controls. SSH protocol
   acceptance is not sufficient evidence of BBS eligibility or permanent identity.
3. Implement the native worker and bridge-only entrypoint, with account state
   and per-area checks performed in that authenticated user's session. Verify
   revocation, group/area context and message/read-pointer preservation.
4. Wire the verified provider to isolated web sessions and run real browser login,
   logout, concurrent-user, denied-read and revocation acceptance. Production
   remains disabled until this evidence exists.

## Ubuntu verification

The authorized SSH connection to `javadude@ubuntu` succeeded using the supplied
PuTTY key. Password-free sudo succeeded. `mysticweb-deploy.timer` was both enabled
and active. The application health endpoint reported revision
`915acff621509b29bf50df293a2efa369524f11c`. Ubuntu's private interface was
`192.168.150.66`. No deployment or main merge occurred.

## Private gateway connection verified, October 31, 2026

The development launcher `scripts/start-sandbox-gateway.cjs` is running a private
health-only mTLS endpoint at `192.168.150.58:8744`. It trusts the dedicated sandbox
CA and requires both a client certificate and Ubuntu source IP `192.168.150.66`.
Its native provider is deliberately null. No real account request can succeed.
This is a development process, not an installed/restarting Windows service.

New sandbox certificates were generated in the Git-ignored `.gateway` directory
with inheritance removed and ACLs limited to the current owner, SYSTEM and local
Administrators. The CA private key and Windows server key remain on Windows.
Only the dedicated Ubuntu client certificate/key and public CA were transferred
over the authorized SSH connection. Ubuntu installed its client key root-owned,
group `mysticweb`, mode 0640; temporary transfer copies were removed. Leaf
certificates have 30-day validity and require rotation; renewal is not automated.

Ubuntu `/etc/mysticweb/app.env` now contains the server-side settings from
`deploy/gateway-client.example.env`. Existing gateway settings are not overwritten
by provisioning. No Ubuntu application restart was performed. The running old
revision does not consume these settings; adding them does not activate login.

Live checks from Ubuntu as the `mysticweb` service user returned:

```
authenticated /health: {"status":"ok","nativeAccess":"unverified"}
without client certificate: rejected
native account request with provider absent: HTTP 503
Ubuntu application: healthy at 915acff621509b29bf50df293a2efa369524f11c
```

The configuration loader checks endpoint framing, bounded regular certificate
files, CA/client roles and matching keys. The gateway server validates exact native
request/reply fields, rejects repeated decoded JSON keys and replayed nonces, caps
traffic/concurrency, cancels stalled requests and never logs request bodies or raw
native records. Shared reply validation is also used by the existing web boundary.
The actual native worker, credential-bearing acceptance, session management and
web activation remain unfinished. A health response must not be called BBS login.

## Validation

Eight disposable loopback SSH tests cover a real encrypted session and framed
reply, host-pin mismatch before credential authentication, wrong password,
missing native READY, mismatched nonce, oversized reply and stalled reply. The
compatibility test proves default refusal, remote-host rejection and explicitly
enabled loopback-only use against a disposable server, with synthetic credentials.
These are synthetic server fixtures, not native acceptance evidence. TypeScript
passes. The new dependency is pinned; installation scripts were not executed.

Before the compatibility-only test was added, the complete application suite
passed 72 tests with one expected Windows permissions skip. After that addition,
all eight focused SSH tests, TypeScript and focused ESLint passed.

After adding the live private gateway and settings loader, the complete suite
passed 83 tests with two expected Windows POSIX-permissions skips (85 total).
TypeScript and focused ESLint passed. A production build also passed with the
new dependency; another build is run after the shared protocol changes.

Sources: https://github.com/cryptlib/cryptlib/releases/tag/v3.4.9.6,
https://www.mysticbbs.com/downloads/cl345.zip,
https://wiki.mysticbbs.com/doku.php?id=cryptlib,
https://github.com/mscdex/ssh2.
