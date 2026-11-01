# Local MysticWeb login

Development login automatically uses `MYSTIC_DATA_ROOT` to locate `data/users.dat`. No sandbox-login enable flag or duplicate users.dat path is needed.

In `.env.local`:

```dotenv
MYSTIC_DATA_ROOT=E:/mystic
MYSTICWEB_SANDBOX_SESSION_DB=E:/work/mysticweb-local/sessions.sqlite
MYSTICWEB_SANDBOX_RATE_KEY=<64-character-random-hex-value>
```

Generate the rate-limit secret using `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Create the session DB parent directory with `New-Item -ItemType Directory -Force E:\\work\\mysticweb-local`. Keep `.env.local` private and restart `npm run dev`. Log in at `http://localhost:3000/login`; check session at `/api/auth/session`.

Login is automatically active in local development with the required session storage/key settings. The session DB and rate key are MysticWeb security settings, not duplicate native BBS configuration.

**Production remains disabled** until Mystic 1.12 A48 expiration and account-policy semantics have been independently verified. This development implementation checks known account flags but cannot establish full policy parity. Native message-area access remains denied. The dashboard is still a preview with placeholder widgets.
