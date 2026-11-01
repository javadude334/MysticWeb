# Local sandbox login prototype

This is an opt-in **development-only** authentication path for the Mystic BBS sandbox at `E:\\mystic`. It is not a production activation. The native file reader checks the password against `users.dat`, then creates a persistent SQLite session and sets a secure, HttpOnly, SameSite=Strict cookie. Native message-area permissions remain disabled. The A48 account expiration field is still unverified; this development path checks known lock/deleted/password-change flags but does not claim full native account-policy parity.

## Configure on Windows

Create a private directory outside the repository for the session database:

```powershell
New-Item -ItemType Directory -Force E:\\work\\mysticweb-local | Out-Null
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy the generated 64-character hex value into `.env.local` (do not commit this file):

```dotenv
MYSTICWEB_ENABLE_SANDBOX_LOGIN=true
MYSTICWEB_SANDBOX_USERS_DAT=E:\\mystic\\data\\users.dat
MYSTICWEB_SANDBOX_SESSION_DB=E:\\work\\mysticweb-local\\sessions.sqlite
MYSTICWEB_SANDBOX_RATE_KEY=PASTE_64_CHARACTER_RANDOM_HEX_VALUE
```

Restart `npm run dev`, then use **http://localhost:3000/login**. The browser's special handling of secure cookies on localhost is required; do not test this over an ordinary LAN HTTP address. Login returns `{ok:true}` and redirects to the dashboard. `GET /api/auth/session` returns `authenticated:true` and native user ID when a valid sandbox session is present. `POST /api/auth/logout` revokes the session (same-origin request).

This does **not** grant message read permissions or connect native node presence. The dashboard is still a public preview and its widgets remain placeholders. A later phase will use the authenticated identity to personalize the dashboard and enforce page access.

## Verification

Run `npm test`, `npm run typecheck`, and `npm run build` after pulling main. No local Windows runtime test has been performed by the assistant for this change.

The dev login route is only selected when `NODE_ENV=development` and `MYSTICWEB_ENABLE_SANDBOX_LOGIN=true`; otherwise the existing production access path remains unavailable.
