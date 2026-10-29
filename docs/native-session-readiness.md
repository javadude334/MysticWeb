# MysticWeb sandbox readiness — October 29, 2026

## Current result

Real browser login and account-authorized message reading are **not yet verified
or enabled**. Do not describe this branch as a working native login. Production
`productionAccess()` remains null and there is no environment-variable bypass.
Only E:\mystic was inspected/prepared; production was not accessed. Existing
artwork remains uncommitted and untouched.

Implemented web pieces:

- Login form posts to the existing same-origin session API, clears the password
  on every outcome, bounds the request duration, prevents duplicate submissions,
  handles throttling/unavailability, and navigates to `/messages` on success.
  The server renders it only after explicit native composition exists. At present
  `/login` renders the unavailable message and no credential inputs.
- Existing `/messages` UI lists authorized areas, pages through headers, renders
  message text as plain text, and signs out through the session API. Existing
  tests exercise independent accounts, logout, revocation and denied direct reads
  against a synthetic provider. They are not native acceptance evidence.
- New `readReadOnlyCatalog(root, messageRoot)` supplies bounded configuration
  snapshots and the shared catalog revision format. It rejects linked paths,
  unexpected message directories, duplicate identities and unsafe JAM basenames;
  local/private/netmail areas are excluded under the current public-echo policy.
  This loader is ready for explicit composition, not wired around the disabled
  native access gate. It never interprets ACS as an authorization grant.

## Native evidence and architecture constraint

NNTPS accepts both disposable accounts, but both LIST and GROUP experiments hide
the two fixture areas (GROUP 411), including after the operator restarted MIS.
The captured trace did not establish a JAM sharing conflict. The cause remains
unresolved; do not silently weaken the sharing locks or remove access rules.

Operator-confirmed account IDs are test=1 and javadude2=2; Security Levels are
255 and 10 respectively. The earlier offset-1011 security interpretation was
wrong and is invalidated. Do not derive any account policy from it.

AUTHINFO success is not a permanent-ID/current-eligibility response. No supported
NNTPS query supplying those facts has been established. Native `getuserid(id)`
does not switch the context used by `access(acs)`. Consequently a standalone
adapter cannot substitute dictionary lookup plus the operator's ACS result.

The supported architecture candidate uses an already authenticated native
session for each account, with `getuser(0)['id']` and native ACS evaluated only in
that same session. A future session-link flow would require an authenticated,
bounded, encrypted private channel, one-time browser binding, current eligibility
checks and per-area group/ReadACS context. Disconnect, expiration, revocation and
catalog changes must deny subsequent reads. That bridge is **not implemented or
certified by this probe**, and native login alone does not prove ongoing eligibility.

## Prepared next operator action

A new, non-overwriting sandbox script is prepared at:

`E:\mystic\themes\default\scripts\mysticweb_context_probe.mpy`

Its reviewable source is `integrations/mystic/session_context_probe.py`. It only
reads the two public fixture rules, calls `getuser(0)`, `getuserid(id)` and
`access(acs)`, and displays a small report. It accepts only the confirmed fixture
IDs, validates positive/negative native ACS and identity separation, and checks
identity/catalog stability. It never opens message bases, changes context,
collects passwords, opens a network socket or writes user/message/pointer files.
No existing native menu was edited and the script has not been run in Mystic.

When the operator returns, invoke the script from a normally authenticated E:
native session using Mystic's documented **GY** Python-2 menu command, data
`mysticweb_context_probe`. Run as each disposable account in the existing local
and TestNet group contexts, without reading messages. Record the displayed
current-context group and list/read booleans. Do not use -U/-P, a guessed
password verifier, `acsnogroup`, `saveuser`, native ARTICLE/OVER, or a foreign BBS
process to bypass the missing context. Exact native execution is still required;
synthetic tests cannot supply these results.

## Checks completed

- Application tests: 65 passed; one expected Windows POSIX-permissions skip.
- Native bridge and probe tests: 35 passed with Python 3; four new probe tests
  also passed under the installed Python 2.7 runtime.
- Changed web code lint, TypeScript, and production build passed.
- Built-app checks passed for two runtime revisions with synthetic dynamic BBS
  branding. Login/message APIs return 503, issue no cookie, and render no password
  form while native access is absent. Demo mode stays unavailable in production.

## Run the web application

From `E:\work\javadude_dev\MysticWeb`:

```powershell
npm ci
npm run dev -- --hostname 127.0.0.1
```

Open `http://127.0.0.1:3000/`. Local ignored `.env.local` supplies
`MYSTIC_DATA_ROOT=E:/mystic` for the configured BBS name. No BBS credentials belong
in environment variables or command arguments. `/messages` accurately reports
that native access is unavailable until the remaining native gates pass.

For the separate, explicitly synthetic two-account UI preview, use
`npm run dev:demo` and `/development`. This is not BBS login or live content.

References: installed A48 `docs/records.112` and `docs/whatsnew.txt`;
[ACS semantics](https://wiki.mysticbbs.com/doku.php?id=access_control),
[GY/GZ menu commands](https://wiki.mysticbbs.com/doku.php?id=menu_commands),
[versioned native APIs](https://wiki.mysticbbs.com/doku.php?id=whats_new_112).
