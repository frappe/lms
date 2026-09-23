#!bin/bash

if [ -d "/home/frappe/frappe-bench/apps/frappe" ]; then
    echo "Bench already exists, skipping init"
    cd frappe-bench
    # Docker publishes port 8000 from the container, so bind the web process
    # to all container interfaces instead of the loopback interface.
    sed -i 's|^web:.*|web: bench serve --host 0.0.0.0 --port 8000|' ./Procfile
    bench start
    exit 0
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
sed -i 's|^web:.*|web: bench serve --host 0.0.0.0 --port 8000|' ./Procfile

bench get-app payments
bench get-app lms

# Keep the local LMS customisations when a fresh bench clones the app.
if [ -f "/workspace/lms/lms/api.py" ]; then
    cp /workspace/lms/lms/api.py apps/lms/lms/lms/api.py
fi
if [ -f "/workspace/frontend/src/components/LanguageDialog.vue" ]; then
    cp /workspace/frontend/src/components/LanguageDialog.vue apps/lms/frontend/src/components/LanguageDialog.vue
fi
if [ -f "/workspace/frontend/src/components/Settings/mobileSettings.ts" ]; then
    cp /workspace/frontend/src/components/Settings/mobileSettings.ts apps/lms/frontend/src/components/Settings/mobileSettings.ts
fi
if [ -f "/workspace/frontend/src/components/Settings/youRows.ts" ]; then
    cp /workspace/frontend/src/components/Settings/youRows.ts apps/lms/frontend/src/components/Settings/youRows.ts
fi
if [ -f "/workspace/frontend/src/components/Sidebar/UserDropdown.vue" ]; then
    cp /workspace/frontend/src/components/Sidebar/UserDropdown.vue apps/lms/frontend/src/components/Sidebar/UserDropdown.vue
fi
if [ -f "/workspace/frontend/src/pages/MobileYou.vue" ]; then
    cp /workspace/frontend/src/pages/MobileYou.vue apps/lms/frontend/src/pages/MobileYou.vue
fi

# Keep the local Vietnamese catalog when a fresh bench clones the LMS app.
if [ -f "/workspace/lms/locale/vi.po" ]; then
    cp /workspace/lms/locale/vi.po apps/lms/lms/locale/vi.po
    bench compile-po-to-mo --app lms --locale vi --force
fi

# Frappe calculates a conservative Node heap limit from the WSL memory cap.
# On this machine that limit is too small for the LMS Vite bundle. Recover the
# frontend entrypoint explicitly when the automatic app build stopped at OOM.
if [ ! -f "apps/lms/lms/www/_lms.html" ]; then
    echo "Building LMS frontend with an increased Node heap..."
    (cd apps/lms/frontend && NODE_OPTIONS=--max-old-space-size=4096 yarn build)
fi

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

bench start
