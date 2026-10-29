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
The only wire operations are AUTHINFO USER/PASS, LIST ACTIVE, GROUP, XOVER and
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
