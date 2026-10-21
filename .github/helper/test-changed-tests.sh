#!/usr/bin/env bash
# Checks changed-tests.sh against sample name-status lists.
#
# Usage: .github/helper/test-changed-tests.sh

set -euo pipefail

cd "$(dirname "$0")/../.."

failures=0

# check SUITE EXPECTED_OUTPUT [STATUS PATH]...
check() {
	local suite="$1" expected="$2"
	shift 2
	local input=""
	while [ "$#" -gt 0 ]; do
		input+="$1"$'\t'"$2"$'\n'
		shift 2
	done
	local actual
	actual=$(printf '%s' "$input" | .github/helper/changed-tests.sh "$suite" 2> /dev/null)
	if [ "$actual" = "$expected" ]; then
		echo "ok: $suite ${input//$'\n'/ }"
	else
		echo "FAIL: $suite ${input//$'\n'/ }" >&2
		echo "  expected: ${expected//$'\n'/ | }" >&2
		echo "  actual:   ${actual//$'\n'/ | }" >&2
		failures=$((failures + 1))
	fi
}

subset() {
	printf 'mode=subset\ntests=%s' "$1"
}
full=$'mode=full\ntests='

check vitest "$(subset 'src/tests/a.test.ts src/tests/sub/b.test.js')" \
	M frontend/src/tests/a.test.ts \
	A frontend/src/tests/sub/b.test.js
check vitest "$full" \
	M frontend/src/tests/a.test.ts \
	M frontend/src/pages/A.vue
check vitest "$full" M frontend/src/index.css
check vitest "$full" \
	M frontend/src/tests/a.test.ts \
	M frontend/src/tests/setup.ts
check vitest "$full" M frontend/src/tests/_helpers/mount.ts
check vitest "$full" M frontend/vitest.config.ts
check vitest "$full" M e2e/a.spec.ts
# Outside frontend/, but read by ravenRuleModel.test.ts.
check vitest "$full" \
	M frontend/src/tests/a.test.ts \
	M lms/raven_provider.py
check vitest "$(subset 'src/tests/a.test.ts')" \
	D frontend/src/tests/gone.test.ts \
	M frontend/src/tests/a.test.ts
check vitest "$full" D frontend/src/tests/gone.test.ts
check vitest "$(subset 'src/tests/a.test.ts')" \
	M README.md \
	M frontend/src/tests/a.test.ts
check vitest "$full"
check e2e "$(subset 'e2e/a.spec.ts')" M e2e/a.spec.ts
check e2e "$full" M frontend/src/tests/a.test.ts
# The server suite ignores the frontend, like ci.yml's paths-ignore; the
# other suites do not.
check server "$(subset 'lms.tests.test_a')" \
	M lms/tests/test_a.py \
	M frontend/src/pages/A.vue \
	M lms/lms/doctype/lms_course/lms_course.js
check server "$full" M frontend/src/pages/A.vue
check vitest "$full" M frontend/src/pages/A.vue
# The one frontend file a server test reads still counts.
check server "$full" M frontend/src/utils/lessonForm.ts

# An early "full" must still read the whole list, or the writer of a large diff
# dies of SIGPIPE and fails the workflow step under pipefail.
long_list() {
	awk 'BEGIN { print "M\tlms/a.py"; for (i = 0; i < 100000; i++) print "M\tlms/x" i ".py" }'
}
status=0
actual=$(
	set -o pipefail
	long_list | .github/helper/changed-tests.sh server 2> /dev/null
) || status=$?
if [ "$status" -eq 0 ] && [ "$actual" = "$full" ]; then
	echo "ok: server with a 100k-line list"
else
	echo "FAIL: server with a 100k-line list exited $status with: ${actual//$'\n'/ | }" >&2
	failures=$((failures + 1))
fi

if [ "$failures" -gt 0 ]; then
	echo "$failures case(s) failed" >&2
	exit 1
fi
