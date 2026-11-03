# Mystic terminal menu to MysticWeb navigation rules

These rules are approved for the MysticWeb navigation inventory and future menu conversion. They govern **web presentation**, not native Mystic execution or security.

1. Omit a terminal `GO` action when its destination is already represented by a top-level MysticWeb navigation menu. Example: `default.file` command ID 13, "Quit to Main", `GO` destination `main`.
2. Preserve `GO` destinations for meaningful submenus, represented as child or nested web navigation, unless otherwise excluded.
3. Omit terminal logoff/goodbye actions, linefeeds, blank entries, and layout-only separators.
4. Exclude the SysOp menu from MysticWeb for now; do not surface its commands through the web menu.
5. Preserve functional commands that have supported web equivalents, but enforce native access restrictions server-side. Hiding a link never grants or revokes permission.
6. Keep Mystic's native `.mnu` files unchanged. Build a mapping of source menu, command ID/action/data, destination, web placement, and implementation status before converting additional menus.
7. Door Games is top-level. When games are connected, the Door Games title opens the directory and an independent chevron may expand installed game links. Do not invent game entries before discovering installed games.

**Inventory pending:** The actual menu files under the user's local `C:\MysticSandbox` are not accessible from the repository. Do not claim a complete menu inventory until the sandbox menu definitions are exported or supplied.
