# November 2 integration test branch

This branch starts from the **current main branch** and collects additive outstanding testing assets without replacing newer mainline application code with older PR snapshots.

## Included here
- MysticMail MPY synthetic terminal demo, interpreter diagnostic, SYSOP.DOC, and standalone tests (from PR #27).
- Private messaging/NetMail design plan (from PR #25). **The PR #25 preview page was not copied over the newer mainline message workspace.**
- Historical development status document (from PR #26). **The older PR #26 README was not substituted for the newer main README.**

## Existing application code
The current mainline remains the base for authentication, native gateway, web messages, sysop menus, and other recent features. Earlier PRs #11, #15–#22 are older branch histories and may contain overlapping or superseded code; they have **not** been mechanically merged or declared complete. Review any unique outstanding changes separately before closing those PRs.

## Safe local checks
```powershell
git fetch origin
git switch integration/mysticweb-nov2-testing
npm ci
npm run typecheck
npm test
npm run build
cd mysticmail
py -3 -m unittest discover -s tests -v
py -3 mystic/mysticmail.mpy
```

Mystic's MPY invocation and embedded Python 3 configuration still require operator verification on the actual Mystic installation. No production login flag should be enabled on the basis of this branch alone. Do not modify the real NetMail group, live message bases, or Mailgun settings for the demo.

## Acceptance
1. Existing Next.js checks pass.
2. Demo runs under standalone Python 3.
3. Sysop verifies embedded Python version and terminal behavior inside Mystic.
4. Existing public EchoMail and NetMail remain unchanged.
5. Any authentication changes receive separate two-account and authorization testing before enabling live use.
