# MysticWeb navigation and menu design handoff — 2026-11-03

## Verified local state
- User ran `git pull --ff-only origin main`, `npm run typecheck`, `npm test`, `npm run build` on Windows at commit `1f867a9`: typecheck passed, 72 tests passed, 2 Windows-specific tests skipped, build succeeded (42/42 static page generation).
- User visually verified the sidebar and Door Games page in the browser. Door Games is a top-level destination, not nested under Files & Downloads.
- Navigation code: `src/components/sidebar-navigation.tsx`, `src/lib/navigation/navigation-collections.ts`, `src/lib/navigation/menu-items.ts`, `src/app/main-menu/page.tsx`.
- Navigation folders default collapsed, with expansion preference persisted. Main Menu name opens the page; its chevron expands children. Main Menu excludes Files and Door Games through shared filtering.
- Subsequent documentation commits `d82ef6e`, `321d62d`, `b0387c6` did not change runtime navigation. Current source status should be checked before further edits.

## Approved product decisions
- Mystic's default out-of-the-box terminal theme/menu set is the source baseline; ignore sandbox Change Theme and experimental Python test entries.
- MysticWeb has one standard visual design, **no themes or theme switching**.
- Top-level web navigation includes Dashboard, Main Menu, Message Center, Files & Downloads, Door Games, Community, Board & SysOp, Account. The *native terminal SysOp menu* is excluded for now.
- A `GO` to a web top-level destination is omitted from the originating menu; a `GO` to a meaningful submenu remains **on its originating menu** as a child/nested item.
- Omit logoff/goodbye, linefeeds, blanks, separators, and terminal-only return/back commands. Example `default.file` command ID 13 'Quit to Main' uses `GO main` and is omitted.
- Individual installed door games should appear as expandable children under Door Games once discovered/connected; clicking Door Games opens its directory.
- Web presentation must never bypass Mystic's native access checks; no changes to native `.mnu` files.
- SysOps must eventually create/reorder/hide their own top-level menus and nested navigation items, attach built-in MysticWeb functions, and author JavaScript behaviors via a documented, constrained, permission-aware API. Customizations survive upgrades. **This is a requirement, not yet implemented.** A future MysticWeb administration UI is distinct from the excluded native terminal SysOp menu.

## Pending work
1. Obtain/read actual `C:\MysticSandbox` default `.mnu` definitions (not available in GitHub). Classify source menu, command ID, action, target, ACS, web placement, and implementation status; flag non-stock experiments.
2. Approve complete default navigation hierarchy and map terminal commands to web functions.
3. Implement reusable menu mapping/filtering, menu-page/expand behavior and automated tests for omitted commands.
4. Implement authorized door-game discovery/launch integration; no real door games connected yet.
5. Design SysOp menu editor, durable configuration storage, safe/versioned JavaScript scripting functions and access model.
6. Continue native messaging, shared mail, and release safety tasks recorded in the master tracker.

## References
- `docs/sysop/mystic-menu-conversion-rules.md`
- `docs/sysop/customizing-menus.md` (older prototype notes; current capabilities remain limited)
- `docs/development-status-2026-11.md`
- Master Google Sheet: Javadude Development — Master Project Tracker (Dashboard, Milestones, Decision Log, Chat Handoff, Issues, MysticWeb Features)

## Resume point
Start by obtaining a read-only export of sandbox default menu definitions, **not** by changing Mystic native menus. Keep user-facing navigation compact and collapsed by default. Run typecheck/tests/build after code edits.
