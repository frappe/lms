#!/bin/bash

set -e

BENCH_DIR="/home/frappe/frappe-bench"
INIT_DIR="${BENCH_DIR}.init"
MARIADB_ROOT_PASSWORD="${MARIADB_ROOT_PASSWORD:-123}"
LMS_ADMIN_PASSWORD="${LMS_ADMIN_PASSWORD:-admin}"

export PATH="${NVM_DIR}/versions/node/v${NODE_VERSION_DEVELOP}/bin/:${PATH}"

configure_production_site() {
	bench --site lms.localhost set-config developer_mode 0
	bench --site lms.localhost set-config host_name https://yu-lms.opik.net
	bench --site lms.localhost enable-scheduler

	if [ -n "${MAIL_SERVER:-}" ] && [ -n "${MAIL_LOGIN:-}" ] && [ -n "${MAIL_PASSWORD:-}" ]; then
		bench --site lms.localhost set-config mail_server "${MAIL_SERVER}"
		bench --site lms.localhost set-config mail_port "${MAIL_PORT:-587}"
		bench --site lms.localhost set-config mail_login "${MAIL_LOGIN}"
		bench --site lms.localhost set-config mail_password "${MAIL_PASSWORD}"
		bench --site lms.localhost set-config use_tls "${MAIL_USE_TLS:-1}"
		bench --site lms.localhost set-config use_ssl "${MAIL_USE_SSL:-0}"
		if [ -n "${MAIL_DEFAULT_SENDER:-}" ]; then
			bench --site lms.localhost set-config auto_email_id "${MAIL_DEFAULT_SENDER}"
		fi
	fi
}

if [ -d "${BENCH_DIR}/apps/frappe" ] && [ -f "${BENCH_DIR}/sites/common_site_config.json" ]; then
	echo "Bench already exists, skipping init"
	ln -sfn "${BENCH_DIR}" "${INIT_DIR}"
else
	echo "Creating new bench..."
	# A stopped first run can leave the named volume with only part of a bench.
	# `bench init` cannot resume into that directory, so discard only this known,
	# incomplete disposable directory before retrying initialization.
	if [ -e "${BENCH_DIR}" ]; then
		echo "Removing incomplete bench from a previous initialization..."
		find "${BENCH_DIR}" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
	fi

	if [ ! -d "${INIT_DIR}/apps/frappe" ] || [ ! -f "${INIT_DIR}/sites/common_site_config.json" ]; then
		rm -rf -- "${INIT_DIR}"
		bench init --skip-redis-config-generation "${INIT_DIR}"
	else
		echo "Recovering the initialized bench from the previous run..."
	fi

	cp -a "${INIT_DIR}/." "${BENCH_DIR}/"
	rm -rf -- "${INIT_DIR}"
	ln -s "${BENCH_DIR}" "${INIT_DIR}"
fi

cd "${BENCH_DIR}"

if [ -d apps/payments ] && [ -d apps/lms ]; then
	printf 'frappe\npayments\nlms\n' > sites/apps.txt
fi

if [ -f sites/lms.localhost/site_config.json ] && \
	[ -d apps/lms ]; then
	echo "Site already exists, starting bench"
	cp -a /workspace/lms/. apps/lms/
	ln -sfn ../../apps/frappe/frappe/public sites/assets/frappe
	ln -sfn ../../apps/payments/payments/public sites/assets/payments
	ln -sfn ../../apps/lms/lms/public sites/assets/lms
	configure_production_site
	sed -i 's|^web:.*|web: ./env/bin/gunicorn --chdir sites -b 0.0.0.0:8000 -w 2 --threads 2 --timeout 120 frappe.app:application|' ./Procfile
	bench start
	exit 0
fi

# Use containers instead of localhost
bench set-mariadb-host mariadb
bench set-redis-cache-host redis://redis:6379
bench set-redis-queue-host redis://redis:6379
bench set-redis-socketio-host redis://redis:6379

# Remove redis, watch from Procfile
sed -i '/redis/d' ./Procfile
sed -i '/watch/d' ./Procfile

if [ ! -d apps/payments ]; then
	bench get-app payments
fi

mkdir -p apps/lms
cp -a /workspace/lms/. apps/lms/
bench setup requirements --python
ln -sfn ../../apps/frappe/frappe/public sites/assets/frappe
ln -sfn ../../apps/payments/payments/public sites/assets/payments
ln -sfn ../../apps/lms/lms/public sites/assets/lms
printf 'frappe\npayments\nlms\n' > sites/apps.txt

bench new-site lms.localhost \
--force \
--mariadb-root-password "${MARIADB_ROOT_PASSWORD}" \
--admin-password "${LMS_ADMIN_PASSWORD}" \
--no-mariadb-socket

bench --site lms.localhost install-app payments
bench --site lms.localhost install-app lms
configure_production_site
bench --site lms.localhost clear-cache
bench use lms.localhost

sed -i 's|^web:.*|web: ./env/bin/gunicorn --chdir sites -b 0.0.0.0:8000 -w 2 --threads 2 --timeout 120 frappe.app:application|' ./Procfile
bench start
