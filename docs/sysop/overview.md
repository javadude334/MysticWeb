# What is MysticWeb?

MysticWeb is a developing browser-based interface for an existing Mystic BBS. The goal is to let callers use a modern web interface for BBS features while keeping Mystic as the source of user accounts and BBS data.

**MysticWeb does not replace your Mystic installation.** Your existing terminal callers should continue using Mystic. A future door-games feature is intended to connect to the separate BBSDoorServer project.

## What you will eventually need

- A working Mystic BBS installation.
- A computer/server capable of running a supported Node.js version.
- A network connection between MysticWeb and the Mystic data/services it is authorized to access.
- A domain and HTTPS if you choose to offer the web interface publicly.

**Not yet supported as a turnkey workflow:** a production-ready installer, automatic connection to any Mystic configuration, unrestricted message reading/writing, and live private mail. A successful development login does not mean all account permissions are verified.

## Safety first

Use a separate test environment before touching a live installation. Back up Mystic configuration, user data, message bases, and other important files. Do not copy private Mystic data into a public website directory. Only enable public access after the documented production authentication and authorization checks are complete.
