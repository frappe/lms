#!/bin/bash
set -euo pipefail

BENCH_NAME="frappe-bench"
BENCH_PATH="$HOME/pilot/benches/$BENCH_NAME"
export PATH="$HOME/pilot/bin:$HOME/.local/bin:$PATH"

cleanup() {
  pilot -b "$BENCH_NAME" stop >/dev/null 2>&1 || true
}
trap cleanup EXIT

cd ~ || exit

echo "Setting Up Pilot..."

curl -fsSL "https://raw.githubusercontent.com/frappe/pilot/develop/install.sh" | sh -s -- --ci

# POT generation needs an app checkout, not a site or a database server.
pilot new "$BENCH_NAME" \
  --frappe-branch "${FRAPPE_BRANCH:-${BASE_BRANCH}}" \
  --database sqlite
pilot -b "$BENCH_NAME" init --skip-frontend --no-dev

echo "Get LMS..."
pilot get-app "$GITHUB_WORKSPACE" --branch "$BASE_BRANCH" --skip-assets

echo "Generating POT file..."
pilot frappe generate-pot-file --app lms

cd "$BENCH_PATH/apps/lms" || exit

echo "Configuring git user..."
git config user.email "developers@erpnext.com"
git config user.name "frappe-pr-bot"

echo "Setting the correct git remote..."
# Pilot leaves origin pointed at the local workspace. Push the generated branch
# to the canonical repository through a separate upstream remote.
git remote remove upstream 2>/dev/null || true
git remote add upstream https://github.com/frappe/lms.git

echo "Creating a new branch..."
isodate=$(date -u +"%Y-%m-%d")
branch_name="pot_${BASE_BRANCH}_${isodate}"
git checkout -b "${branch_name}"

echo "Commiting changes..."
git add lms/locale/main.pot
git commit -m "chore: update POT file"

gh auth setup-git
git push -u upstream "${branch_name}"

echo "Creating a PR..."
gh pr create --fill --base "${BASE_BRANCH}" --head "${branch_name}" -R frappe/lms
