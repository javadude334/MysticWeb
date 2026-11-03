# Private messaging preview

The `/messages` route currently renders a **non-operational preview**. No native messages are read, saved or sent.

## Design constraints
- Local private mail addresses a Mystic user alias; NetMail addresses an FTN node and recipient.
- AREAFIX commands are NetMail, not EchoMail posts.
- The NetMail base and originating FTN identity must come from Mystic configuration.
- EchoMail message groups can require real names rather than handles.
- The nodelist browser should consume Mystic's MUTIL-generated merged nodelist.
- Respect current-session Mystic identity, eligibility and message-base ACS.

## Required before enabling
1. Verify native browser authentication, account identity and revocation behavior.
2. Verify current-session per-base read/write permissions.
3. Verify safe native message reads, delivery, locking, encoding and read-pointer behavior.
4. Add inbox, sent, drafts, replies, recipient lookup and network selection backed by validated native services.
5. Test end-to-end with disposable sandbox accounts; do not send production mail.

The preview's Compose editor is client-side only. Send is disabled, and there is no local storage or draft persistence.
