#!/usr/bin/env bash
# Builds the latest master and publishes it atomically. Run on the server through the CI deploy key
# (forced command in authorized_keys), or by hand.
#
# Layout under DEPLOY_ROOT:
#   repo/                   git checkout of master; keeps node_modules/ and .cache/ (remote images, downloaded once) between deploys
#   releases/<date>-<sha>/  one built site per deploy
#   current                 symlink to the live release: the web server's document root
set -euo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/var/www/ecorenomax}"
BRANCH=master
KEEP_RELEASES=5

main() {
  local repo="$DEPLOY_ROOT/repo"
  local releases="$DEPLOY_ROOT/releases"

  for command_name in git node npm flock; do
    command -v "$command_name" >/dev/null || { echo "Missing command: $command_name" >&2; exit 1; }
  done

  # One deploy at a time
  exec 9>"$DEPLOY_ROOT/deploy.lock"
  flock --nonblock 9 || { echo "Another deploy is running" >&2; exit 1; }

  cd "$repo"
  git fetch --quiet origin "$BRANCH"
  git reset --quiet --hard "origin/$BRANCH"
  local commit
  commit=$(git rev-parse --short HEAD)
  echo "Deploying $commit"

  # --include=dev: Eleventy is a devDependency, installed even if NODE_ENV=production;
  # --engine-strict: fails if the server's Node doesn't satisfy "engines" in package.json
  npm ci --include=dev --engine-strict --no-audit --no-fund

  local release
  release="$releases/$(date +%Y%m%d-%H%M%S)-$commit"
  mkdir -p "$releases"
  # Run from repo/, so eleventy-img reuses the images already downloaded in .cache/.
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
