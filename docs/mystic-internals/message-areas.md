# Message groups and areas

Sandbox diagnostics: 5 groups, 406 areas; 405 strict structural candidates and exceptional area #1. Level-20 candidate counts by group: 3, 1, 72, 209, 119 (404 total). These counts do not prove access control.

`src/lib/mystic/config.ts` parses `groups_g.dat` (206-byte records) and `mbases.dat` (768-byte records). Group Access/Hidden and message-area kind/hidden flags are not fully decoded. Research their offsets in ELF and verify in sandbox. Production must use verified per-area JAM paths and exclude private/NetMail/unknown types from public reader.
