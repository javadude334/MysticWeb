/**
 * Bundled example of a SysOp-style scripted menu. Only known, local Mystic
 * text basenames are allowed. No arbitrary paths or network fetches.
 */
export type NewsMenuItem = { id: string; title: string; textFile: string };
export type NewsMenu = { title: string; items: readonly NewsMenuItem[] };
export function createNewsMenu(): NewsMenu {
  return {
    title: "News",
    items: [
      { id: "bbc", title: "BBC World News", textFile: "world-news" },
      { id: "npr", title: "NPR News", textFile: "npr-news" },
      { id: "fox", title: "Fox News Alerts", textFile: "fox-news-alert" },
      { id: "csm", title: "Christian Science Monitor", textFile: "csm-news" },
    ],
  };
}
export function getNewsItem(id: string): NewsMenuItem | undefined {
  return createNewsMenu().items.find(item => item.id === id);
}
