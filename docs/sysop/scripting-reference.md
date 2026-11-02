# MysticWeb Scripting Reference Manual

**Audience:** SysOps customizing MysticWeb menus and dashboards. **Status:** Development/prototype reference, checked against the current bundled dashboard API. This is not a public HTTP API.

## What should we call these functions?

The **MysticWeb Scripting API** is the set of JavaScript functions supplied to a dashboard script. Each callable function is a **scripting command**. The `ui` object contains the currently implemented dashboard commands. This is different from an HTTP route such as `/api/messages`.

## Where the current script lives

- Default script: `src/lib/scripting/default-dashboard.js`
- Available commands and parameters: `src/lib/scripting/dashboard-api.ts`
- Script loader: `src/lib/scripting/dashboard-runtime.ts`
- Dashboard rendering: `src/app/dashboard/page.tsx`
- Menu entries: `src/lib/navigation/default-navigation.ts`

The bundled script is imported by the application. **SysOp-supplied external scripts and a safe script sandbox are not implemented yet.** Edit a development checkout only; changes require rebuilding for deployment.

## A complete example

```js
export default async function dashboard({ ui }) {
  ui.showWelcome({
    title: "Welcome to My BBS",
    description: "Come for the messages, stay for the games."
  });
  ui.showBulletins({ limit: 3 });
  ui.showEmail();
  ui.showWhosOnline();
  ui.showLastCallers({ limit: 10 });
  ui.showDoorGames();
  ui.showCustomText({
    title: "SysOp News",
    text: "Welcome to our community!"
  });
}
```

**Note:** This example demonstrates valid scripting calls, **not** live-data availability. Most commands still display placeholder content.

## Current scripting commands

| Command | Purpose | Parameters | Current status |
| --- | --- | --- | --- |
| `ui.showWelcome({ title, description })` | Welcome panel | Optional `title` and `description` strings | Working static panel |
| `ui.showBulletins({ limit })` | Bulletin section | Optional `limit` number | Widget exists; dashboard page separately loads available native bulletin files |
| `ui.showEmail()` | Private mail summary | None | Placeholder; no live inbox |
| `ui.showWhosOnline()` | Online users | None | Placeholder |
| `ui.showLastCallers({ limit })` | Recent callers | Optional `limit` number | Placeholder |
| `ui.showMessageStats()` | Message statistics | None | Placeholder |
| `ui.showRecentFiles({ limit })` | Recent file list | Optional `limit` number | Placeholder |
| `ui.showSystemStats()` | BBS statistics | None | Placeholder |
| `ui.showDoorGames()` | Available doors | None | Placeholder |
| `ui.showCustomText({ title, text })` | SysOp-defined static text | Required `title` and `text` strings | Working static text |

**Naming convention:** Actual callable names use camelCase (`showWhosOnline`), even when the operator guide uses friendly labels such as “Who's Online.”

### Important distinction: show vs. get vs. action

- **Display commands (`show*`)** add a UI section to the dashboard. They do not return caller records or messages to the script.
- **Data access commands (`get*` or `list*`)** would return structured information to a script for custom display or decisions. These are a **proposed future API**, not currently implemented as operator scripting commands.
- **Action commands** such as `launchDoor`, `readMail`, or `sendMail` would require authenticated caller context and authorization. They are **not currently available** as scripting commands. A function named `showEmail()` does **not** read private messages.

## Disconnected data/action command stubs (added to source)

The server-side module `src/lib/scripting/bbs-commands.ts` now defines typed, **fail-closed stubs** for `getBulletins`, `getWhosOnline`, `getLastCallers`, `listMessageAreas`, `readMessage`, `listMail`, `readMail`, `sendMail`, `getRecentFiles`, `getSystemStats`, `getDoorGames`, `launchDoor`, `getOneLiners`, `getVotes`, `getUserListing`, `getBbsListing`, `getUsageStats`, `getNodeMessages`, and `getTimeBank`. Every stub currently returns `{ status: "unavailable", reason: "..." }`; **none reads or writes Mystic data**. They are internal TypeScript contracts, not yet accessible to SysOp-authored scripts or external HTTP clients. Existing menu entries have optional command metadata, and feature-preview pages identify the reserved command. The real authorization, data adapters, and UI wiring are separate future tasks. These commits have not been regression-tested on the operator's computer.

## Proposed scripting command families (not implemented)

| Category | Examples for future design | Required safeguards |
| --- | --- | --- |
| Bulletins | `getBulletins()`, `showBulletins()`, `displayFile()` | Allowlisted paths; safe text rendering |
| Callers | `getWhosOnline()`, `showWhosOnline()`, `getLastCallers()` | Respect user visibility/privacy |
| Messages | `listMessageAreas()`, `readMessage()`, `postMessage()` | Native per-user ACS and area authorization |
| Private mail | `listMail()`, `readMail()`, `sendMail()` | Recipient/owner checks, no private-mail leakage |
| Door games | `listDoors()`, `showDoorGames()`, `launchDoor()` | Authorized launch tickets and game allowlist |
| Navigation | `showMenu()`, `navigateTo()` | Safe local destinations, no authorization bypass |
| BBS stats | `getSystemStats()`, `showSystemStats()` | Limit exposed data |

The table is a **design vocabulary**, not a promise that these functions exist. Final names, signatures, supported scripts, and error handling will be decided and documented alongside implementation.

## How to customize a menu today

The current menu is **not** script-driven. Change the array in `src/lib/navigation/default-navigation.ts`, using the guide [Customizing menus and dashboard](customizing-menus.md). Hiding a link does not prevent direct navigation or replace server authorization.

## Troubleshooting and safe editing

1. Make a backup or Git commit before editing bundled script files.
2. Use the exact case-sensitive function name and supported parameter names.
3. Run `npm run typecheck`, `npm test`, and `npm run build`.
4. If a change fails, restore the prior file rather than disabling security checks.
5. Do **not** execute scripts uploaded by callers or copied from untrusted sources: the current bundled runtime has no script isolation.

## Future operator experience

The goal is for SysOps to edit safe, documented scripts and menus in an operator-owned customization directory, with default templates, validation, preview and rollback, without changing application source or requiring a GitHub workflow. This is planned, not implemented.
