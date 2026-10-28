# A48 native driver feasibility — October 27, 2026

Status: investigation only. No native driver, listener, production configuration
or BBS record was installed or modified. PR #12 owns this integration assessment;
PR #11 owns the native probes. Neither PR is merged by this work.

## Evidence and limits

Read-only inspection used the installed E: clean-install documentation, not the
production D: VM. Source locations below are relative to `E:/mystic` and are not
claims that the local instance and VM have identical runtime behavior.

| Source | Established by documentation/example | Still requires runtime proof |
| --- | --- | --- |
| `docs/whatsnew.txt:3126` | MPL CheckPW checks the currently loaded User variables | Loading another record safely, actual effective ACS context, restoration on every exit |
| `docs/whatsnew.txt:5264` | Python isuserpw accepts user password data and a candidate; example uses getuser(0) | A48 Python invocation, exact selected-record binding and rejection matrix |
| `themes/default/scripts/testpython.mpy:17` and `:29` | getuser(0) is the signed-in user; sample enumerates nonzero indices until None | Physical index versus permanent ID, no missing-record fallback, side effects |
| `docs/whatsnew.txt:4949` | MPL FindUser returns physical record location, not permanent ID | Alias/case/ambiguity rules and correct stable identity mapping |
| `docs/whatsnew.txt:3832` | -AUTH accepts username/password arguments and prints a Boolean | No safe credential input alternative established; Boolean alone is insufficient |
| `docs/mystic.txt:180`, `:190`; `docs/whatsnew.txt:1058`, `:4395` | -U/-P with -X (MPL), -Y (Python 2), -Z (Python 3) launch scripts as a user | No documented password-on-private-pipe alternative established |

The bundled `docs/python.txt` explicitly mixes implemented functions and planned
API entries; presence in a planned list is not evidence of an implemented function.
Nonzero getuser enumeration is a useful candidate for explicit record lookup;
it does not imply that access(acs) evaluates for that returned dictionary.
Loading a dictionary or changing User variables is not proof of switching every
native group, area, security and session context. Never use saveuser/SetPW or
modify a user record to impersonate a browser user.

Public primary references checked alongside local files:
[command-line options](https://wiki.mysticbbs.com/doku.php?id=introduction),
[versioned changelog](https://wiki.mysticbbs.com/doku.php?id=whats_new_112), and
[Python examples](https://wiki.mysticbbs.com/doku.php?id=python_examples).
The wiki can change after A48; installed documentation narrows the evidence to
this installation, while only a controlled native run can certify behavior.

The operator's positive/negative MPL checks establish current-loaded-user password
checking only. Python function presence is not Python password verification.
The separately reported users.dat observations (1536-byte record, password
structure at zero-based offset 8 length 101, handle at 109) are layout evidence,
not a verifier. Exact PBKDF2 representation remains unresolved. No raw record,
hash, salt, derived key or credential is copied into this repository. A direct
file verifier is not implemented or inferred from historical Pascal layouts.

## Secure invocation decision

Do not launch -AUTH/-U/-P: process arguments violate the credential boundary even
inside SSH. Do not substitute environment variables, temporary request files,
terminal transcripts or command strings. No credential-free unattended launch
was established by these sources. No launch was attempted during this review.

An existing authenticated native session with a private bounded channel remains
an investigation candidate, not a deployable design. It must independently bind
each request to the resolved permanent ID and verify current state and permissions
in that identity's complete native context. The mTLS web client and dispatcher
do not supply that context. A modern TLS endpoint would also need a secured local
worker channel, explicit caller authentication, deadlines/cancellation and no
request-body/exception-local capture. A session-link flow avoids forwarding BBS
passwords but still needs current-state and per-area authorization; it is not a
shortcut around those blockers.

The dispatcher now checks account state before invoking password verification,
re-resolves the name afterward to reject changed mapping, then rechecks current
account state. Two-user synthetic tests reject swapped passwords and missing
users. These checks reduce adapter mistakes but cannot detect a native adapter
that falsely reports verification for the wrong record. The driver remains absent.

## Next isolated runtime experiment

First finish the existing probe's pause/cleanup confirmation. The next new native
experiment requires two disposable ordinary accounts in a separate A48 test copy,
not the production BBS. No additional wrong-password run of the existing probe is
needed. Prepare/review an identity-only lookup probe before any password test:

1. Establish each account's physical slot and permanent ID independently, including
   a fixture where slot and ID differ. While signed in as A, retrieve B's explicit
   record and a known missing slot without saving anything. Emit only named
   PASS/FAIL assertions for correct binding, missing-record denial and unchanged
   session identity; never serialize the dictionaries or pwdata.
2. Once lookup is proved, use only native masked input inside the isolated runtime
   for A/A and B/B password checks, crossed A/B and B/A rejection, and unknown-user
   denial. Call isuserpw on the explicitly retrieved record, not getuser(0) as a
   fallback. Suppress exceptions and emit only PASS/FAIL. No captured input,
   transcript, password echo or secret-bearing failure message is permitted.
3. Verify that native ACS still uses the intended account, group and area on
   success, error and alternating A/B requests. If record retrieval does not
   provide a supported complete context mechanism, stop the remote-driver path
   rather than treating a password match as authorization.

Then test deleted/locked/expired/forced-change states, independent catalog mapping,
allowed/denied group/ListACS/ReadACS decisions, permission revocation and concurrent
users before designing a listener. Production composition remains null until
end-to-end staging evidence and a separate reviewed activation change exist.
