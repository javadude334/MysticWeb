# Today's News — Fox News (MysticWeb extension example)

This is a **standalone runnable demonstration**, not yet a menu option installed in MysticWeb. It demonstrates one server-side action (Node.js fetch + file write) and one browser-side action (render saved RSS headlines). No Mystic legacy newsreader is involved.

## Try it

Requires Node.js 20+ and network access:

```sh
node examples/fox-news/fetch-news.mjs
node examples/fox-news/serve-news.mjs
```

Visit http://127.0.0.1:8765 on the same computer. Run the fetch command again to refresh the saved file. The server intentionally binds to localhost only and serves only two allowlisted paths. Stop it with Ctrl+C.

## How this becomes a MysticWeb menu action

Proposed menu: **Today's News** -> server action `examples.foxNews.refresh` (optional or scheduled) -> client action `examples.foxNews.display`. Those action IDs are **design placeholders**, not registered functions. Integrating this example with the authenticated MysticWeb function dispatcher, its permission checks, and the menu editor is future work. Do not expose the standalone demonstration server to the public internet.

The script uses native Node.js `fetch`, `fs/promises`, and standard browser `DOMParser`; it does not invent MysticWeb wrappers for those standard operations. It stores the provider's RSS XML without modifying it, and links headlines to their original Fox News articles.

**Licensing:** Fox News states that its RSS feed is offered for **personal, non-commercial use** and is subject to its RSS terms. This example is for private evaluation and should **not** be enabled on a public/commercial BBS without reviewing and obtaining any necessary rights. See https://www.foxnews.com/story/foxnews-com-rss-feeds. For a distributable production example, use a source whose license permits that deployment or replace the feed with a licensed source.

**Security:** A production generic fetch extension must restrict outbound targets and protect against SSRF, enforce size/time limits, and use authorized file storage. This demo deliberately hardcodes one HTTPS provider and one output path.
