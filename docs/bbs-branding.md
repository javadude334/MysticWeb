# BBS display name

MysticWeb reads `BBSName` from the A48 `mystic.dat` in `MYSTIC_DATA_ROOT`.
For this sandbox, the ignored `.env.local` contains:

```
MYSTIC_DATA_ROOT=E:/mystic
```

Start from the repository with `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000`.
Open http://127.0.0.1:3000/. Refresh after changing the BBS name through Mystic's
supported configuration interface. The name is read per request and reused within
that request, rather than baked into the build. The home, connection, login,
application shell, page title and scalable web banner share this source.

Only the 31-byte BBSName field is read at offset 989, derived from packed
RecConfig in the sandbox's A48 docs/records.112. No user/message files are read
for branding. The reader rejects linked paths, unsupported file sizes, control
bytes and changes during the read. CP437 display text is escaped by React;
Mystic color macros are removed. Missing or invalid configuration displays
MysticWeb. Configuration paths and errors are not exposed to visitors.

The Windows reader excludes D: during this sandbox sprint. No production BBS
has been accessed. BBS-name configuration does not authorize authentication or
message reads. The connection address remains separately configured by the
existing public site; a display name is not a hostname.

The Messages page now consumes the protected message API, with area selection,
25-message pages, older/newest navigation, a plain-text reader, cancellation of
stale requests, and sign-out. Native authentication remains unavailable, so it
shows the connection-unavailable state rather than fabricated messages.

The ANSI artwork experiment is paused and has not been installed into Mystic.

Planned custom-logo convention: the operator places `web-logo.png` in the active
Mystic theme's TextPath. This is a proposal, not an existing Mystic setting or
an implemented upload feature. Resolve the selected theme's actual TextPath;
never assume the default theme directory or expose arbitrary theme files.
Production files have not been inspected or changed.
