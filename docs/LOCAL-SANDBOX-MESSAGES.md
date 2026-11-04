# Local sandbox message preview

This is an **operator-approved read-only preview**, not Mystic ACS authorization.
It is available only when `NODE_ENV=development` and the existing
`sandboxOriginAllowed` loopback policy passes. Production continues to deny
message access until a native ACS driver is implemented.

Add these entries to your existing `.env.local` (keep its other settings):

```dotenv
MYSTIC_DATA_ROOT=C:\MysticSandbox
MYSTICWEB_SANDBOX_JAM_ROOT=C:\MysticSandbox\msgs
MYSTICWEB_SANDBOX_READ_AREAS=23
```

`23` is the previously inspected **antiques** message area. Only add further
area IDs after verifying that each is a public echo area that you explicitly
approve for **all users who can sign in to this local preview**. This preview
does not evaluate Mystic's native ACS; do not add restricted or private areas.

If area 23's configured JAM base is in another directory, set the JAM root to
the directory containing its `.jhr`, `.jdx`, and `.jdt` files. This
preview currently uses one common JAM directory.

Restart `npm run dev` after changing `.env.local`, sign in again, and visit
`http://localhost:3000/messages`. The left pane should list only the
explicitly approved area(s). If no areas appear, run
`npm run mystic:validate` and confirm that the chosen area has an
unambiguous configured group and a valid JAM base.

The native authorization driver, per-area JAM paths, and performance-safe
authorization for all 406 areas remain future integration tasks.
