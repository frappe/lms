#!/bin/bash

set -e

if [ -d "/home/frappe/frappe-bench/apps/frappe" ]; then
    echo "Bench already exists, skipping init"
    cd frappe-bench
	# Keep the disposable container copy aligned with the checked-out project.
	# Runtime data lives under sites/ and MariaDB, not inside the app directory.
	rsync --archive --delete \
		--exclude .git \
		--exclude node_modules \
		/workspace/lms/ apps/lms/
    sed -i 's|^web:.*|web: bench serve --port 8000 --host 0.0.0.0|' ./Procfile
    bench start
else
    echo "Creating new bench..."
fi

export PATH="${NVM_DIR}/versions/node/v${NODE_VERSION_DEVELOP}/bin/:${PATH}"

bench init --skip-redis-config-generation frappe-bench

cd frappe-bench

# Use containers instead of localhost
bench set-mariadb-host mariadb
bench set-redis-cache-host redis://redis:6379
bench set-redis-queue-host redis://redis:6379
bench set-redis-socketio-host redis://redis:6379

# Remove redis, watch from Procfile
sed -i '/redis/d' ./Procfile
sed -i '/watch/d' ./Procfile

bench get-app payments
git config --global --add safe.directory /workspace/lms
git config --global --add safe.directory /workspace/lms/.git
bench get-app /workspace/lms

bench new-site lms.localhost \
--force \
--mariadb-root-password 123 \
--admin-password admin \
--no-mariadb-socket

bench --site lms.localhost install-app payments
bench --site lms.localhost install-app lms
bench --site lms.localhost set-config developer_mode 1
bench --site lms.localhost clear-cache
bench use lms.localhost

sed -i 's|^web:.*|web: bench serve --port 8000 --host 0.0.0.0|' ./Procfile
bench start
