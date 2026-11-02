# MysticWeb APIs: what SysOps can use today

MysticWeb uses the word **API** in two different ways:

1. **Dashboard scripting helpers** (`ui.showWelcome()`, etc.) are JavaScript functions used by the bundled dashboard script. They are explained with examples in [Customizing menus and dashboard](customizing-menus.md).
2. **HTTP endpoints** are web addresses under `/api/`. These are **not** general-purpose, unauthenticated BBS data feeds.

## Current verified HTTP routes

| Route | Method | Intended use / current status |
| --- | --- | --- |
| `/api/health` | GET | Returns JSON with `status` and `revision`, with no-store caching. Useful for a basic health check, **not** proof that Mystic messaging works. |
| `/api/messages` | GET | Staged message-area catalog and read endpoint. The current production composition returns **503 unavailable**. It must not be enabled without native per-user authorization. |

The message reader's planned query parameters are `area` (numeric area ID), `before` (pagination cursor), `limit` (1–50), and `message` (individual message number). An authenticated/authorized area catalog request uses `/api/messages` with no query parameters. **Do not assume this works against a public installation today.** Never send passwords or private mail through a test query.

## Test the safe health endpoint locally

With a local development server running:

```text
http://localhost:3000/api/health
```

Expected response structure resembles:

```json
{"status":"ok","revision":"development"}
```

The revision may differ. This endpoint says only that the web app responded.

## Developer-only reader demonstration

The repository also has a **synthetic, loopback-only** reader workspace documented in [Development workspace](../development-workspace.md). Start it with `npm run dev:demo` and open `http://127.0.0.1:3000/development`. It uses fake accounts and fake message boards; **do not use real Mystic credentials**. This is not a public SysOp API.

## API safety rules

- Never treat a browser's user ID, selected message area, or menu visibility as authorization.
- The server must verify native account status and each requested message area's permissions.
- Never expose Mystic database file paths or raw ACS expressions through public endpoints.
- Do not publish private mail or write to JAM files through undocumented APIs.
- Future operator scripting APIs and HTTP routes will be documented with examples only after they are implemented and tested.
