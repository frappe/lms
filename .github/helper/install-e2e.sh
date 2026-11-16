#!/bin/bash

# Provision a bench for Playwright e2e on pilot. Full init
# (frontend toolchain included), real asset build, site served by pilot's
# web on :8000. Fresh provision every run; nothing is cached.
#
# Expects from the caller: FRAPPE_BRANCH, SITE.

set -eo pipefail

FRAPPE_BRANCH="${FRAPPE_BRANCH:-develop}"
SITE="${SITE:-lms.test}"
BENCH_NAME="frappe-bench"
BENCH_PATH="$HOME/pilot/benches/$BENCH_NAME"
DB_HOST="127.0.0.1"
DB_PORT="3306"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:-123}"

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
pilot -b "$BENCH_NAME" init

cd "$BENCH_PATH"

uv pip install --python env/bin/python -e "apps/frappe[test]"

pilot -b "$BENCH_NAME" start > "$RUNNER_TEMP/pilot.log" 2>&1 &
curl --fail --silent --show-error --retry 30 --retry-connrefused --retry-delay 1 \
  http://127.0.0.1:7000/api/v1/health

printf '[client]\nskip-ssl\n' > ~/.my.cnf
mariadb --host "$DB_HOST" --port "$DB_PORT" -u root -p"$DB_ROOT_PASSWORD" -e "SET GLOBAL character_set_server = 'utf8mb4'"
mariadb --host "$DB_HOST" --port "$DB_PORT" -u root -p"$DB_ROOT_PASSWORD" -e "SET GLOBAL collation_server = 'utf8mb4_unicode_ci'"

# shellcheck disable=SC2086
pilot get-app https://github.com/frappe/payments --skip-assets
# shellcheck disable=SC2086
pilot get-app "${GITHUB_WORKSPACE}" --branch "${GITHUB_SHA}" --skip-assets
# shellcheck disable=SC2086
pilot new-site "$SITE" --admin-password admin --apps frappe payments --skip-assets
SITE_NAME="$SITE" python3 - <<'EOF'
import json, os
path = os.path.join("sites", os.environ["SITE_NAME"], "site_config.json")
with open(path) as f:
    config = json.load(f)
config.update(
    {
        "allow_tests": True,
        "enable_ui_tests": True,
        "auto_email_id": "test@example.com",
        "mail_server": "smtp.example.com",
        "mail_login": "test@example.com",
        "mail_password": "test",
        "host_name": "http://lms.test:8000",
        "monitor": 1,
        "server_script_enabled": True,
        "mute_emails": True,
    }
)
with open(path, "w") as f:
    json.dump(config, f, indent=1)
EOF
pilot install-app "$SITE" lms
# Never prebuilt: e2e must exercise this checkout's frontend, not a download.
pilot build --apps lms --force
curl --fail --silent --show-error --retry 30 --retry-delay 2 --retry-all-errors \
  --output /dev/null "http://$SITE:8000/api/method/ping"
