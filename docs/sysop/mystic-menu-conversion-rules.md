# Mystic terminal menu to MysticWeb navigation rules

These rules are approved for the MysticWeb navigation inventory and future menu conversion. They govern **web presentation**, not native Mystic execution or security.

1. Omit a terminal `GO` action when its destination is already represented by a top-level MysticWeb navigation menu. Example: `default.file` command ID 13, "Quit to Main", `GO` destination `main`.
2. Preserve `GO` destinations for meaningful submenus **on the originating menu** as child or nested items, unless otherwise excluded.
3. Omit terminal logoff/goodbye actions, linefeeds, blank entries, and layout-only separators.
4. Exclude the SysOp menu from MysticWeb for now; do not surface its commands through the web menu.
5. Preserve functional commands that have supported web equivalents, but enforce native access restrictions server-side. Hiding a link never grants or revokes permission.
6. Keep Mystic's native `.mnu` files unchanged. Build a mapping of source menu, command ID/action/data, destination, web placement, and implementation status before converting additional menus.
7. Door Games is top-level. When games are connected, the Door Games title opens the directory and an independent chevron may expand installed game links. Do not invent game entries before discovering installed games.

**Inventory pending:** The actual menu files under the user's local `C:\MysticSandbox` are not accessible from the repository. Do not claim a complete menu inventory until the sandbox menu definitions are exported or supplied.

## Supported Mystic menu baseline

- Inventory and implement **only the stock/default out-of-the-box Mystic theme** and its default menu definitions.
- The local sandbox has historical experiments involving **Change Theme** and Python test commands. Exclude those customizations from the baseline inventory and web conversion.
- **MysticWeb will not offer themes or a Change Theme feature.** Its web interface has one standard design.
- Do not infer that every sandbox command is stock; flag deviations and exclude the known experiments.

## SysOp customization is a core requirement

The stock default Mystic menus are the **initial seed**, not a restriction on what a SysOp may configure. MysticWeb has one standard visual design and **no theme switching**, but each SysOp must eventually be able to:

- Create, rename, reorder, hide, and remove custom menus and navigation entries, including top-level entries and nested submenus.
- Attach supported built-in MysticWeb functions to menu items (messages, files, door games, user features, etc.).
- Implement custom behavior in JavaScript using a documented, versioned, permission-aware MysticWeb scripting API.
- Configure visibility while server-side native authentication and authorization remain authoritative.
- Preserve customization across application updates without editing bundled application source.

**Implementation status:** This is an approved product requirement, not a claim that the current repository already includes a SysOp menu editor or safe JavaScript runtime. Custom JavaScript must run through a constrained execution model, not arbitrary imports or unrestricted Node.js access. Excluding the *native terminal SysOp menu* from web conversion does **not** exclude future MysticWeb SysOp administration/customization tools.
