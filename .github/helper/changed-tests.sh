#!/usr/bin/env bash
# Decide whether a pull request can run only the tests it changed.
#
# Usage: git diff --name-status --no-renames BASE HEAD | changed-tests.sh server|e2e|vitest
#
# Prints two lines for $GITHUB_OUTPUT:
#   mode=full|subset
#   tests=<space-separated list>   (dotted modules for server, spec paths for e2e,
#                                   paths relative to frontend/ for vitest)
# The reason for the choice goes to stderr.
#
# Run from the repository root: server mode greps lms/ for importers.

set -euo pipefail

suite="${1:-}"
case "$suite" in
	server | e2e | vitest) ;;
	*)
		echo "usage: changed-tests.sh server|e2e|vitest < name-status-list" >&2
		exit 2
		;;
esac

# Drains stdin first: exiting mid-list kills the writer (git diff) with SIGPIPE,
# which fails the step under pipefail.
full() {
	cat > /dev/null
	echo "Running the full suite: $1" >&2
	echo "mode=full"
	echo "tests="
	exit 0
}

# Same as the workflows' paths-ignore.
is_ignored() {
	case "$1" in
		*.md) return 0 ;;
		lms/locale/*) return 0 ;;
	esac
	return 1
}

is_test_file() {
	local path="$1"
	local name
	name=$(basename "$path")
	if [ "$suite" = "server" ]; then
		case "$path" in
			lms/*.py) ;;
			*) return 1 ;;
		esac
		case "$name" in
			test_*.py) return 0 ;;
		esac
		return 1
	fi
	if [ "$suite" = "vitest" ]; then
		# vitest.config.ts's include. Setup files and helpers are not tests.
		case "$path" in
			frontend/src/tests/*.test.ts | frontend/src/tests/*.test.js) return 0 ;;
		esac
		return 1
	fi
	case "$path" in
		e2e/*.spec.ts) return 0 ;;
	esac
	return 1
}

# lms/lms/doctype/x/test_x.py -> lms.lms.doctype.x.test_x
to_module() {
	local path="${1%.py}"
	echo "${path//\//.}"
}

# A test_*.py that other code imports (lms/lms/test_helpers.py, or a test
# module reused by another) is a shared helper, so changing it needs every test.
is_imported_elsewhere() {
	local path="$1"
	local module
	module=$(to_module "$path")
	grep -rlwF --include='*.py' "$module" lms | grep -vxF "$path" > /dev/null
}

selected=()
seen_any=false

while IFS=$'\t' read -r status path; do
	if [ -z "$path" ]; then
		continue
	fi
	if is_ignored "$path"; then
		continue
	fi
	seen_any=true

	if ! is_test_file "$path"; then
		full "$path is not a test file of the $suite suite"
	fi

	if [ "$suite" = "server" ] && is_imported_elsewhere "$path"; then
		full "$path is imported by other modules"
	fi

	if [ "$status" = "D" ]; then
		echo "Skipping deleted $path" >&2
		continue
	fi

	if [ "$suite" = "server" ]; then
		selected+=("$(to_module "$path")")
	elif [ "$suite" = "vitest" ]; then
		selected+=("${path#frontend/}")
	else
		selected+=("$path")
	fi
done

if [ "$seen_any" = false ]; then
	full "no changed files"
fi

if [ "${#selected[@]}" -eq 0 ]; then
	full "no test files left to run"
fi

echo "Running only the changed $suite tests: ${selected[*]}" >&2
echo "mode=subset"
echo "tests=${selected[*]}"
