# MysticMail

Unified private messaging for Mystic BBS and MysticWeb.

**Status: demonstration shell only.** No actual private mail, FTN NetMail, or Internet email is accessed or delivered. No native message bases are changed.

## Intended experience

- Mystic terminal: lightweight Mystic Python (MPY) application.
- MysticWeb: future shared mailbox interface.
- Local private mail, FTN NetMail, and Internet email (`user@davesbbs.com`) in one inbox.
- Public EchoMail remains in Mystic's existing reader.

## Test package

- `mystic/mysticmail.mpy`: Python-version diagnostic and sample terminal inbox.
- `SYSOP.DOC`: cautious installation and rollback instructions.
- `tests/test_demo.py`: Python 3 standalone smoke test.

The demonstration uses Python 2/3-compatible syntax to identify the interpreter Mystic actually loads. Python 3 is the preferred target for the eventual application, but support must be proven on each Mystic build.

**Do not hide your existing NetMail group or replace a production menu yet.**
