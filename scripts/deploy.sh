#!/usr/bin/env bash
# Age of Blocks — one-shot production deploy. Run ON the DigitalOcean droplet:
#
#   bash /var/www/age-of-blocks/scripts/deploy.sh
#
# It pulls the latest main, reinstalls deps, rebuilds the client bundle into
# dist/ (served by nginx) and restarts the authoritative match server (pm2).
# Override paths via env if your layout differs:
#   AOB_REPO=/path/to/repo  AOB_PM2_APP=age-of-blocks  bash deploy.sh
set -euo pipefail

REPO="${AOB_REPO:-/var/www/age-of-blocks}"
PM2_APP="${AOB_PM2_APP:-age-of-blocks}"
BRANCH="${AOB_BRANCH:-main}"

echo "▶ Age of Blocks deploy — repo: $REPO  branch: $BRANCH"
cd "$REPO"

echo "▶ Fetching latest $BRANCH…"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "▶ Installing dependencies (incl. dev — vite/tsx are needed)…"
npm ci --include=dev

echo "▶ Building client → dist/…"
npm run build

echo "▶ Restarting match server (pm2: $PM2_APP)…"
if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP" --update-env
else
  pm2 start npm --name "$PM2_APP" -- run server
fi
pm2 save >/dev/null

# Static files are served straight from dist/, so a reload isn't strictly
# required — but it's cheap and clears any cached config. Non-fatal if nginx
# isn't present.
if command -v nginx >/dev/null 2>&1; then
  echo "▶ Reloading nginx…"
  nginx -t && systemctl reload nginx
fi

echo "✅ Deploy complete — https://ageofblocks.games"
