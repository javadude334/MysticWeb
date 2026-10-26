#!/usr/bin/env bash
# Runs as the unprivileged mysticweb account, never as root.
set -euo pipefail
umask 027
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
DEPLOY_ROOT=${DEPLOY_ROOT:-/srv/mysticweb}
REPOSITORY=${REPOSITORY:-javadude334/MysticWeb}
export REPOSITORY
[[ "$DEPLOY_ROOT" = /* && "$DEPLOY_ROOT" != / ]] || { echo "Invalid deployment directory" >&2; exit 1; }
[[ "$REPOSITORY" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || exit 1
[[ -d "$DEPLOY_ROOT/releases" ]] || { echo "Run the installer first" >&2; exit 1; }
exec 9>"$DEPLOY_ROOT/deploy.lock"
flock -n 9 || { echo "Another deployment is running; skipping."; exit 0; }

sha=$(python3 "$SCRIPT_DIR/select_release.py")
# Optional read-only API credentials are not needed by dependency/build scripts.
unset GITHUB_TOKEN
[[ -n "$sha" ]] || exit 0
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid selected SHA" >&2; exit 1; }
previous=""
if [[ -L "$DEPLOY_ROOT/current" ]]; then
    previous=$(readlink "$DEPLOY_ROOT/current")
    [[ "$previous" =~ ^releases/[0-9a-f]{40}$ ]] || { echo "Unexpected current symlink; refusing to replace it" >&2; exit 1; }
elif [[ -e "$DEPLOY_ROOT/current" ]]; then
    echo "current must be a managed symlink" >&2
    exit 1
fi
health_url="http://127.0.0.1:3100/api/health"
if [[ "$previous" = "releases/$sha" ]]; then
    # Same revision still needs a health check, so a stopped service is detected.
    if ! python3 "$SCRIPT_DIR/healthcheck.py" "$health_url" "$sha"; then
        sudo -n /usr/bin/systemctl restart mysticweb.service
        python3 "$SCRIPT_DIR/healthcheck.py" "$health_url" "$sha"
    fi
    echo "Already running healthy revision $sha."
    exit 0
fi

staging=""
temporary_link="$DEPLOY_ROOT/.current-$"
activation_pending=0
cleanup() {
    status=$?
    if (( activation_pending )); then
        echo "Restoring the previous release." >&2
        set +e
        rollback
        set -e
    fi
    rm -f -- "$temporary_link"
    if [[ -n "$staging" && "$staging" = "$DEPLOY_ROOT/releases/.build-"* ]]; then
        rm -rf -- "$staging"
    fi
    return "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
release="$DEPLOY_ROOT/releases/$sha"
if [[ -e "$release" ]]; then
    # Do not reuse a release whose build or prior activation might have failed.
    echo "Release $sha already exists but is not current. Inspect it before retrying." >&2
    exit 1
fi
staging=$(mktemp -d "$DEPLOY_ROOT/releases/.build-XXXXXXXX")
git -C "$staging" init -q
git -C "$staging" remote add origin "https://github.com/$REPOSITORY.git"
GIT_TERMINAL_PROMPT=0 git -C "$staging" fetch --depth=1 origin "$sha"
git -C "$staging" checkout --detach FETCH_HEAD
[[ $(git -C "$staging" rev-parse HEAD) = "$sha" ]] || exit 1
(
    cd "$staging"
    npm ci --include=dev --no-audit --no-fund
    npm run build
)
[[ -f "$staging/.next/BUILD_ID" ]] || { echo "Build output is missing" >&2; exit 1; }
printf '%s\n' "$sha" > "$staging/.release-sha"
mv -- "$staging" "$release"
staging=""

activate() {
    rm -f -- "$temporary_link" &&
        ln -s -- "$1" "$temporary_link" &&
        mv -Tf -- "$temporary_link" "$DEPLOY_ROOT/current"
}
rollback() {
    if [[ -n "$previous" ]]; then
        activate "$previous"
        sudo -n /usr/bin/systemctl restart mysticweb.service
        python3 "$SCRIPT_DIR/healthcheck.py" "$health_url" "${previous#releases/}" ||
            echo "Rollback health check failed; inspect the service immediately." >&2
    else
        rm -f -- "$DEPLOY_ROOT/current"
        sudo -n /usr/bin/systemctl stop mysticweb.service
    fi
}
activation_pending=1
activate "releases/$sha"
if sudo -n /usr/bin/systemctl restart mysticweb.service &&
   python3 "$SCRIPT_DIR/healthcheck.py" "$health_url" "$sha"; then
    activation_pending=0
    echo "Activated healthy revision $sha."
    exit 0
fi
echo "Activation failed." >&2
exit 1
