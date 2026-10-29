# Native NNTPS authentication adapter — sandbox candidate

Status: protocol adapter implemented; native A48 certification and browser login
remain incomplete. Production composition is unchanged and denies authentication.

The standalone Pascal diagnostic cannot import the BBS embedded Python module.
Recorded native getuserid/isuserpw cross-account success remains valid evidence;
there is no reason to repeat it. Retrieved dictionaries do not change the native
session used by access(). This adapter instead uses Mystic's documented NNTPS
server and keeps all native reads on the exact connection that authenticated.

`src/lib/auth/nntps.ts` provides certificate- and hostname-validated TLS 1.2+
connections. It requires the password challenge and successful AUTHINFO PASS;
an anonymous/already-authorized response to AUTHINFO USER is rejected. Passwords
are not saved for reconnects. There is no connection pool or user switching.
Concurrent operations on one connection are rejected; failed operations close it.
The only wire operations are AUTHINFO USER/PASS, LIST ACTIVE, GROUP, OVER and
numeric ARTICLE. No POST, IHAVE, cancel, native file access, subprocess invocation,
or last-read update exists in this adapter. Native server side effects still
require live verification. It implements implicit TLS, not STARTTLS fallback.

Commands have a three-second total deadline. Connections close after 30 seconds
idle. Native lines, queued bytes, groups, page ranges and article bodies are bounded.
Message-ID addressing is excluded to avoid bypassing selected-group checks.
Raw overview/article lines remain internal protocol data; MIME/encoding handling
and safe mapping into the reader UI are not yet implemented.

This is deliberately NOT a NativeProvider. NNTP authentication success does not
supply a verified permanent user ID, complete account-status policy or proof of
Mystic's ListACS/ReadACS/group behavior. It must never be wrapped in fabricated
`account: active` or `permissions: true` replies. Browser cookies are not issued
by this module, and no environment variable enables it in productionAccess().

## Live sandbox setup

Use only the E:\mystic native configuration editor. The initial snapshot had an
active C:\mystic\mis.exe process, while the E: server was not running. Do not
connect to, stop, or reconfigure that other installation. Inspect process ownership
before any protocol probe; ports alone do not identify the BBS installation.

NNTP was enabled by the operator and its plain port changed to 8119. A nonstandard
port is not TLS. Before starting the sandbox server, establish an IPv4-only loopback
binding, a separate nonzero SSL port, and a usable certificate. The native A48
changelog documents NNTPS and password-log suppression; these are documentation,
not proof that this endpoint is configured correctly. The sandbox attachment path
was observed outside E:\mystic and needs correction through the supported editor.
Other active listeners must also stay isolated before starting the sandbox MIS.
Do not send passwords over plaintext NNTP or disable certificate verification.

## Remaining activation requirements

1. Verify listener owner/root confinement, TLS version, trusted certificate and
   endpoint identity. Authenticate only with disposable sandbox accounts through
   secure input; do not put passwords in arguments, environment, files or reports.
2. Establish exact account identity binding and required account-state behavior.
   A server connection may carry identity, but that is not a certified permanent-ID
   mapping for the existing web-session contract.
3. Demonstrate native group/ListACS/ReadACS denial, direct-article denial, private
   message filtering and account/access revocation after login. Do not assume
   LIST ACTIVE hides every inaccessible group or that an open session rechecks
   changed account state. Unknown or insufficient behavior blocks this route.
4. Only after those facts are established, implement explicit web composition,
   safe overview/article decoding and the HTTPS sign-in form. Then verify browser
   login, session isolation, logout and message reading against E:\mystic.

## Focused checks

`node --test tests/nntps.test.cjs` creates a disposable TLS server and synthetic
accounts. Five cases cover user isolation, crossed/unknown credentials and command
injection, certificate/hostname rejection before authentication, anonymous-success
rejection, bounded lines, paging and dot decoding. They do not certify Mystic.
The test requires OpenSSL (PATH, Git for Windows, or MYSTIC_TEST_OPENSSL). Windows
CI runs this focused file as well as the existing frontend build. No actual BBS
credentials or files are used by these tests.

Primary references: bundled E:\mystic\docs\whatsnew.txt (NNTPS at line 5050;
password-log suppression at 477; private/netmail exclusion at 731),
https://wiki.mysticbbs.com/doku.php?id=config_server_servers,
https://www.rfc-editor.org/rfc/rfc3977,
https://www.rfc-editor.org/rfc/rfc4643.

## Live protocol observation, October 28

After the operator started the sandbox MIS, process inventory confirmed that
E:\mystic\mis.exe owned port 8119. A no-credential loopback probe received a 200
greeting and 101 CAPABILITIES response advertising VERSION, LIST, OVER and POST.
STARTTLS returned 500. No authentication command, area list or message read was
sent. The adapter uses advertised OVER and never sends POST. A separate implicit
TLS endpoint is still required; port 8119 has not been accepted for credentials.
The configured listeners were bound to all interfaces, not loopback. Other Mystic
installations were not connected to, stopped or reconfigured.

## Read pointers

Standard NNTP has no operation for Mystic's native last-read pointers. This
adapter never updates them; the original sprint is explicitly read-only. Opening
a web message must not be reported as synchronizing the BBS read/unread position.
A future shared-pointer feature requires a separately authorized supported native
operation, such as a certified use of Mystic's documented msg_setlr interface.
NNTP is not a replacement for the gateway's broader native integration boundary.

## TLS listener established

Operator restart exposed 127.0.0.1:8563, owned by E:\mystic\mis.exe. An initial
strict handshake rejected the self-signed certificate. Its public certificate was
retrieved from that verified local endpoint and saved only to the ignored local
`.certificates/mystic-sandbox-cert.pem`. No Windows/root trust store changed.
A subsequent connection with that explicit CA and certificate identity mybbs.com
passed chain and hostname validation, negotiated TLSv1.2, and received NNTP 200.
No AUTHINFO or password was sent during these probes. The trust setup is sandbox
specific; production certificate provisioning remains separate.

`scripts/sandbox-nntps-login.cjs` supplies an operator-run interactive check. It
accepts no credential arguments, requires a real terminal in this exact E: checkout,
and masks password input using raw terminal mode. It authenticates against the
verified TLS endpoint, reports sanitized results and group count only, sends QUIT,
and tries one generated wrong candidate. Native 481 rejection or the observed A48 381 password reprompt after AUTHINFO PASS passes that
negative check; transport/protocol errors are inconclusive. It never issues a web
cookie or claims permanent identity/account/ACS certification. Use disposable
sandbox accounts. Do not send passwords to chat or capture terminal input.

Run locally:

```
cd E:\work\javadude_dev\MysticWeb
node .\scripts\sandbox-nntps-login.cjs
```

Graceful QUIT shutdown has an additional passing disposable-server regression.
The operator subsequently reported native password acceptance for javadude2; see below.

## Operator login result and compatibility fixes

The operator reported the masked tool accepting javadude2 over the verified TLS
connection. test123 was intentionally nonexistent and did not authenticate.
Group listing returned only the old generic UNAVAILABLE result; its exact cause
is not yet established. The generated wrong candidate was inconclusive under
the original checker.

A separate no-real-credential probe against the verified E: TLS endpoint observed
381 after AUTHINFO USER and another 381 after a generated wrong AUTHINFO PASS,
followed by QUIT 205. The adapter now explicitly treats that password reprompt
as non-acceptance and closes the connection. It never issues a session from it.
Unauthenticated LIST ACTIVE and LIST both returned 450; no group names were
printed. This establishes unauthenticated rejection, not per-user area policy.

Compatibility fixes accept bounded zero-padded article counts and horizontal
protocol whitespace. Bare LIST is retried only after syntax codes 500/501,
never after authorization denial. Failures expose fixed stage names and numeric
status codes only, with no server reply text, account records or message data.
Focused regressions cover these behaviors. The next operator run is needed to
identify or resolve the authenticated group-list failure; browser login remains
disabled and identity/eligibility/ACS certification remains incomplete.

## Latest operator result: native authentication passes

The updated masked-input run reported:

```
NATIVE_NNTPS_PASSWORD_ACCEPTED: PASS
NATIVE_GROUP_LIST: PASS; count=0
NATIVE_NNTPS_WRONG_PASSWORD_REJECTED: PASS; native=381
```

This is operator-reported native NNTPS evidence for javadude2, not a browser login.
The group parser now succeeds. A read-only inspection of the sandbox A48 catalog
found three areas, all with blank NewsName fields. ID 2 is a public local base;
IDs 1 and 3 are private, with ID 3 also netmail. The next native-editor step is to
assign a newsgroup name to the public area only, preserving all ACS and privacy.
The checker now reports that metadata-only setup hint automatically for an empty
native list. It does not change configuration or grant access from catalog data.

Important no-write constraint: the installed A48 changelog and official 1.12
changelog explicitly state that NNTP generates missing MSGIDs when encountered.
No OVER/ARTICLE command has been sent to the real sandbox by this work. Do not
activate native message-body reads merely because authentication and listing pass.
A read path must establish that it cannot modify native user/message files;
otherwise use the existing direct read-only JAM reader behind independently
verified identity and per-area authorization. A read-only client command alone
is not proof of a read-only native server implementation.
