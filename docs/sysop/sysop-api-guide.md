# MysticWeb SysOp API Guide
**Status: proposed interface and implementation tracker — November 2026.** Names below are design proposals unless explicitly marked implemented. This is not an HTTP API, nor a compatible replacement for Mystic's Python scripting interpreter.

Inspired by the [Mystic Python functions reference](https://wiki.mysticbbs.com/doku.php?id=python_functions). The Mystic reference describes native BBS/terminal behavior; MysticWeb needs browser-safe and authorization-aware equivalents.

## Current capabilities
- **Implemented (source code)**: `config/sysop-menus.json` with validated `displayText`, `openMenu`, and allowlisted `openPage` actions. News, Demos, and Goodbye use the menu/text system; System Bulletins retains the native bulletin parser. Text display requires a configured Mystic theme and matching `.asc` files.
- **Implemented dashboard display helpers**: `ui.showWelcome({title,description})` and `ui.showCustomText({title,text})`.
- **Partial dashboard helpers**: `ui.showBulletins({limit})`, `ui.showEmail()`, `ui.showWhosOnline()`, `ui.showLastCallers({limit})`, `ui.showMessageStats()`, `ui.showRecentFiles({limit})`, `ui.showSystemStats()`, `ui.showDoorGames()`. Many produce placeholders. The dashboard page independently reads native bulletin files.
- **Internal disconnected stubs**: `src/lib/scripting/bbs-commands.ts` declares data/action names but returns unavailable. **Not callable by SysOp-authored scripts.**
- **Not implemented**: a sandboxed external SysOp script runner, native message and file APIs, and production authorization for these functions.

## Current security groundwork (November 3, 2026)

The server-only `WebAccess` class now has internal `currentCaller(request)` and `canReadMessageArea(request, areaId, catalogRevision)` helpers. Both deny when the session or native provider is unavailable; the latter uses the existing per-area native authorization boundary. These are **not** public SysOp script methods, and `productionAccess()` still returns `null`. Tests were added for permission rejection and absent native providers; CI execution is still required.

## Planned API — ordered by dependencies

| Phase | Proposed function | Purpose | Mystic inspiration | Status |
| --- | --- | --- | --- | --- |
| 1 Display | `ui.showTextFile({name})` | Display approved local Mystic text | `showfile` | Planned API; underlying reader exists |
| 1 Display | `ui.showMenu({title,items})` | Render approved menu actions | `menucmd` | Planned API; JSON menus exist |
| 1 Display | `ui.showText({title,text})` | Display styled text | `write`, `writeln`, `pwrite` | Planned API; `showCustomText` exists |
| 1 Display | `ui.navigateTo({page})` | Navigate to approved route | menu commands | Planned API; JSON `openPage` exists |
| 2 Identity | `bbs.getCurrentUser()` | Server-authenticated caller context | `getuser` | Planned |
| 2 Identity | `bbs.getUserProfile({userId})` | Permitted public profile | `getuserid` | Planned |
| 2 Access | `bbs.hasAccess({resource})` | Check native access rules on server | `access`, `acsnogroup` | Planned |
| 2 Config | `bbs.getSystemInfo()` | Nonsecret public BBS metadata | `getcfg` | Planned |
| 2 Text | `bbs.expandDisplayCodes({text})` | Safe display-code subset | `mci2str` | Planned |
| 3 Messages | `bbs.getMessageGroups()` | Accessible message groups | `getmgroup` | Planned |
| 3 Messages | `bbs.getMessageAreas()` | Accessible message bases | `getmbase` | Planned; internal stub |
| 3 Messages | `bbs.listMessages({areaId,limit,before})` | Authorized message headers | `msg_open`, `msg_gethdr` | Planned |
| 3 Messages | `bbs.readMessage({areaId,messageId})` | Authorized message text | `msg_gettxt` | Planned; internal stub |
| 3 Messages | `bbs.getMessageStats()` | Counts and unread stats | `msg_stats` | Planned |
| 3 Files | `bbs.getFileAreas()` | Accessible file bases/groups | `getfgroup`, `getfbase` | Planned |
| 3 Files | `bbs.listFiles({areaId,limit})` | Authorized file listing | `fl_open`, `fl_getfile` | Planned |
| 3 Files | `bbs.getFileDetails({areaId,fileId})` | Authorized file description | `fl_getdesc` | Planned |
| 3 Community | `bbs.getWhosOnline()`, `bbs.getLastCallers({limit})` | Caller-safe lists | caller/node data | Planned; internal stubs |
| 4 Input | `ui.showInput({label})` | Validated browser text input | `getstr` | Planned |
| 4 Input | `ui.showChoice({title,options})` | Accessible choice selector | `onekey` | Planned |
| 4 Input | `ui.showConfirm({message})` | Browser confirmation | `getyn` | Planned |
| 4 Input | `ui.showPrompt({text})` | Configurable prompt | `getprompt`, `setprompt` | Planned |
| 4 Scripts | named validated options | Pass arguments to configured scripts | `param_count`, `param_str` | Planned |
| 5 Mail | `bbs.listMail()`, `bbs.readMail({messageId})`, `bbs.sendMail({recipient,subject,body})` | Owner-authorized private mail | native mail | Planned; internal stubs |
| 5 Doors | `bbs.getDoorGames()`, `bbs.launchDoor({gameId})` | List/launch approved doors | native door commands | Planned; internal stubs |
| 5 Logging | `bbs.logEvent({category,message})`, `bbs.logError({code,message})` | Sanitized audit/diagnostic events | `sysoplog`, `logerror` | Planned |

## Security contract before implementation
1. Resolve caller identity on the server; never trust a supplied user ID or visible menu item as authorization.
2. Apply account-status and native ACS checks **for each** message, file, mail or door request. Fail closed if a provider is missing.
3. Restrict text-file names, menu destinations and scripts to operator-approved sources. Do not run caller-supplied JavaScript.
4. Validate all arguments; bound pagination and output size. Escape displayed content; never leak credentials, raw file paths, or private mail.
5. For writes, add CSRF protection, rate limits, logging and explicit permission checks. No arbitrary native delete, shutdown or user-update commands in the initial API.
6. Confirm Mystic 1.12 A48 data formats and read/write behavior against test data before enabling native adapters.

## Example — **future design only, not executable**
```js
export default async function dashboard({ui, bbs}) {
  ui.showTextFile({name: "welcome"});
  ui.showMenu({title: "Main Menu", items: [
    {label: "News", menu: "news"},
    {label: "Bulletins", page: "/features/bulletins"}
  ]});
  if (await bbs.hasAccess({resource: "messages"})) {
    const areas = await bbs.getMessageAreas();
    // Render only authorized results.
  }
}
```

## Milestones and verification gates
- **M1 Baseline**: `npm ci`, `npm run typecheck`, `npm test`, `npm run build` on CI and Windows/Linux test machines; resolve failures before release.
- **M2 Auth/ACS**: test active/disabled accounts, unauthenticated access, group/area restrictions and direct-URL bypass.
- **M3 Native read-only**: message-area and file-area discovery; verify formats, paging, encoding, malformed data and access controls.
- **M4 Interactive**: browser inputs and operator-safe script configuration; no arbitrary code execution.
- **M5 Private/actions**: mail and door operations only after authorization and audit coverage.
- **M6 Test installation**: staging against a nonproduction Mystic copy; check theme files, bulletin rendering, missing files, permissions, and Windows/Linux paths.

See [Scripting Reference](scripting-reference.md) for callable dashboard helper signatures, [Menu Actions](menu-actions.md) for current JSON configuration, and [HTTP APIs](apis-and-scripting.md) for separate web routes.
