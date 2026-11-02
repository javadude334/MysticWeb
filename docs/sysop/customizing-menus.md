# Customizing MysticWeb menus and dashboard (current prototype)

**Read this first:** MysticWeb's web navigation is **independent** of Mystic's terminal `.mnu` files. The design calls for SysOp-customizable menus and dashboards, but the current main branch still uses **bundled source files**. There is **no supported admin-screen menu editor or isolated uploadable JavaScript runtime yet**. The steps below are for a development checkout, not a production customization feature.

## Before editing

1. Back up your checkout or commit your current work. Do not edit live Mystic menus or databases.
2. Open the MysticWeb project folder in a plain-text editor (VS Code is optional).
3. Make one small change at a time, then run `npm run typecheck`, `npm test`, and `npm run build` before publishing anything.
4. Source changes can be overwritten by updates. Keep a record of your changes until a supported override mechanism exists.

## Change the web menu labels, order, or visibility

Open `src/lib/navigation/default-navigation.ts`. It exports an array named `defaultNavigation`; each item has:

- `href`: existing MysticWeb page path.
- `name`: visible menu label.
- `icon`: symbol shown beside the menu item.
- `description`: descriptive text.
- `enabled`: optional; set to `false` to hide an item from the default sidebar/dashboard menu.

Example **illustrating the existing fields** (not a complete replacement file):

```ts
{ href: "/messages", name: "Message Boards", icon: "≡",
  description: "Read community conversations", enabled: true }
```

The sidebar in `src/components/shell.tsx` and the dashboard's main menu both consume this array. **Changing `href` does not create a new page or grant access.** Hiding a menu item does **not** secure its route. Keep existing route paths unless you have implemented the corresponding page.

## Customize the dashboard script

Open `src/lib/scripting/default-dashboard.js`. It exports an asynchronous function receiving `{ ui }` and calls documented `ui.*` helpers. For example, a minimal dashboard **replacement** might be:

```js
export default async function dashboard({ ui }) {
  ui.showWelcome({
    title: "Welcome to Our BBS",
    description: "News, messages and door games."
  });
  ui.showBulletins({ limit: 2 });
  ui.showCustomText({
    title: "SysOp Announcement",
    text: "Our monthly meetup is on Saturday."
  });
  ui.showDoorGames();
}
```

The current runtime at `src/lib/scripting/dashboard-runtime.ts` **imports this bundled script directly**. It is not a sandbox. Do **not** load untrusted scripts, arbitrary downloaded plugins, or scripts uploaded by callers into the server process. Editing this source requires a rebuild for a deployed production bundle.

## Dashboard API quick reference

These are the currently implemented helper **names and accepted options**, verified in `src/lib/scripting/dashboard-api.ts`. They generate widget descriptions; most **do not yet retrieve live BBS data**.

| Helper | Options | Current behavior |
| --- | --- | --- |
| `ui.showWelcome({title, description})` | Both optional strings | Welcome panel |
| `ui.showBulletins({limit})` | Optional number | Adds bulletin widget; dashboard page separately renders available native bulletin entries |
| `ui.showEmail()` | None | Placeholder private-mail stat |
| `ui.showWhosOnline()` | None | Placeholder online-user list |
| `ui.showLastCallers({limit})` | Optional number | Placeholder callers list |
| `ui.showMessageStats()` | None | Placeholder message stat |
| `ui.showRecentFiles({limit})` | Optional number | Placeholder recent files |
| `ui.showSystemStats()` | None | Placeholder system stat |
| `ui.showDoorGames()` | None | Placeholder game list |
| `ui.showCustomText({title, text})` | Required strings | Static text widget |

**Important:** These are internal dashboard JavaScript helpers, **not public HTTP endpoints**. The helper names are camelCase as shown. The earlier planned commands such as `launchdoor`, `display-file`, or editable menu scripts are **not verified as working APIs in the current main branch**.

## Current limitations and future design

The current dashboard page in `src/app/dashboard/page.tsx` renders widget types `welcome`, `bulletins`, `stat`, and `list`. The default navigation is compiled into the app. The eventual operator-friendly design is a **separate, SysOp-owned customization directory** with documented scripts, templates, validation, rollback, and a constrained/sandboxed runtime. This is a **plan**, not a current configuration path.

## If a customization fails

Restore the previous file, run `npm run typecheck`, `npm test`, and `npm run build`, then restart your development preview. Never try to fix a broken menu by weakening authentication or file permissions.
