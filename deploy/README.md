# Ubuntu production deployment

This setup runs MysticWeb as a dedicated unprivileged systemd service on
127.0.0.1:3100. Nginx handles davesbbs.com, www.davesbbs.com, and HTTPS. Development remains in
~/projects/mysticweb; production releases live in /srv/mysticweb.

Installing these files is a separate, administrator-run step. The installer does
not start services, enable an nginx site, reload nginx, or request certificates.
Do not paste sudo passwords, GitHub tokens, or runtime secrets into chat or Git.

## What automatic deployment does

The timer checks every five minutes after the previous check finishes. It reads
the public GitHub API and selects the current main HEAD only when the latest
matching push run of frontend.yml completed successfully. PR checks, feature
branches, fork runs, older successful commits, and failed/pending main checks do
not authorize deployment. Both frontend and deployment-test jobs must pass.

It fetches that exact commit into a temporary release directory, runs npm ci and
npm run build using Node 24, then atomically replaces the current symlink and
restarts only mysticweb.service. A health check must report the exact revision.
Failed builds leave the running release untouched. Failed activation restores
the previous symlink and restarts the previous release; a failed first activation
stops the new service. Concurrent deploys are prevented with flock.

This is a single-instance restart, so expect a brief interruption during activation.
It is not a zero-downtime deployment. Prior releases are retained for recovery.
No live Mystic data directories are mounted or read by these scripts.

## 1. Merge and review

Merge the deployment PR and wait for the push-to-main Frontend checks workflow to
pass. In an Ubuntu terminal:

```bash
cd ~/projects/mysticweb
git status --short
git fetch origin
git switch main
git pull --ff-only
source ~/.nvm/nvm.sh
nvm use 24
less deploy/install.sh
less deploy/deploy.sh
less deploy/mysticweb.service
less deploy/mysticweb-deploy.service
less deploy/nginx.conf
```

Commit or stash unrelated work before switching branches.

Prerequisites: existing Ubuntu nginx, sudo, git, Python 3, util-linux (flock),
and the existing complete Node 24 nvm installation. For HTTPS, Certbot's nginx
plugin is required. No public SSH access or GitHub runner on Ubuntu is needed.
The server needs outbound HTTPS access to GitHub and the npm registry.

## 2. Install inactive assets (you run this with sudo)

```bash
cd ~/projects/mysticweb
source ~/.nvm/nvm.sh
nvm use 24
node_root="$(node -p 'require("path").dirname(require("path").dirname(process.execPath))')"
sudo bash deploy/install.sh --domain davesbbs.com --node-root "$node_root"
```

Enter your password only in your terminal. The installer:

- Creates the system account mysticweb with no login shell.
- Copies the existing Node 24 installation into root-owned /opt/mysticweb/node.
- Installs root-owned scripts under /usr/local/lib/mysticweb and systemd units.
- Prepares /etc/nginx/sites-available/davesbbs.com without enabling it.
- Creates /etc/mysticweb/deploy.env and a root-only runtime app.env.
- Grants the deployment account passwordless permission to restart or stop
  only mysticweb.service. The application service has NoNewPrivileges enabled;
  the deployment service needs that narrowly scoped sudo permission.

It refuses existing accounts, installation paths, and domain-specific nginx
files instead of overwriting them. It is an initial installer, not an upgrade
or uninstall tool. If installation is interrupted, inspect any created paths
before retrying. It does not change other nginx sites, certificates, DNS, router
forwarding, or the user's system Node installation.

Root-owned deployment scripts do not auto-update from application releases.
Review future deployment-script changes and install them deliberately.

## 3. Build and check the first production release

```bash
sudo systemctl start mysticweb-deploy.service
sudo journalctl -u mysticweb-deploy.service -n 100 --no-pager
curl -fsS http://127.0.0.1:3100/api/health
sudo systemctl status mysticweb.service --no-pager
```

The first command waits for dependency installation and build, which can take
several minutes on this VM. A successful health response contains status "ok"
and the deployed 40-character commit revision. If checks are pending, selection
skips deployment; wait for main CI to pass and run the deploy service again.

Do not continue if the service or health check fails. No nginx activation is
needed to inspect the loopback-only production service.

## 4. Activate the dedicated nginx site and HTTPS

Confirm both apex and www DNS records reach this Ubuntu machine, along with
inbound ports 80 and 443. A www CNAME pointing to davesbbs.com is one option.
Both hostnames serve the same public information page.

```bash
sudo ln -s /etc/nginx/sites-available/davesbbs.com /etc/nginx/sites-enabled/davesbbs.com
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d davesbbs.com -d www.davesbbs.com --redirect
sudo nginx -t
sudo certbot renew --dry-run
```

If nginx validation fails, do not reload. Inspect the error; unlink only the new
davesbbs.com symlink if necessary. Leave other sites intact. Check the existing
Certbot renewal timer before relying on unattended certificate renewal.

Verify https://davesbbs.com/, https://www.davesbbs.com/, and
https://davesbbs.com/api/health from another network. Nginx forwards the original host/protocol/IP and disables buffering for
Next.js streaming. Proxy caching is disabled for future authenticated responses.
The app stays bound to loopback; port 3100 does not need a public firewall rule.

## 5. Enable startup and automatic deployment

After the local and HTTPS checks pass:

```bash
sudo systemctl enable mysticweb.service
sudo systemctl enable --now mysticweb-deploy.timer
systemctl list-timers mysticweb-deploy.timer
```

From then on: merge a PR, wait for main CI to pass, and allow roughly five
minutes plus build time for deployment. No GitHub webhook or inbound deploy
SSH connection is used.

## Public page and login

The public root page describes Dave's BBS and links to telnet://davesbbs.com
and /login. The HTTPS login page explicitly says web sign-in is not available
yet and contains no credential form. The original dashboard remains at
/dashboard as a disconnected interface preview. No live message data is loaded.

## Configuration, secrets, and authentication

### Private Windows gateway address

Use the existing server-side `/etc/mysticweb/app.env` for the gateway location;
there is no need for a separate properties file. The prepared settings are:

```dotenv
MYSTIC_GATEWAY_INSTANCE=mystic-sandbox
MYSTIC_GATEWAY_URL=https://192.168.150.58:8744/v1/native
MYSTIC_GATEWAY_CA_FILE=/etc/mysticweb/gateway/ca.pem
MYSTIC_GATEWAY_CERT_FILE=/etc/mysticweb/gateway/ubuntu-client.pem
MYSTIC_GATEWAY_KEY_FILE=/etc/mysticweb/gateway/ubuntu-client.key
```

The Windows host is `192.168.150.58`; Ubuntu is `192.168.150.66`. Port 8744 is the
proposed private mTLS gateway port, separate from native SSH port 8022. The Windows
gateway will connect to `127.0.0.1:8022` on Windows. Ubuntu must use the Windows
LAN address, not its own localhost. See `gateway-client.example.env` and the
planned Windows settings in `gateway-windows.example.env`.

`configuredGateway()` reads these variables and validates bounded certificate
files, CA/client roles and the client key pair before constructing an unconnected
transport. Missing configuration stays disconnected; partial/invalid settings
deny. A changed address must match the server certificate's IP/DNS subjectAltName.
Never use NEXT_PUBLIC_ settings or put BBS passwords in an environment file.

The service user must be able to read its key: use root ownership, the dedicated
`mysticweb` group, mode 0640 for the key and no group/other write permissions.
Windows equivalents require administrator-managed ACLs. Settings take effect on
service restart when the reviewed composition consumes them. Merely supplying
these variables does not enable authentication or install the unfinished gateway.
Switching to D:\mystic remains a separate reviewed production transition.

Deployment settings are in /etc/mysticweb/deploy.env. Runtime secrets belong
in /etc/mysticweb/app.env (systemd KEY=value syntax, root-owned mode 0600).
The build process does not receive app.env. Never use NEXT_PUBLIC_ for secrets.
Do not rotate authentication/session secrets on every release. Keep databases
and durable application state outside the release directories.

This deployment does not implement Mystic authentication. Do not expose real
messages or private resources until server-side authentication and authorization
are implemented. HTTPS is required before enabling credential entry and secure
session cookies.

The public API normally needs no token, at about 24 requests per hour at the
default polling interval. If GitHub rate-limits the server's shared public IP,
an administrator may create /etc/mysticweb/github.env (root mode 0600) with a
fine-grained GITHUB_TOKEN limited to this repository's Actions read and Contents
read. The deployment unit already loads that optional file. Do not give it write
permissions. API failure/rate limiting keeps the current release running.

## Operations and recovery

```bash
sudo journalctl -u mysticweb.service -u mysticweb-deploy.service -n 100 --no-pager
sudo systemctl start mysticweb-deploy.service
sudo systemctl stop mysticweb-deploy.timer
```

Stopping the timer prevents future checks; an already-running deploy service must
finish or be stopped separately. On activation failure the deploy service exits
nonzero, even when rollback succeeds, so the failed deployment is visible in logs.

A release that built but failed activation is retained at releases/<sha>.
The script refuses to reuse it automatically. Stop the timer, fix the cause,
and inspect or move that failed directory aside before retrying the same commit.
A new fixed main commit gets a new release directory normally.

For an administrative rollback, stop the timer, select a known-good directory
under /srv/mysticweb/releases from prior logs, atomically repoint current to that
releases/<sha>, and restart mysticweb.service. Confirm /api/health reports that
revision before resuming traffic. Fix main before resuming automatic deployment.

Monitor disk usage: retained releases include node_modules and build output.
Archive/remove only confirmed inactive releases; preserve current and at least
one known-good rollback release. Node runtime upgrades and deployment-script
upgrades need administrator review; they are not performed by the timer.

## Test without installing or activating anything

Run from the repository on Ubuntu:

```bash
for script in deploy/*.sh; do bash -n "$script"; done
python3 -m unittest discover -s deploy/tests -v
source ~/.nvm/nvm.sh
nvm use 24
npm run lint
npm run build
python3 deploy/tests/smoke_built_app.py
```

Tests use temporary directories, a loopback-only test HTTP server, and mock Git,
npm, and service commands. They never invoke sudo or touch production paths.
