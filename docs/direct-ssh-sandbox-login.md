# MysticWeb direct SSH sandbox login

This is an opt-in **sandbox-only** browser login, not the old gateway.
The Next.js server connects directly to the Mystic SSH listener at
`192.168.150.58:8022`. No separate gateway process or account database is used.
The Mystic-side worker must be installed and compiled in **E:\\mystic**;
never install it in the live D:\\mystic installation.

## Ubuntu configuration

Create a private directory for session storage (the parent must be mode 0700):

```sh
mkdir -p "$HOME/.local/share/mysticweb-auth"
chmod 700 "$HOME/.local/share/mysticweb-auth"
node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'
```

Add the following to the Ubuntu MysticWeb `.env.local`, replacing the key with
the generated 64-character hex value:

```dotenv
MYSTICWEB_SANDBOX_LOGIN=enabled
MYSTIC_SSH_HOST=192.168.150.58
MYSTIC_SSH_PORT=8022
MYSTICWEB_ORIGIN=https://ubuntu:3000
MYSTICWEB_SESSION_DB=/home/javadude/.local/share/mysticweb-auth/sessions.sqlite
MYSTICWEB_RATE_KEY=REPLACE_WITH_RANDOM_64_CHARACTER_HEX
```

Use a private HTTPS origin matching the browser's exact origin. Next.js dev
supports `npm run dev -- --hostname 0.0.0.0 --experimental-https`;
the development certificate may need to be trusted locally. **Do not enter
BBS passwords into the HTTP page**: browser-to-Next.js traffic must be encrypted
even though the Next.js-to-Mystic hop is SSH.

On the Windows sandbox, copy
`integrations/mystic/browser_native_worker.py` to
`E:\\mystic\\themes\\default\\scripts\\mysticweb_worker.mpy`.
The existing sandbox after-login hook must call that worker for native SSH
sessions. A restart of the Next.js server is required after changing env vars.

## Current scope and limitations

- Browser login is enabled only when the explicit sandbox flag, endpoint,
  HTTPS origin, private SQLite path, and 32-byte rate key are all present.
- Mystic itself checks the username/password via native SSH. The post-login
  worker asserts the native identity only for sandbox fixture user ID 2.
- Session cookies are secure, HttpOnly and SameSite Strict. Login is rate limited.
- **Message reading remains unavailable.** Native account revalidation and
  per-area ACS authorization have not been verified and remain fail-closed.
- The direct SSH worker's request/reply protocol has not yet been validated
  end-to-end on the Windows sandbox. The login may still fail until this is
  confirmed. Do not treat the form appearing as proof of successful login.
- This setup must never be pointed at davesbbs.com or the production D: drive.
