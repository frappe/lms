#!/usr/bin/env bash
# Deploy Frappe LMS to a production server from this laptop over SSH.
#
#   scripts/deploy/deploy.sh setup              first-time setup of a new server
#   scripts/deploy/deploy.sh deploy [options]   build the image, back up, ship, restart
#   scripts/deploy/deploy.sh rollback           restart the previous image
#   scripts/deploy/deploy.sh backup             take a database + files backup now
#   scripts/deploy/deploy.sh status             show running containers and image tags
#
# Options for deploy:
#   --ref <git-ref>   git ref to build (default: value in deploy.env, else main)
#   --migrate         run bench migrate after the backup (schema changes)
#   --dry-run         print every step without changing anything
#
# The database and Redis containers are never recreated by a deploy. A backup runs
# before every deploy and the deploy stops if the backup fails.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG="$SCRIPT_DIR/deploy.env"
CONTAINERFILE="$REPO_DIR/docker/prod/Containerfile"
COMPOSE_FILE="$REPO_DIR/docker/prod/compose.yml"
PLATFORM_DEFAULT="linux/amd64"

DRY_RUN=0
MIGRATE=0
REF_OVERRIDE=""
BUILD_CTX=""

cleanup() { [[ -n "$BUILD_CTX" ]] && rm -rf "$BUILD_CTX"; return 0; }
trap cleanup EXIT

log()  { printf '\n==> %s\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf 'error: %s\n' "$*" >&2; exit 1; }

# run <description> <command...>: prints in dry-run mode, otherwise runs.
run() {
	local desc="$1"; shift
	if [[ $DRY_RUN -eq 1 ]]; then
		printf '    [dry-run] %s\n' "$desc"
		printf '              %s\n' "$*"
		return 0
	fi
	info "$desc"
	"$@"
}

load_config() {
	[[ -f "$CONFIG" ]] || die "missing $CONFIG. Run: scripts/deploy/deploy.sh setup (or copy deploy.env.example)"
	# shellcheck disable=SC1090
	source "$CONFIG"
	: "${DEPLOY_HOST:?set DEPLOY_HOST in deploy.env}"
	: "${DEPLOY_DIR:=/opt/lms}"
	: "${SITE_NAME:?set SITE_NAME in deploy.env}"
	: "${REF:=main}"
	: "${IMAGE_REPO:=lms-prod}"
	: "${PLATFORM:=$PLATFORM_DEFAULT}"
}

remote() { ssh -o BatchMode=yes "$DEPLOY_HOST" "$@"; }

# Compose against the server's project and .env. Prints a shell-quoted command
# line for ssh; every argument is quoted on its own.
rcompose() {
	local base
	printf -v base 'docker compose --project-directory %q -f %q --env-file %q' \
		"$DEPLOY_DIR" "$DEPLOY_DIR/compose.yml" "$DEPLOY_DIR/.env"
	printf '%s' "$base"
	local arg
	for arg in "$@"; do printf ' %q' "$arg"; done
}

check_local_tools() {
	command -v docker >/dev/null || die "docker is not installed on this laptop"
	command -v ssh >/dev/null || die "ssh is not installed on this laptop"
	command -v git >/dev/null || die "git is not installed on this laptop"
}

check_server() {
	log "Checking the server"
	if [[ $DRY_RUN -eq 1 ]]; then
		info "[dry-run] would check Docker and Compose on $DEPLOY_HOST"
		return 0
	fi
	remote "command -v docker >/dev/null && docker compose version >/dev/null" \
		|| die "Docker and the Compose plugin must be installed on $DEPLOY_HOST"
	info "Docker and Compose are available on $DEPLOY_HOST"
}

# ---------------------------------------------------------------- build

build_image() {
	local ref="$1" sha tag ctx
	sha="$(git -C "$REPO_DIR" rev-parse --short=12 "$ref^{commit}")" \
		|| die "git ref '$ref' does not exist"
	# The image is built from the committed ref, not the working tree. Warn when the
	# working tree differs, so nobody thinks local edits are in the image.
	if [[ -n "$(git -C "$REPO_DIR" status --porcelain -- lms frontend docker 2>/dev/null)" ]]; then
		printf 'warning: uncommitted changes under lms/, frontend/ or docker/ are NOT in the image; only %s is built\n' "$ref" >&2
	fi
	tag="$IMAGE_REPO:$sha"
	ctx="$(mktemp -d)"
	BUILD_CTX="$ctx"
	mkdir -p "$ctx/lms-src"
	# A clean export of the ref, not the working tree.
	git -C "$REPO_DIR" archive --format=tar "$ref" | tar -x -C "$ctx/lms-src"
	cp "$CONTAINERFILE" "$ctx/Containerfile"
	run "Build image $tag from $ref ($sha) for $PLATFORM" \
		docker build --platform "$PLATFORM" -f "$ctx/Containerfile" \
			--build-arg "LMS_VERSION=$sha" -t "$tag" "$ctx"
	BUILT_TAG="$tag"
}

# ---------------------------------------------------------------- ship

ship_image() {
	local tag="$1"
	run "Copy $tag to $DEPLOY_HOST over SSH (no registry)" \
		bash -c "docker save '$tag' | gzip | ssh -o BatchMode=yes '$DEPLOY_HOST' 'gunzip | docker load'"
}

# ---------------------------------------------------------------- server state

current_tag() {
	[[ $DRY_RUN -eq 1 ]] && return 0
	remote "cat '$DEPLOY_DIR/state/current' 2>/dev/null || true"
}

set_remote_image() {
	local tag="$1"
	run "Point LMS_IMAGE at $tag on the server" \
		remote "sed -i 's|^LMS_IMAGE=.*|LMS_IMAGE=$tag|' '$DEPLOY_DIR/.env'"
}

record_state() {
	local tag="$1"
	remote "mkdir -p '$DEPLOY_DIR/state' && { cat '$DEPLOY_DIR/state/current' 2>/dev/null > '$DEPLOY_DIR/state/previous' || true; } && echo '$tag' > '$DEPLOY_DIR/state/current'"
}

wait_healthy() {
	local tries=30
	if [[ $DRY_RUN -eq 1 ]]; then
		printf '    [dry-run] wait for http://127.0.0.1:8000/api/method/ping on the server\n'
		return 0
	fi
	info "Waiting for the site to answer"
	for _ in $(seq "$tries"); do
		if remote "curl -fsS -o /dev/null http://127.0.0.1:8000/api/method/ping"; then
			info "The site answers"
			return 0
		fi
		sleep 5
	done
	return 1
}

# ---------------------------------------------------------------- backup

backup() {
	log "Backing up $SITE_NAME (database and files)"
	run "bench backup --with-files for $SITE_NAME" \
		remote "$(rcompose exec -T app bench --site "$SITE_NAME" backup --with-files)"
	info "Backups stay in the sites volume. List them with: scripts/deploy/deploy.sh status"
}

# ---------------------------------------------------------------- commands

cmd_deploy() {
	load_config
	check_local_tools
	check_server
	local ref="${REF_OVERRIDE:-$REF}"

	log "Building $IMAGE_REPO from $ref"
	if [[ $DRY_RUN -eq 1 ]]; then
		local sha
		sha="$(git -C "$REPO_DIR" rev-parse --short=12 "$ref^{commit}" 2>/dev/null || echo "<sha of $ref>")"
		BUILT_TAG="$IMAGE_REPO:$sha"
		printf '    [dry-run] docker build of %s from %s\n' "$BUILT_TAG" "$ref"
	else
		build_image "$ref"
	fi

	log "Backing up before the change"
	backup

	log "Shipping the image to $DEPLOY_HOST"
	ship_image "$BUILT_TAG"

	local previous
	previous="$(current_tag)"
	[[ -n "$previous" ]] && info "Currently running: $previous"

	log "Restarting the application containers"
	set_remote_image "$BUILT_TAG"
	run "Recreate app, worker, scheduler and socketio (database and Redis untouched)" \
		remote "$(rcompose up -d --no-deps app worker scheduler socketio)"

	if [[ $MIGRATE -eq 1 ]]; then
		log "Migrating $SITE_NAME (schema changes; backup already taken)"
		run "bench --site $SITE_NAME migrate" \
			remote "$(rcompose exec -T app bench --site "$SITE_NAME" migrate)"
	fi

	log "Checking the site"
	if wait_healthy; then
		[[ $DRY_RUN -eq 1 ]] || record_state "$BUILT_TAG"
		log "Deployed $BUILT_TAG to $DEPLOY_HOST"
	else
		printf 'The site did not answer after the deploy. Rolling back.\n' >&2
		if [[ -n "$previous" ]]; then
			rollback_to "$previous"
		fi
		die "deploy failed; the previous image is running. Database was not restored."
	fi
}

rollback_to() {
	local tag="$1"
	set_remote_image "$tag"
	run "Restart app containers on $tag" \
		remote "$(rcompose up -d --no-deps app worker scheduler socketio)"
	[[ $DRY_RUN -eq 1 ]] || record_state "$tag"
}

cmd_rollback() {
	load_config
	check_local_tools
	check_server
	local previous
	previous="$(remote "cat '$DEPLOY_DIR/state/previous' 2>/dev/null || true")"
	[[ -n "$previous" ]] || die "no previous image is recorded on $DEPLOY_HOST"
	log "Rolling back to $previous (the database is not restored)"
	rollback_to "$previous"
	wait_healthy || die "the site did not answer after the rollback; check: scripts/deploy/deploy.sh status"
	log "Rolled back to $previous"
}

cmd_backup() {
	load_config
	check_local_tools
	check_server
	backup
}

cmd_status() {
	load_config
	check_local_tools
	check_server
	log "Current image"
	remote "cat '$DEPLOY_DIR/state/current' 2>/dev/null || echo '(none recorded)'"
	log "Containers"
	remote "$(rcompose ps)"
	log "Backups for $SITE_NAME"
	remote "$(rcompose exec -T app sh -c "ls -lt sites/$SITE_NAME/private/backups | head -6")" || true
}

cmd_setup() {
	check_local_tools
	log "First-time setup"
	if [[ ! -f "$CONFIG" ]]; then
		die "create $CONFIG first (copy scripts/deploy/deploy.env.example and fill it in)"
	fi
	load_config
	check_server

	log "Preparing $DEPLOY_DIR on the server"
	run "Create $DEPLOY_DIR, state and backups directories" \
		remote "mkdir -p '$DEPLOY_DIR/state' '$DEPLOY_DIR/backups'"

	local env_exists=0
	if [[ $DRY_RUN -eq 0 ]] && remote "[ -f '$DEPLOY_DIR/.env' ]"; then env_exists=1; fi

	if [[ $env_exists -eq 0 ]]; then
		local db_pw admin_pw
		if [[ $DRY_RUN -eq 1 ]]; then
			db_pw="<generated at setup>"
		else
			# head closes the pipe early, so tr may get SIGPIPE; that is expected here.
			db_pw="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32 || true)"
		fi
		if [[ $DRY_RUN -eq 1 ]]; then
			admin_pw="(dry run: not prompted)"
		else
			printf 'Admin password for the new site (not stored anywhere in the repo): '
			read -r -s admin_pw; echo
			[[ ${#admin_pw} -ge 8 ]] || die "admin password must be at least 8 characters"
		fi
		ADMIN_PW="$admin_pw"
		run "Write $DEPLOY_DIR/.env on the server (secrets stay on the server, mode 600)" \
			bash -c "printf 'SITE_NAME=%s\nDB_ROOT_PASSWORD=%s\nLMS_IMAGE=\n' '$SITE_NAME' '$db_pw' | ssh -o BatchMode=yes '$DEPLOY_HOST' 'cat > $DEPLOY_DIR/.env && chmod 600 $DEPLOY_DIR/.env'"
	else
		info "Found an existing .env on the server; keeping its secrets"
	fi
	run "Copy the production compose file to the server" \
		bash -c "scp -q -o BatchMode=yes '$COMPOSE_FILE' '$DEPLOY_HOST:$DEPLOY_DIR/compose.yml'"

	build_image "$REF"
	ship_image "$BUILT_TAG"
	set_remote_image "$BUILT_TAG"

	log "Starting the database and Redis"
	run "Start mariadb and redis" remote "$(rcompose up -d mariadb redis)"
	run "Wait for mariadb" remote "for i in \$(seq 60); do $(rcompose exec -T mariadb healthcheck.sh --connect --innodb_initialized) >/dev/null 2>&1 && exit 0; sleep 2; done; exit 1"

	log "Configuring the bench to use the containers"
	for cfg in "-g db_host mariadb" "-g redis_cache redis://redis:6379" \
		"-g redis_queue redis://redis:6379" "-g redis_socketio redis://redis:6379"; do
		run "bench set-config $cfg" remote "$(rcompose run --rm --no-deps -T app bench set-config $cfg)"
	done

	log "Creating the site $SITE_NAME (first time only)"
	if [[ $DRY_RUN -eq 1 ]]; then
		printf '    [dry-run] bench new-site %s, install payments and lms\n' "$SITE_NAME"
	else
		if remote "$(rcompose exec -T app test -d "sites/$SITE_NAME")" >/dev/null 2>&1; then
			die "site $SITE_NAME already exists on the server; setup will not recreate it"
		fi
		printf '%s\n' "${ADMIN_PW:?}" | remote "read -r ADMIN_PASSWORD && export ADMIN_PASSWORD && $(rcompose run --rm --no-deps -T -e ADMIN_PASSWORD app sh -c "bench new-site $SITE_NAME --mariadb-root-password \"\$DB_ROOT_PASSWORD\" --admin-password \"\$ADMIN_PASSWORD\" --no-mariadb-socket && bench --site $SITE_NAME install-app payments && bench --site $SITE_NAME install-app lms && bench use $SITE_NAME")"
	fi

	log "Starting the application"
	run "Start app, worker, scheduler and socketio" remote "$(rcompose up -d app worker scheduler socketio)"
	wait_healthy || die "the site did not answer; check: scripts/deploy/deploy.sh status"
	[[ $DRY_RUN -eq 1 ]] || record_state "$BUILT_TAG"
	log "Setup finished. Put a reverse proxy in front of 127.0.0.1:8000 for https://$SITE_NAME"
}

# ---------------------------------------------------------------- args

COMMAND="${1:-}"
shift || true
while [[ $# -gt 0 ]]; do
	case "$1" in
		--ref) REF_OVERRIDE="${2:?--ref needs a value}"; shift ;;
		--migrate) MIGRATE=1 ;;
		--dry-run) DRY_RUN=1 ;;
		-h|--help) sed -n '2,16p' "$0"; exit 0 ;;
		*) die "unknown option: $1" ;;
	esac
	shift
done

case "$COMMAND" in
	setup) cmd_setup ;;
	deploy) cmd_deploy ;;
	rollback) cmd_rollback ;;
	backup) cmd_backup ;;
	status) cmd_status ;;
	*) sed -n '2,16p' "$0"; exit 2 ;;
esac
