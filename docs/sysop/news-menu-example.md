# Example: build a four-source News menu

This **working, bundled example** illustrates a SysOp-style menu with four options, each opening a local Mystic text file. It is intentionally **not** a general-purpose scripting engine or external RSS fetcher.

## What callers see

From MysticWeb's main navigation, choose **News**, or visit `/news`. The menu links to:

| Choice | Source | Mystic text file |
| --- | --- | --- |
| 1 | BBC World News | `world-news.asc` |
| 2 | NPR News | `npr-news.asc` |
| 3 | Fox News Alerts | `fox-news-alert.asc` |
| 4 | Christian Science Monitor | `csm-news.asc` |

The page displays the local text output from the **existing Mystic news updater**. MysticWeb does not retrieve RSS feeds, generate news, or change the scheduled updater.

## The example menu script

Open `src/lib/scripting/news-menu.ts`. Its `createNewsMenu()` function returns a title and items:

```ts
export function createNewsMenu() {
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
```

The real file also defines TypeScript types and `getNewsItem()`. This is **source-based configuration**, not a SysOp-uploadable script.

## How it works

1. `src/app/news/page.tsx` uses `createNewsMenu()` to render clickable links.
2. `src/app/news/[source]/page.tsx` validates the selected source against that menu.
3. `src/lib/mystic/news-text.ts` reads the allowlisted `.asc` file from `MYSTIC_DATA_ROOT/themes/<theme>/text`.
4. `src/components/mystic-text.tsx` renders Mystic pipe colors as escaped React text, not HTML.
5. Missing files show an unavailable message instead of invented articles.

The default theme is `default`, overridable with `MYSTICWEB_BULLETIN_THEME`. `MYSTIC_DATA_ROOT` must be an absolute path. The text reader caps files at 256 KiB and rejects direct symbolic links. **Keep the Mystic data mount read-only and operator-controlled**; this simple example does not establish full authorization for arbitrary user files.

## For other SysOps

You can study this menu to understand how choices, page routes, and text rendering fit together. **Do not add an arbitrary filename parameter to a public URL.** A future `ui.showMenu()` / `ui.showTextFile()` API will make this pattern configurable without editing source files, using an approved file catalog and security checks.

## Current limits

The news menu is available in source on `main`, but the implementation has not been verified in a local build or against the user's live news files in this session. It does not use Mystic's terminal `news.mnu` directly, and does not guarantee that every source's text file currently exists.
