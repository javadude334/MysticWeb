# Development workspace

Run `npm run dev:demo`, then open http://127.0.0.1:3000/development.
The launcher binds only to loopback and explicitly enables synthetic fixtures.
Choose Alice or Bob; no password is collected. Alice sees two boards, Bob only
Welcome. Open a message, page through older messages, switch identity, and sign
out. Direct requests for a denied board fail before fixture storage is read.

This workspace exercises the existing NativeAccess and MessageReader boundaries
with an in-memory synthetic provider. It does not call Mystic, open JAM/config
files, or validate native passwords. Demo sessions are bounded to 100, expire
in one hour, rotate on account selection, and disappear at restart. They are
separate from persistent production sessions. Use one local development process;
hot reload may clear sessions. It is a reader demo, with no posting or uploads.

Both NODE_ENV=development and MYSTICWEB_DEMO=1 are required. Requests require
the exact 127.0.0.1:3000 host; mutations require its exact Origin. Do not expose
the development server through a proxy or public interface. Production builds
return 404 for the workspace/API even with the demo flag set; production auth
and message endpoints continue returning 503. Do not enter real credentials.

Native A48 certification remains incomplete: coherent record binding and name
mapping, expiration/password-age semantics, editor-driven denial/revocation,
requested-user group/ListACS/ReadACS context, and the encrypted bounded embedded
worker plus full native-to-web evidence are still required. See
[a48-binding-certification.md](a48-binding-certification.md).

The user has authorized merging disabled development groundwork before native
certification because MysticWeb is not live. Earlier instructions to keep PR #12
draft described the previous activation scope. Merging groundwork does not
certify or enable native authentication. D:\mystic remains excluded; E:\mystic
is disposable, but this workspace needs neither installation.
