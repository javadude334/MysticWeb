# MysticWeb scripted dashboard prototype

The dashboard is now assembled from a bundled JavaScript script rather than a hardcoded sequence of prelogin screens.

- `src/lib/scripting/default-dashboard.js` is ordinary JavaScript and calls the widget API in the desired display order.
- `src/lib/scripting/dashboard-api.ts` defines the supported UI functions and creates **placeholder** widgets.
- `src/lib/scripting/dashboard-runtime.ts` invokes the bundled script and returns the widget definitions.
- `src/app/dashboard/page.tsx` renders those definitions as modern React UI.
- `src/lib/navigation/default-navigation.ts` defines MysticWeb's own independent menu, initially seeded from strings observed in the archived Mystic default `main.mnu`.
- `src/components/shell.tsx` uses the same menu for the sidebar. Features without implementations lead to explicit placeholder pages.

Current stub functions: `showWelcome`, `showBulletins`, `showEmail`, `showWhosOnline`, `showLastCallers`, `showMessageStats`, `showRecentFiles`, `showSystemStats`, `showDoorGames`, and `showCustomText`.

## Important limits

This prototype executes only a **bundled, trusted** JavaScript module. It does **not** accept arbitrary uploaded SysOp scripts or execute files from the Mystic installation. A later customizable JavaScript runtime will require execution isolation and controlled access to authenticated MysticWeb services. Core API functions are currently display stubs and do not read private mail, active nodes, or messages. The navigation config is a code file, not yet an admin-editable or database-backed menu. Names are adapted from the default Mystic theme; menu commands are not executed or automatically synchronized.

To change the dashboard prototype, edit the calls in `default-dashboard.js`. To change the menu, edit `default-navigation.ts`. The default welcome artwork lives at `public/themes/default/welcome.svg`.

Test locally with `npm run typecheck`, `npm test`, and `npm run build`. These commands have not been run in the user's Windows environment as part of this change.
