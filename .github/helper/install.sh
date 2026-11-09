#!/bin/bash

# Provision a bench for backend-only CI: framework + payments, no frontend
# assets, external MariaDB. Fresh provision every run; nothing is cached.
# The app under test (lms) is installed per-run afterwards, so every run
# tests fresh PR code.
#
# Expects from the caller: FRAPPE_BRANCH, SITE, SITE_CONFIG (JSON object
# merged into the new site's site_config.json).

set -eo pipefail

FRAPPE_BRANCH="${FRAPPE_BRANCH:-develop}"
SITE="${SITE:-frappe.local}"
SITE_CONFIG="${SITE_CONFIG:-{}}"
BENCH_NAME="frappe-bench"
BENCH_PATH="$HOME/pilot/benches/$BENCH_NAME"
DB_HOST="127.0.0.1"
DB_PORT="3306"
DB_ROOT_PASSWORD="root"

export PATH="$HOME/pilot/bin:$HOME/.local/bin:$PATH"
printf '%s\n' "$HOME/pilot/bin" "$HOME/.local/bin" >> "$GITHUB_PATH"

curl -fsSL "https://raw.githubusercontent.com/frappe/pilot/develop/install.sh" | sh -s -- --ci

pilot new "$BENCH_NAME" --frappe-branch "$FRAPPE_BRANCH"
pilot -b "$BENCH_NAME" set-bench-config admin_allow_site_to_pilot_communication false
pilot -b "$BENCH_NAME" set-bench-config mariadb_existing true
pilot -b "$BENCH_NAME" set-bench-config mariadb_host "$DB_HOST"
pilot -b "$BENCH_NAME" set-bench-config mariadb_port "$DB_PORT"
pilot -b "$BENCH_NAME" set-bench-config mariadb_admin_user root
pilot -b "$BENCH_NAME" set-bench-config mariadb_password "$DB_ROOT_PASSWORD"
pilot -b "$BENCH_NAME" init --skip-frontend

cd "$BENCH_PATH"

uv pip install --python env/bin/python -e "apps/frappe[test]"

pilot -b "$BENCH_NAME" start > "$RUNNER_TEMP/pilot.log" 2>&1 &
curl --fail --silent --show-error --retry 30 --retry-connrefused --retry-delay 1 \
  http://127.0.0.1:7000/api/v1/health

# The external MariaDB service has no utf8mb4 defaults; Frappe needs them.
printf '[client]\nskip-ssl\n' > ~/.my.cnf
mariadb --host "$DB_HOST" --port "$DB_PORT" -u root -p"$DB_ROOT_PASSWORD" -e "SET GLOBAL character_set_server = 'utf8mb4'"
mariadb --host "$DB_HOST" --port "$DB_PORT" -u root -p"$DB_ROOT_PASSWORD" -e "SET GLOBAL collation_server = 'utf8mb4_unicode_ci'"

# shellcheck disable=SC2086
pilot get-app https://github.com/frappe/payments --skip-assets
# shellcheck disable=SC2086
pilot new-site "$SITE" --admin-password admin --apps frappe payments --skip-assets
config="sites/$SITE/site_config.json"
SITE_NAME="$SITE" SITE_CONFIG_JSON="$SITE_CONFIG" python3 - <<'EOF'
import json, os
path = os.path.join("sites", os.environ["SITE_NAME"], "site_config.json")
with open(path) as f:
    config = json.load(f)
config.update(json.loads(os.environ.get("SITE_CONFIG_JSON") or "{}"))
with open(path, "w") as f:
    json.dump(config, f, indent=1)
EOF
# Emails resolve CSS through assets.json; tests never load the built bundles.
mkdir -p sites/assets && echo '{}' > sites/assets/assets.json
