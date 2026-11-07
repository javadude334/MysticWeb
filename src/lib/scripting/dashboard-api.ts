export type DashboardWidget =
  | { type: "welcome"; title: string; description: string }
  | { type: "bulletins"; title: string; items: { title: string; description: string }[] }
  | { type: "stat"; title: string; value: string; description: string }
  | { type: "mail"; title: string; description: string }
  | { type: "list"; title: string; items: string[]; description: string };

export interface DashboardApi {
  showWelcome(options?: { title?: string; description?: string }): void;
  showBulletins(options?: { limit?: number }): void;
  showEmail(): void;
  showWhosOnline(): void;
  showLastCallers(options?: { limit?: number }): void;
  showMessageStats(): void;
  showRecentFiles(options?: { limit?: number }): void;
  showSystemStats(): void;
  showDoorGames(): void;
  showCustomText(options: { title: string; text: string }): void;
}

export function createDashboardApi(): { ui: DashboardApi; widgets: DashboardWidget[] } {
  const widgets: DashboardWidget[] = [];
  const unavailable = "Placeholder — native BBS data is not connected.";
  const ui: DashboardApi = {
    showWelcome(options = {}) {
      widgets.push({ type: "welcome", title: options.title ?? "Welcome to the BBS", description: options.description ?? "Your Mystic community, reimagined for the web." });
    },
    showBulletins(options = {}) {
      const items = [
        { title: "Welcome to Mystic BBS Software", description: "Default Mystic bulletin: introductory information. Live bulletin content is not loaded yet." },
        { title: "About This Bulletin Menu", description: "Default Mystic bulletin: bulletin menu help and information." },
      ];
      widgets.push({ type: "bulletins", title: "System Bulletins", items: items.slice(0, Math.max(0, options.limit ?? items.length)) });
    },
    showEmail() { widgets.push({ type: "mail", title: "Private Mail", description: "Mystic Mail: local private messaging is in development." }); },
    showWhosOnline() { widgets.push({ type: "list", title: "Who's Online", items: [], description: unavailable }); },
    showLastCallers() { widgets.push({ type: "list", title: "Last Callers", items: [], description: unavailable }); },
    showMessageStats() { widgets.push({ type: "stat", title: "New Messages", value: "—", description: unavailable }); },
    showRecentFiles() { widgets.push({ type: "list", title: "Recent Files", items: [], description: unavailable }); },
    showSystemStats() { widgets.push({ type: "stat", title: "System Statistics", value: "—", description: unavailable }); },
    showDoorGames() { widgets.push({ type: "list", title: "Door Games", items: [], description: unavailable }); },
    showCustomText({ title, text }) { widgets.push({ type: "list", title, items: [text], description: "" }); },
  };
  return { ui, widgets };
}
