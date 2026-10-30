#!/usr/bin/env bash
# Builds a commit of master and publishes it atomically. Run on the server through the CI deploy key
# (forced command in authorized_keys), or by hand: scripts/deploy.sh [commit]
# The commit (full or short SHA) is the first argument, or the command sent over ssh by CI ($SSH_ORIGINAL_COMMAND);
# without one, the latest master is deployed.
#
# Layout under DEPLOY_ROOT:
#   repo/                   git checkout of the deployed commit; keeps node_modules/ between deploys
#   releases/<date>-<sha>/  one built site per deploy
#   current                 symlink to the live release: the web server's document root
set -euo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/var/www/ecorenomax}"
BRANCH=master
KEEP_RELEASES=5

main() {
  local repo="$DEPLOY_ROOT/repo"
  local releases="$DEPLOY_ROOT/releases"
  local requested_commit="${1:-${SSH_ORIGINAL_COMMAND:-}}"

  # Also guards the forced command: anything but a SHA is refused before it reaches git
  if [[ -n "$requested_commit" && ! "$requested_commit" =~ ^[0-9a-f]{7,40}$ ]]; then
    echo "Not a commit SHA: $requested_commit" >&2
    exit 1
  fi

  for command_name in git node npm flock; do
    command -v "$command_name" >/dev/null || { echo "Missing command: $command_name" >&2; exit 1; }
  done

  # One deploy at a time
  exec 9>"$DEPLOY_ROOT/deploy.lock"
  flock --nonblock 9 || { echo "Another deploy is running" >&2; exit 1; }

  cd "$repo"
  git fetch --quiet origin "$BRANCH"
  local target="origin/$BRANCH"
  if [[ -n "$requested_commit" ]]; then
    # Only commits that are on master: a pushed and tested one, or an older one for a rollback
    git merge-base --is-ancestor "$requested_commit" "origin/$BRANCH" 2>/dev/null \
      || { echo "Commit $requested_commit is not on $BRANCH" >&2; exit 1; }
    target="$requested_commit"
  fi
  git reset --quiet --hard "$target"
  local commit
  commit=$(git rev-parse --short HEAD)
  echo "Deploying $commit"

  # --include=dev: Eleventy is a devDependency, installed even if NODE_ENV=production;
  # --engine-strict: fails if the server's Node doesn't satisfy "engines" in package.json
  npm ci --include=dev --engine-strict --no-audit --no-fund

  local release
  release="$releases/$(date +%Y%m%d-%H%M%S)-$commit"
  mkdir -p "$releases"
  # Remote images are committed in src/img/originals/remote/: the build never downloads them.
  # A failed build removes its half-written release; the live site is untouched.
  trap 'rm -rf "$release"' ERR
  npm run build -- --output="$release"
  trap - ERR

  # Renaming over the symlink is atomic, unlike ln -sfn which removes it first
  ln -sfn "$release" "$DEPLOY_ROOT/current.tmp"
  mv -T "$DEPLOY_ROOT/current.tmp" "$DEPLOY_ROOT/current"
  echo "Published $release"

  # Keeps the newest releases for a quick rollback (names sort by date, the live one is the newest)
  ls -1d "$releases"/*/ | head -n -"$KEEP_RELEASES" | xargs -r rm -rf
}

# On one line: bash has read it whole before git reset can rewrite this file
main "$@"; exit $?
