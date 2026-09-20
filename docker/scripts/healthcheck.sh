#!/bin/bash

set -euo pipefail

BASE_URL="${LMS_BASE_URL:-https://yu-lms.opik.net}"

curl --fail --silent --show-error --max-time 20 "${BASE_URL}/api/method/ping" | grep -q '"pong"'
curl --fail --silent --show-error --max-time 20 --output /dev/null "${BASE_URL}/lms"

if [ -n "${HEALTHCHECK_PING_URL:-}" ]; then
	curl --fail --silent --show-error --max-time 20 --retry 2 "${HEALTHCHECK_PING_URL}" >/dev/null
fi
