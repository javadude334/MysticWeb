import { defaultNavigation } from "./default-navigation";

/** Top-level destinations are accessible directly in MysticWeb's sidebar.
 * Terminal-style links to these destinations need not be repeated inside
 * the Main Menu. This affects presentation only, not Mystic's native menus
 * or authorization.
 */
export const topLevelMenuDestinations = new Set(["/files", "/door-games"]);

export function mainMenuItems() {
  return defaultNavigation.filter(item =>
    item.enabled !== false &&
    item.href !== "/dashboard" &&
    item.href !== "/main-menu" &&
    !topLevelMenuDestinations.has(item.href)
  );
}
