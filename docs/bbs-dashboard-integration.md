# Staged BBS-style login and dashboard

This branch includes a browser login form at `/login` and an ANSI-inspired
dashboard at `/dashboard`.

## Current security boundary

- `/api/auth/login` still uses `productionAccess() === null` and responds
  unavailable. **Do not enter real credentials in this staged UI.**
- The form only redirects after the server returns a successful JSON response
  containing `ok: true`; it does not store passwords in local storage.
- The dashboard is currently a **public preview**, not a private member page.
  It displays no account data, bulletins, caller statistics, or private mail.
- Native area authorization and private-mail checks remain disabled.
- No live BBS data or terminal output is claimed. The welcome sequence is
  a visual concept, not an emulation of Mystic's prelogin scripts.

## Next integration work

1. Validate the native account policy and read-only permanent-ID rechecks.
2. Configure explicit sandbox-only auth composition and a protected session
   identity endpoint. Keep production paths out of sandbox configuration.
3. Guard member-only dashboard content server-side; don't use client redirects
   as access control.
4. Map native bulletin/statistics/private-mail sources and their permissions.
5. Review Mystic ACS group semantics, List EACS and message permissions before
   permitting JAM reads.
6. Verify login, logout, locked-account revocation, and rate limiting in browser.

Run `npm test` and `npm run build` after pulling. These changes were
committed remotely and have not been run in the user's Windows environment.
