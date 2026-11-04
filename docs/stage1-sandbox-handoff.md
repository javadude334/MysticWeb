# Stage 1 sandbox handoff (uncertified)

Stage 1's read-only browser workflow is implemented for an explicitly
operator-approved sandbox preview. **Native ACS is not certified**; this
mode is not a replacement for full Mystic group membership, area-type and
visibility enforcement. Do not expose the development server publicly or
use the preview with unrestricted users or private bases.

## Configuration

Use the local Windows sandbox at `C:\MysticSandbox`, never the live
`D:\mystic` tree. Set the following environment values in the terminal
that starts `npm run dev` (or in a private local development env file):

- `MYSTIC_DATA_ROOT=C:\MysticSandbox`
- `MYSTICWEB_SANDBOX_JAM_ROOT=C:\MysticSandbox\msgs`
- `MYSTICWEB_SANDBOX_READ_AREAS=<comma-separated numeric area IDs>` —
  explicitly approve only public EchoMail areas that the sandbox test
  account is permitted to read. Never use an automatically generated
  allowlist of all areas.
- `MYSTICWEB_SESSION_DB=<absolute path to a private local SQLite file>`
- `MYSTICWEB_RATE_KEY=<64 hexadecimal characters from a cryptographic
  random generator>`

The local session database parent directory must already exist and
should not be shared. Never commit credentials, session keys or the
database. The development server only accepts its configured loopback
origin. Session cookies are Secure and require HTTPS-capable localhost
handling by the browser.

## Operator acceptance check

1. Run `npm run typecheck`, `npm test`, `npm run build`,
   `npm run mystic:validate`, `npm run mystic:jam:validate`, and
   `node scripts/audit-sandbox-paths.cjs`.
2. Run `npm run dev`, sign in using a dedicated sandbox Mystic account
   and visit `/messages`.
3. Confirm the group dropdown changes the visible area list without an
   extra button, then open an approved area, read a message, paginate and
   follow a reply link.
4. Confirm an area ID outside the allowlist returns no data, including
   when directly requesting `/api/messages?area=<id>`. Confirm a missing
   or invalid session cannot retrieve a catalog or a message.
5. Confirm the JAM root cannot be outside the sandbox and that the live
   BBS remains untouched.

## Outstanding certification

Before enabling production or treating this as effective native ACS,
decode and validate Mystic A48 user group membership, group Access/Hidden
and message-area type/visibility flags. Wire these to
`evaluateVerifiedReadAcs` and the local file provider, and prove
different accounts have different effective access. The production
provider continues to deny area authorization and
`productionAccess()` remains disabled. Posting/replies are Stage 2.
