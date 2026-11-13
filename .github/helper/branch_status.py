"""
Run the full server, UI and frontend suites on develop and version-16 every hour, and post a status on the
pull requests waiting to land there. Pull requests skip those suites, so this status is how they
see the branch: failing while the latest full run on it failed, unless the pull request carries
the fix label and the failing suites passed on it.

Adapted from frappe/frappe's .github/helper/develop_status.py.

Usage:
    python branch_status.py start [all]   # start the suites the branches' new commits need, or all
    python branch_status.py refresh       # every open pull request into a tested branch
    python branch_status.py pr <number>   # one pull request
    python branch_status.py commit <sha>  # the pull requests whose head is this commit
"""

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from functools import cache

REPO = os.environ["GITHUB_REPOSITORY"]
FIX_LABEL = "fixes-develop"

# Each tested branch, and the bases of the pull requests that land on it.
BRANCHES = {"develop": ("develop",), "version-16": ("version-16-hotfix",)}
# Each suite's workflow and its one test job.
SUITES = {
	"ci.yml": "Server Tests",
	"ui-tests.yml": "UI Tests (Playwright)",
	"frontend-tests.yml": "Vitest",
}

# Files the server suite cannot see, as in ci.yml's paths, except the two a server test reads.
SERVER_BLIND = (".md", ".vue", ".ts", ".js", ".css")
SERVER_READS = ("frontend/src/utils/lessonForm.ts", "frontend/src/directives/safeHtmlLevels.ts")
# Files outside frontend/ that the frontend suite reads, as in frontend-tests.yml's paths.
FRONTEND_READS = ("package.json", "lms/raven_provider.py", "lms/www/new-sign-up.html")


API = "https://api.github.com"


def gh(path, method="GET", body=None, params=None, attempts=3):
	"""A GitHub REST call, tried again after a failure such as a dropped connection.

	Plain urllib rather than the gh CLI: the marketplace check blocks any app that
	spawns a process, and this file ships with the app."""
	url = f"{API}/{path}"
	if params:
		url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
	request = urllib.request.Request(
		url,
		data=json.dumps(body).encode() if body is not None else None,
		method=method,
		headers={
			"Accept": "application/vnd.github+json",
			"Authorization": f"Bearer {os.environ['GH_TOKEN']}",
			"X-GitHub-Api-Version": "2022-11-28",
		},
	)
	for attempt in range(attempts):
		try:
			with urllib.request.urlopen(request, timeout=60) as response:
				payload = response.read()
				return json.loads(payload) if payload else None
		except (urllib.error.URLError, TimeoutError):
			if attempt == attempts - 1:
				raise
			time.sleep(10)


def search(query):
	return gh("search/issues", params={"q": query})["items"]


def open_pulls(base):
	"""Every open pull request into this base, page by page."""
	page = 1
	while True:
		pulls = gh(
			f"repos/{REPO}/pulls", params={"base": base, "state": "open", "per_page": 100, "page": page}
		)
		yield from pulls
		if len(pulls) < 100:
			return
		page += 1


def tested_branch(base):
	return next((branch for branch, bases in BRANCHES.items() if base in bases), None)


def suite_result(run, workflow):
	"""("success", "failure" or "pending", failed job url). Passed only when the test job ran."""
	if not run or run["status"] != "completed":
		return "pending", ""
	job = next(
		(
			j
			for j in gh(f"repos/{REPO}/actions/runs/{run['id']}/jobs")["jobs"]
			if j["name"] == SUITES[workflow]
		),
		None,
	)
	if not job or job["conclusion"] in ("cancelled", "skipped"):
		return "pending", ""
	if job["conclusion"] == "success":
		return "success", ""
	return "failure", job["html_url"]


def pr_run(workflow, pr):
	"""The latest test run of this pull request, skipping runs of another pull request on the same commit."""
	runs = gh(
		f"repos/{REPO}/actions/workflows/{workflow}/runs?head_sha={pr['head']['sha']}&event=pull_request"
	)
	for run in runs["workflow_runs"]:
		if not run["pull_requests"] or any(p["number"] == pr["number"] for p in run["pull_requests"]):
			return run


def fixed_after(workflow, failed_run, branch):
	"""Was a fix pull request merged after this failure, with this suite passing in full on it?"""
	for base in BRANCHES[branch]:
		query = (
			f"repo:{REPO} is:pr is:merged base:{base} label:{FIX_LABEL} merged:>={failed_run['created_at']}"
		)
		for item in search(query):
			pr = gh(f"repos/{REPO}/pulls/{item['number']}")
			if suite_result(pr_run(workflow, pr), workflow)[0] == "success":
				return True
	return False


def branch_runs(workflow, branch):
	runs = gh(f"repos/{REPO}/actions/workflows/{workflow}/runs?branch={branch}&event=workflow_dispatch")
	return runs["workflow_runs"]


@cache
def failing_suites(branch):
	"""{workflow: failed job url} for each suite whose latest finished full run on the branch failed."""
	failing = {}
	for workflow in SUITES:
		for run in branch_runs(workflow, branch):
			state, url = suite_result(run, workflow)
			if state == "failure" and not fixed_after(workflow, run, branch):
				failing[workflow] = url
			if state != "pending":
				break
	return failing


def fix_status(pr, branch):
	"""A fix pull request can merge only once every suite failing on its branch passed on it."""
	results = [suite_result(pr_run(workflow, pr), workflow) for workflow in failing_suites(branch)]
	failed = next((url for state, url in results if state == "failure"), None)
	if failed:
		return "failure", f"{branch} is failing and the fix failed its tests", failed
	if any(state == "pending" for state, _ in results):
		return "pending", f"{branch} is failing, testing the fix", ""
	return "success", f"{branch} is failing, the fix passed its tests", ""


def post(pr):
	"""Set the pull request's branch status."""
	branch = tested_branch(pr["base"]["ref"])
	if not branch:
		return
	context = f"{branch.capitalize()} status"
	failing = failing_suites(branch)
	if not failing:
		state, description, url = "success", f"{branch} is passing", ""
	elif any(label["name"] == FIX_LABEL for label in pr["labels"]):
		state, description, url = fix_status(pr, branch)
	else:
		state, description, url = (
			"failure",
			f"{branch} is failing, see the failed run",
			next(iter(failing.values())),
		)

	sha = pr["head"]["sha"]
	statuses = gh(f"repos/{REPO}/commits/{sha}/status")["statuses"]
	current = next((s for s in statuses if s["context"] == context), None)
	if current and (current["state"], current["description"]) == (state, description):
		return

	fields = {"state": state, "context": context, "description": description}
	if url:
		fields["target_url"] = url
	gh(f"repos/{REPO}/statuses/{sha}", method="POST", body=fields)
	print(f"#{pr['number']}: {state}")
	time.sleep(1)


def needs_suite(workflow, files):
	"""Can these changed files affect this suite? None means too many files to tell."""
	if files is None or any(f.startswith(".github/") for f in files):
		return True
	if workflow == "ci.yml":
		return any(
			f in SERVER_READS or not (f.endswith(SERVER_BLIND) or f.startswith(("frontend/", "lms/locale/")))
			for f in files
		)
	if workflow == "frontend-tests.yml":
		return any(f.startswith("frontend/") or f in FRONTEND_READS for f in files)
	return any(not (f.endswith(".md") or f.startswith("lms/locale/")) for f in files)


def start(force):
	for branch in BRANCHES:
		head = gh(f"repos/{REPO}/commits/{branch}")["sha"]
		for workflow in SUITES:
			last = next(iter(branch_runs(workflow, branch)), None)
			if not force and last:
				if last["status"] != "completed" or last["head_sha"] == head:
					continue
				changes = gh(f"repos/{REPO}/compare/{last['head_sha']}...{head}")["files"]
				files = [
					path for f in changes for path in (f["filename"], f.get("previous_filename")) if path
				]
				if not needs_suite(workflow, None if len(changes) >= 300 else files):
					print(f"{workflow} on {branch}: no changes it can see since {last['head_sha'][:7]}")
					continue
			try:
				gh(
					f"repos/{REPO}/actions/workflows/{workflow}/dispatches",
					method="POST",
					body={"ref": branch},
					attempts=1,
				)
			except urllib.error.HTTPError as e:
				# A branch whose copy of the workflow cannot be dispatched yet; the others still run.
				print(f"{workflow} on {branch}: could not start ({e.code})")
				continue
			print(f"{workflow} on {branch}: started on {head[:7]}")


def refresh():
	for branch, bases in BRANCHES.items():
		print(f"{branch}: failing {list(failing_suites(branch)) or 'nothing'}")
		for base in bases:
			for pr in open_pulls(base):
				post(pr)


if __name__ == "__main__":
	command = sys.argv[1]
	if command == "start":
		start("all" in sys.argv[2:])
	elif command == "pr":
		post(gh(f"repos/{REPO}/pulls/{sys.argv[2]}"))
	elif command == "commit":
		query = f"repo:{REPO} is:pr is:open sha:{sys.argv[2]}"
		for item in search(query):
			pr = gh(f"repos/{REPO}/pulls/{item['number']}")
			if pr["head"]["sha"] == sys.argv[2]:
				post(pr)
	else:
		refresh()
