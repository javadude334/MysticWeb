# Getting MysticWeb without knowing GitHub

**GitHub** is a website where project files and updates are stored. You do **not** need a GitHub account just to view or download a public repository.

Project page: https://github.com/javadude334/MysticWeb

## Two ways to get files

**Simple download:** Open the project page, select **Code**, then **Download ZIP**. Extract the ZIP into a new folder. This is suitable for looking at files or trying a development preview, but downloading another ZIP later does **not** automatically update your existing installation.

**Using Git (optional):** Git is a tool that can download and update a project. For a new checkout:

```text
git clone https://github.com/javadude334/MysticWeb.git
```

To update a clean checkout on its main branch:

```text
git pull --ff-only origin main
```

If Git reports local changes, **stop and back them up** rather than forcing an update. Do not overwrite configuration or private data.

## What is Node.js?

Node.js runs the server-side JavaScript application. **npm** is the package manager installed with Node.js; it downloads the project's dependencies and runs commands such as `npm run dev`. The current MysticWeb development project uses **Node.js 24**.

## Where to ask questions

Use the repository's Issues tab **if enabled**, or the project support channel when one is published. Describe your operating system, the command you ran, and the error message. Remove passwords, tokens, local private paths, and BBS user data before sharing logs.
