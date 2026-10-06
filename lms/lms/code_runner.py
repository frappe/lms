"""Runs a learner's code against an exercise's test cases on the code runner
(Falcon), so a saved verdict comes from code the server ran itself rather than
from outputs the browser reports.

Each case is run the way the exercise page runs it: the code as the source file,
the case's input as a file named `stdin`, the runtime's default command."""

import json
from concurrent.futures import ThreadPoolExecutor

import frappe
import requests
from frappe import _

DEFAULT_RUNNER_URL = "https://falcon.frappe.io"

# The stdin-reading preamble the exercise page starts a learner's code from.
# Keep in sync with BOILERPLATE in frontend/src/pages/ProgrammingExercises/exerciseRunFlow.ts.
BOILERPLATE = {
	"python": 'with open("stdin", "r") as f:\n    data = f.read()\n\ninputs = data.split() if len(data) else []\n\n# inputs is a list of strings\n# write your code below\n\n',
	"javascript": "const fs = require('fs');\n\nlet input = fs.readFileSync('/app/stdin', 'utf8').trim();\nconst inputs = input.split(\"\\n\");\n// inputs is an array of strings\n// write your code below\n",
}

# Falcon stops a program after 10 seconds; the rest is container start-up.
RUN_TIMEOUT = 30
MAX_PARALLEL_RUNS = 5


class RunnerUnavailable(Exception):
	"""Raised inside a worker thread, where frappe.throw has no request to report to."""


def run_test_cases(language: str, code: str, test_cases: list) -> list[str]:
	"""Return each case's stdout, in the order of `test_cases`."""
	if not test_cases:
		return []

	base_url = runner_url()
	runtime = (language or "python").lower()
	inputs = [case.input or "" for case in test_cases]

	try:
		with ThreadPoolExecutor(max_workers=min(MAX_PARALLEL_RUNS, len(inputs))) as pool:
			return list(pool.map(lambda stdin: run_once(base_url, runtime, code, stdin), inputs))
	except RunnerUnavailable:
		frappe.throw(_("The code runner could not be reached, so nothing was saved. Please try again."))


def code_to_store(language: str, starter_code: str | None, code: str) -> str:
	"""Submissions store the learner's code without the preamble, which the page
	adds back on load. Starter code replaces the preamble, so it is stored whole,
	as is code whose preamble the learner edited. A submission's full_code flag
	records which, since the stored code alone cannot tell them apart."""
	if starter_code:
		return code
	preamble = BOILERPLATE.get((language or "").lower(), "")
	if preamble and code.startswith(preamble):
		return code[len(preamble) :]
	return code


def runner_url() -> str:
	url = frappe.db.get_single_value("LMS Settings", "livecode_url") or DEFAULT_RUNNER_URL
	return url.rstrip("/")


def run_once(base_url: str, runtime: str, code: str, stdin: str) -> str:
	try:
		response = requests.post(
			f"{base_url}/exec",
			json={
				"runtime": runtime,
				"code": code,
				"files": [{"filename": "stdin", "contents": stdin}],
				"raw_output": True,
			},
			timeout=RUN_TIMEOUT,
		)
		response.raise_for_status()
	except requests.RequestException as e:
		raise RunnerUnavailable from e

	return read_stdout(response.text)


def read_stdout(body: str) -> str:
	"""Join the stdout writes of a raw `/exec` response: one JSON message per line.
	A run that never reports its exit status was cut off, not finished."""
	stdout = []
	exited = False
	for line in body.splitlines():
		if not line.strip():
			continue
		try:
			message = json.loads(line)
		except ValueError as e:
			raise RunnerUnavailable from e
		if message.get("msgtype") == "write" and message.get("file") == "stdout":
			stdout.append(message.get("data") or "")
		elif message.get("msgtype") == "exitstatus":
			exited = True

	if not exited:
		raise RunnerUnavailable
	return "".join(stdout)
