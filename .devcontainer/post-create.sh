#!/usr/bin/env bash
set -euo pipefail

PNPM_VERSION="12.15.0"
PLAYWRIGHT_CACHE_DIR="/home/node/.cache/ms-playwright"

echo "==> Setting up pnpm ${PNPM_VERSION} (corepack-first, npm fallback)"
if sudo corepack enable pnpm && [ "$(pnpm --version)" = "${PNPM_VERSION}" ]; then
  echo "==> pnpm ${PNPM_VERSION} ready via corepack"
else
  echo "==> Corepack path did not yield pnpm ${PNPM_VERSION}; installing via npm"
  sudo npm install --global "pnpm@${PNPM_VERSION}"
  echo "==> Verifying pnpm version after npm install"
  [ "$(pnpm --version)" = "${PNPM_VERSION}" ] \
    || { echo "==> ERROR: pnpm ${PNPM_VERSION} unavailable via both corepack and npm"; exit 1; }
  echo "==> pnpm ${PNPM_VERSION} ready via npm"
fi

echo "==> Ensuring Playwright browser cache directory exists (owned by node)"
sudo install -d -o node -g node -m 0755 "${PLAYWRIGHT_CACHE_DIR}"

echo "==> Installing workspace dependencies"
pnpm install --frozen-lockfile

echo "==> Installing Playwright chromium (with system dependencies)"
pnpm -C apps/web exec playwright install --with-deps chromium

echo "==> Wiring local git hooks (best-effort)"
echo "    $(git --version)"
if git rev-parse --git-dir >/dev/null 2>&1; then
  hooks_config="$(git rev-parse --show-toplevel)/gitconfig/hooks.config"
  if [ -n "$(git config --local --get-all include.path 2>/dev/null | grep -Fx "${hooks_config}" || true)" ]; then
    echo "==> include.path already wired; skipping"
  else
    git config --local include.path "${hooks_config}" \
      && echo "==> Wired include.path to ${hooks_config}" \
      || echo "==> WARNING: could not write include.path; hooks stay unwired (non-fatal)"
  fi
else
  echo "==> git work tree not usable; skipping hooks wiring"
fi
