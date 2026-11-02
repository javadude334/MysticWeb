# Safe first-time local preview (development only)

This is **not** a production installation guide. It runs the current application locally so you can inspect its interface without intentionally configuring live Mystic data.

## Before you begin

1. Install a supported **Node.js 24** distribution for your operating system. Verify in a terminal with `node --version` and `npm --version`. Use the official Node.js website (https://nodejs.org/) for distributions.
2. Download or clone the project as explained in [GitHub basics](github-basics.md).
3. Open **PowerShell** on Windows or a **terminal** on Linux. Change into the extracted project folder (the folder containing `package.json`).
4. Do **not** copy your Mystic `users.dat`, private mail, or message bases into the project or a publicly served folder.

## Start a development preview

```text
npm ci
npm run dev
```

The first command downloads the dependencies described by the project's lockfile. The second starts the development web server. Follow the **local address printed in the terminal** (normally http://localhost:3000). Leave the terminal open while viewing the page; press **Ctrl+C** to stop it.

Do not forward the development port through your router or expose it to the Internet. The interface may show unfinished pages, and production authentication is not yet enabled.

## Check for code issues (optional)

```text
npm run mystic:diagnose
```

This runs type checks, automated tests, and Mystic configuration validation. Some validation may require a configured Mystic data path and can fail when no live integration is set up. It is not a guarantee that production messaging is ready.

**Next step:** Wait for a verified, documented production release before using the app for public caller logins. The advanced deployment reference is [here](../../deploy/README.md).
