#!/usr/bin/env bash
#
# LoungeLens — one-command public deploy to GitHub Pages.
#
# Everything is committed and ready. This script only does the part that REQUIRES
# your identity (creating a repo under YOUR account + pushing). It will prompt you
# to log in to GitHub in your browser the first time — that login is the one thing
# nobody else can do for you.
#
# Usage:   bash go-live.sh
#
set -euo pipefail
cd "$(dirname "$0")"

REPO_NAME="loungelens"

echo "==> Checking GitHub CLI..."
if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) isn't installed."
  echo "Install it:  brew install gh      (then re-run: bash go-live.sh)"
  echo "Or use the no-install route: drag this folder onto https://app.netlify.com/drop"
  exit 1
fi

echo "==> Checking GitHub login..."
if ! gh auth status >/dev/null 2>&1; then
  echo "You're not logged in. Opening GitHub login (browser)..."
  gh auth login
fi

GH_USER="$(gh api user --jq .login)"
echo "==> Logged in as: $GH_USER"

echo "==> Making sure the build is fresh..."
python3 build-singlefile.py

git add -A
git commit -q -m "deploy: refresh build" || echo "   (nothing new to commit)"

echo "==> Creating public repo + pushing (idempotent)..."
if gh repo view "$GH_USER/$REPO_NAME" >/dev/null 2>&1; then
  echo "   repo exists, pushing latest..."
  git push -u origin HEAD:main 2>/dev/null || git push origin HEAD:main
else
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
fi

echo "==> Enabling GitHub Pages on main / root..."
gh api -X POST "repos/$GH_USER/$REPO_NAME/pages" \
  -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 \
  || gh api -X PUT "repos/$GH_USER/$REPO_NAME/pages" \
       -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 \
  || echo "   (Pages may already be enabled — check Settings > Pages)"

URL="https://$GH_USER.github.io/$REPO_NAME/"
echo ""
echo "============================================================"
echo " DONE. Your app is going live (build takes ~1-2 min):"
echo "   $URL"
echo " Single-file version to share directly: dist/loungelens.html"
echo "============================================================"
