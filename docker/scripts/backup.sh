#!/bin/bash

set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/lms/docker}"
SITE_NAME="${SITE_NAME:-lms.localhost}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

cd "${COMPOSE_DIR}"
docker compose exec -T frappe bash -lc \
	"cd /home/frappe/frappe-bench && bench --site '${SITE_NAME}' backup --with-files"

BACKUP_DIR="/var/lib/docker/volumes/lms_frappe-bench/_data/sites/${SITE_NAME}/private/backups"
find "${BACKUP_DIR}" -type f -mtime "+${RETENTION_DAYS}" -delete

if [ -n "${BACKUP_REMOTE:-}" ]; then
	if ! command -v rclone >/dev/null 2>&1; then
		echo "BACKUP_REMOTE is configured, but rclone is not installed" >&2
		exit 1
	fi
	rclone copy "${BACKUP_DIR}" "${BACKUP_REMOTE}" --include "*" --transfers 2
fi
