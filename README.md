# MysticWeb

**Bring your Mystic BBS to the web.**

MysticWeb is an open-source web front end for [Mystic BBS](https://www.mysticbbs.com/), designed to give callers a browser-based experience while retaining Mystic as the underlying BBS. It is being developed alongside Dave's BBS.

> **Development preview — not production-ready.** The `main` branch is not a finished, public-ready web BBS. Native Mystic login has been tested in development, but production integration, authorization, message posting and private mail still require validation. Do not expose development authentication or message endpoints to the internet.

## 👋 New SysOp? Start here

You don't need to be a web developer to read the guides.

1. **[Read the SysOp Getting Started Guide](docs/sysop/README.md)** — plain-language introduction and navigation.
2. **[What MysticWeb does](docs/sysop/overview.md)** — what it adds to Mystic and what stays in Mystic.
3. **[Download the source / GitHub basics](docs/sysop/github-basics.md)** — how to get the software without knowing Git.
4. **[Try a safe local preview](docs/sysop/first-test.md)** — test without changing your live BBS.
5. **[Troubleshooting](docs/sysop/troubleshooting.md)** — common setup questions.

**Installation guidance:** [Windows/Linux installation plans](docs/sysop/installation-plans.md). A general-purpose production installer is **not yet available**. Advanced Ubuntu administrators can consult the [nginx/systemd deployment reference](deploy/README.md), but should not enable unfinished production features.

## Features and status

| Area | Status |
| --- | --- |
| Public BBS homepage and connection information | Preview available |
| Dashboard and menu previews | Available without live account data |
| Native Mystic password verification | Tested in development; branch integration must be checked |
| Login and authenticated sessions | Development testing; production disabled on `main` |
| Reading message areas | Reader foundation exists; live web integration not complete |
| Message posting and private mail | In development |
| File areas, relay chat, and door games | Planned / previews |
| SysOp menus and scripting | [Documentation and examples](docs/sysop/scripting-reference.md) |

## SysOp customization

- [Menus and dashboards](docs/sysop/customizing-menus.md)
- [MysticWeb scripting reference](docs/sysop/scripting-reference.md)
- [API versus scripting commands](docs/sysop/apis-and-scripting.md)
- [Reusable menu actions](docs/sysop/menu-actions.md)

## Developers and contributors

For development on Ubuntu or Windows, deployment, authentication branch status, testing commands, and technical limitations, read the [detailed development notes](docs/development-status-2026-11.md).

Report bugs or request features through [GitHub Issues](https://github.com/javadude334/MysticWeb/issues). Include the MysticWeb revision, OS, and steps to reproduce. **Never upload passwords, session keys, Mystic user databases, or private messages.**

The current development site is associated with Dave's BBS; it is not a general public hosted MysticWeb service.
