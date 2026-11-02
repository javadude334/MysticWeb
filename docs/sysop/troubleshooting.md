# MysticWeb — Common terms and troubleshooting

| Term | Meaning |
| --- | --- |
| **SysOp** | The person operating the BBS |
| **Node.js** | Software that runs MysticWeb's server application |
| **npm** | The tool that installs required packages and runs project commands |
| **GitHub** | Website hosting the source code and updates |
| **Terminal / PowerShell** | A window where you type commands |
| **Port** | A numbered network connection; development commonly uses 3000 |
| **HTTPS** | Encrypted browser connection needed for a public site |
| **JAM** | One of the message-base formats used by BBS software |

## Common problems

- **`node` or `npm` not recognized:** Node.js is not installed or the terminal has not picked up its PATH setting. Reopen the terminal after installation.
- **`npm ci` fails:** Check that you are in the folder containing `package.json` and `package-lock.json`, then check the Node.js version and the complete error. Avoid running arbitrary fix commands from strangers.
- **Port already in use:** Another program may be using the development port. Stop the other development server; do not disable your firewall.
- **Login or message reading unavailable:** These are unfinished/disabled production integrations, not necessarily a mistake in your installation.
- **Permission denied:** Check which account owns the files. Do not solve this by making Mystic data or session secrets world-readable.

When asking for help, include operating system, Node.js version, command, and sanitized error. **Never share passwords, session cookies, secret keys, private messages, or user databases.**
