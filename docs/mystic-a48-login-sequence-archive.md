# Mystic A48 login and prelogin sequence — archive findings

## Provenance and limits

Examined the user-provided sandbox archive `mystic.zip`, especially
`mystic/themes/default/menus/prelogin.mnu`,
`mystic/themes/default/menus/main.mnu`, and
`mystic/themes/default/text/{bulletin,bullet1,bullet2,mainhdr}.asc`.
These are the actual archived default-theme files, **not** a recorded
interactive login trace. The separate Linux 32-bit Mystic ELF executable
is a program binary, not an installation configuration; it cannot by itself
establish the user's customized prelogin sequence. The binary `.mnu`
format contains fields whose meanings need confirmation in the Mystic
menu-command reference before they are treated as executable semantics.

## Observed prelogin menu

The `prelogin.mnu` record includes:

- Menu description: `Default Login sequence menu`
- Menu ACS string: `s10`
- Header label: `Menu Header`
- First-command marker: `FIRSTCMD`
- Embedded comment: `Can replace MC (check email) with a personalscan-like menu if you want a global new personal message scan instead of just e-mail`
- Extracted command/data strings, in file order:
  1. `!OI`
  2. `0;|&1 has logged into node |&2.`
  3. `bulletin bulletin bullet check`
  4. `/scan`
  5. `main`

**Interpretation requiring menu-format confirmation:** this appears to
perform an on-login notification, invoke the bulletin script/check,
run a scan, and transition to the `main` menu. The embedded comment
confirms the intended mail-check context, but exact command opcode
mapping and the timing of the private-mail check are not yet verified.
Do not treat these strings as a complete transcript.

## Bulletin content and menu

The archive contains the display files:

- `text/bulletin.asc`: ANSI/Mystic-pipe-colored bulletin menu, offering
  `1` Welcome To Mystic BBS Software, `2` About This Bulletin Menu,
  and `Q` Quit to Main Menu.
- `text/bullet1.asc`: introductory welcome and overview of Mystic BBS.
- `text/bullet2.asc`: describes the bulletin program and its
  `BULLETIN.MPS` script, including multiple bulletin menus and new scanning.

These are default sample bulletins, **not evidence of the user's current
custom bulletins**.

## Main menu

The archived `main.mnu` includes a `|DFmainhdr` display directive,
a command prompt, and menu entries including:

- Account Settings (A) → `account`
- Message Menu (M) → `message`
- File Areas (F) → `file`
- Door Games (D) → `doors`
- System Bulletins (S) → `bulletin bulletin bullet`
- Comment to SysOp (C) → `/to:sysop`
- Last 10 Callers (L), One Liners (O), Voting Booth (V),
  User Listing (U), BBS Listing (B), Page SysOp (P), Time Bank (T),
  Usage Graph (@), Demos (!), Goodbye (G)
- Node chat and online-user actions; SysOp menu gated by `s255`.

The `mainhdr.asc` text file provides the menu's display header.
Some entries are only labels in this inventory; command opcode
interpretation requires parsing the binary menu records.

## Proposed web sequence derived from archive

1. **Native login:** handle/password verification; status restrictions.
   The archive does not establish the exact native credential prompt sequence.
2. **Login notification:** represented by observed `!OI` and
   `0;|&1 has logged into node |&2.` strings (mapping unverified).
3. **Bulletins:** display bulletin selection/content from the archived
   text files, with Mystic pipe-color formatting translated to web.
4. **Mail/new-message scan:** the prelogin comment references `MC`
   (check email) and the menu includes `/scan`; the exact operation
   and order must be confirmed.
5. **Main menu:** render `mainhdr.asc` and the archived menu choices.

**Not supported by the inspected prelogin file:** an explicit separate
statistics screen. Statistics may originate elsewhere in Mystic
prompts, menus, scripts, or text files. Keep it optional until traced.

## Implementation guidance

- Prefer a declarative screen sequence loaded from validated local
  theme/menu files, not a hard-coded claim that every BBS runs these steps.
- Treat pipe codes (`|xx`) and CP437 ANSI art as display syntax;
  escape HTML and whitelist supported formatting codes.
- Keep mail counts account-scoped and unavailable until authorized.
- Do not execute arbitrary menu command strings on the web server.
- Confirm actual behavior with a recorded sandbox Telnet login and
  Mystic menu-command documentation before claiming exact parity.
