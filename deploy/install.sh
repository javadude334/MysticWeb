#!/usr/bin/env bash
# Run manually with sudo after reviewing and merging this deployment PR.
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
domain=""
node_root=""
usage() {
    echo "Usage: sudo bash deploy/install.sh --domain davesbbs.com --node-root /home/javadude/.nvm/versions/node/v24.22.1"
    echo "Installs inactive deployment assets. Does not start services, enable a site, reload nginx, or request certificates."
}
while (( $# )); do
    case "$1" in
        --domain) domain=${2:?Missing domain}; shift 2 ;;
        --node-root) node_root=${2:?Missing Node installation}; shift 2 ;;
        --help|-h) usage; exit 0 ;;
        *) usage >&2; exit 1 ;;
    esac
done
[[ $EUID -eq 0 ]] || { echo "Run this installer with sudo." >&2; exit 1; }
[[ "$domain" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ && "$domain" = *.* && "$domain" != *..* ]] ||
    { echo "Provide a valid domain." >&2; exit 1; }
[[ "$node_root" = /* && -x "$node_root/bin/node" && -e "$node_root/bin/npm" ]] ||
    { echo "Provide the absolute root of the existing Node 24 installation." >&2; exit 1; }
[[ $("$node_root/bin/node" -p 'process.versions.node.split(".")[0]') = 24 ]] ||
    { echo "Node 24 is required." >&2; exit 1; }
for command in git python3 flock sudo visudo systemctl nginx install useradd getent; do
    command -v "$command" >/dev/null || { echo "Missing prerequisite: $command" >&2; exit 1; }
done
[[ -d /etc/nginx/sites-available && -d /etc/nginx/sites-enabled ]] || exit 1
# Never overwrite an existing installation or unrelated nginx site.
for target in /etc/mysticweb /srv/mysticweb /opt/mysticweb /usr/local/lib/mysticweb /etc/sudoers.d/mysticweb-deploy /etc/systemd/system/mysticweb.service /etc/systemd/system/mysticweb-deploy.service /etc/systemd/system/mysticweb-deploy.timer "/etc/nginx/sites-available/$domain" "/etc/nginx/sites-enabled/$domain"; do
    [[ ! -e "$target" && ! -L "$target" ]] || { echo "Existing path requires review: $target. Nothing installed." >&2; exit 1; }
done
if getent passwd mysticweb >/dev/null; then
    echo "The mysticweb account already exists; review it before installation." >&2
    exit 1
fi
# Validate source assets and sudo rule before making system changes.
for file in deploy.sh start.sh select_release.py healthcheck.py mysticweb.service mysticweb-deploy.service mysticweb-deploy.timer nginx.conf; do
    [[ -f "$SCRIPT_DIR/$file" ]] || exit 1
done
bash -n "$SCRIPT_DIR/deploy.sh"
bash -n "$SCRIPT_DIR/start.sh"
temporary=$(mktemp -d)
trap 'rm -rf -- "$temporary"' EXIT
printf '%s\n' 'mysticweb ALL=(root) NOPASSWD: /usr/bin/systemctl restart mysticweb.service, /usr/bin/systemctl stop mysticweb.service' > "$temporary/sudoers"
visudo -cf "$temporary/sudoers"
sed "s/__DOMAIN__/$domain/g" "$SCRIPT_DIR/nginx.conf" > "$temporary/nginx.conf"

useradd --system --user-group --home-dir /srv/mysticweb --shell /usr/sbin/nologin mysticweb
install -d -o root -g root -m 0755 /opt/mysticweb /opt/mysticweb/node /usr/local/lib/mysticweb
cp -a "$node_root/." /opt/mysticweb/node/
chown -R root:root /opt/mysticweb/node
chmod -R go-w /opt/mysticweb/node
install -d -o mysticweb -g mysticweb -m 0750 /srv/mysticweb /srv/mysticweb/releases
install -d -o root -g root -m 0755 /etc/mysticweb
install -o root -g root -m 0755 "$SCRIPT_DIR/deploy.sh" "$SCRIPT_DIR/start.sh" "$SCRIPT_DIR/select_release.py" "$SCRIPT_DIR/healthcheck.py" /usr/local/lib/mysticweb/
install -o root -g root -m 0644 "$SCRIPT_DIR/mysticweb.service" "$SCRIPT_DIR/mysticweb-deploy.service" "$SCRIPT_DIR/mysticweb-deploy.timer" /etc/systemd/system/
install -o root -g root -m 0440 "$temporary/sudoers" /etc/sudoers.d/mysticweb-deploy
install -o root -g root -m 0644 "$temporary/nginx.conf" "/etc/nginx/sites-available/$domain"
printf '%s\n' 'REPOSITORY=javadude334/MysticWeb' 'BRANCH=main' 'WORKFLOW=frontend.yml' 'DEPLOY_ROOT=/srv/mysticweb' > /etc/mysticweb/deploy.env
chmod 0644 /etc/mysticweb/deploy.env
printf '%s\n' '# Runtime-only secrets go here. Do not commit them to Git.' > /etc/mysticweb/app.env
chmod 0600 /etc/mysticweb/app.env
systemctl daemon-reload
echo "Installed inactive assets. Follow deploy/README.md to deploy, validate, enable nginx/HTTPS, and start the timer."
echo "No service was started and no nginx site was enabled or reloaded."
