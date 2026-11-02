# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

import os
import shutil

import frappe

# Packages extracted before 68e7b210e (2026-06-09) sit under public/, which nginx serves
# without reaching SCORMRenderer's enrolment check. The stored /scorm/<course>/<title> URLs
# are root-independent, so moving those bytes under private/ needs no DB write.
LEGACY_ROOTS = (("public", "scorm"), ("public", "files", "scorm"))

# The first uploader (2e1aac493 to 2416777df, Nov-Dec 2024) extracted into
# public/files/scorm and stored URLs under /files/scorm/, which only nginx served.
LEGACY_URL_PREFIX = "/files/scorm/"
URL_FIELDS = ("scorm_package_path", "manifest_file", "launch_file")


def execute():
	# Before the early return, so a run retried after the files already moved still
	# points the chapters at them.
	rewrite_legacy_urls()

	legacy_roots = [frappe.get_site_path(*root) for root in LEGACY_ROOTS]
	if not any(os.path.isdir(root) for root in legacy_roots):
		return

	summary = relocate(
		legacy_roots,
		frappe.get_site_path("private", "scorm"),
		frappe.get_site_path("private", "scorm_superseded"),
	)
	frappe.logger("lms").info(f"move_public_scorm_to_private: {summary}")
	return summary


def rewrite_legacy_urls() -> int:
	"""Point chapters that store /files/scorm/ URLs at /scorm/, the only route that
	serves a package once it sits under private/scorm."""
	if not frappe.db.table_exists("Course Chapter"):
		return 0

	chapters = frappe.get_all(
		"Course Chapter",
		filters={"scorm_package_path": ["like", f"{LEGACY_URL_PREFIX}%"]},
		fields=["name", *URL_FIELDS],
	)
	for chapter in chapters:
		frappe.db.set_value(
			"Course Chapter",
			chapter.name,
			{field: _rewrite_url(chapter[field]) for field in URL_FIELDS},
			update_modified=False,
		)
	return len(chapters)


def _rewrite_url(url: str | None) -> str | None:
	if url and url.startswith(LEGACY_URL_PREFIX):
		return "/scorm/" + url.removeprefix(LEGACY_URL_PREFIX)
	return url


def relocate(legacy_roots: list, private_root: str, superseded_root: str) -> dict:
	"""Move every <course>/<title> package under the legacy roots into private_root, parking the ones whose destination is already taken under superseded_root."""
	summary = {"moved": 0, "superseded": 0, "skipped_symlinks": 0, "skipped_files": 0, "unclaimed": 0}

	packages = []
	for root in legacy_roots:
		if os.path.isdir(root):
			packages.extend(_scan(root, summary))

	# Every package moves in this one run: both roots live in the site directory, so a move
	# is a rename, and the tree stopped growing at 68e7b210e.
	failures = []

	for course, title, source in packages:
		destination = os.path.join(private_root, course, title)
		outcome = "moved"
		if os.path.exists(destination):
			# Re-uploaded since June, so this public copy is a stale orphan. Park it, never delete.
			# Both legacy roots, or an earlier run, may have parked the same package already.
			destination = _free_path(os.path.join(superseded_root, course, title))
			outcome = "superseded"

		try:
			os.makedirs(os.path.dirname(destination), exist_ok=True)
			shutil.move(source, destination)
			summary[outcome] += 1
		except OSError as e:
			failures.append(f"{source} -> {destination}: {e}")

	for root in legacy_roots:
		_prune(root)

	summary["unclaimed"] = _report_unclaimed(packages)
	if summary["superseded"]:
		frappe.logger("lms").warning(
			f"move_public_scorm_to_private: parked {summary['superseded']} superseded package(s) under "
			f"{superseded_root}. Nothing serves them; delete them once the re-uploaded copies are confirmed."
		)

	# Frappe records a patch complete on return, so anything left behind must throw.
	if failures:
		listed = "\n".join(failures)
		frappe.throw(f"Could not relocate {len(failures)} SCORM package(s):\n{listed}")

	return summary


def _free_path(path: str) -> str:
	"""path itself, or the first path.<n> that does not exist yet."""
	candidate, suffix = path, 1
	while os.path.lexists(candidate):
		candidate = f"{path}.{suffix}"
		suffix += 1
	return candidate


def _scan(public_root: str, summary: dict) -> list:
	"""Collect (course, title, path) for every package directory two levels deep, skipping symlinks and loose files."""
	packages = []
	skipped = []

	for course in sorted(os.listdir(public_root)):
		course_path = os.path.join(public_root, course)
		if os.path.islink(course_path):
			summary["skipped_symlinks"] += 1
			skipped.append(course_path)
			continue
		if not os.path.isdir(course_path):
			summary["skipped_files"] += 1
			skipped.append(course_path)
			continue

		for title in sorted(os.listdir(course_path)):
			package_path = os.path.join(course_path, title)
			if os.path.islink(package_path):
				summary["skipped_symlinks"] += 1
				skipped.append(package_path)
			elif os.path.isdir(package_path):
				packages.append((course, title, package_path))
			else:
				summary["skipped_files"] += 1
				skipped.append(package_path)

	if skipped:
		# Left where they are, so still served from public/.
		frappe.logger("lms").warning(
			f"move_public_scorm_to_private: left {len(skipped)} symlink(s) or loose file(s) in place: "
			f"{', '.join(skipped)}"
		)

	return packages


def _report_unclaimed(packages: list) -> int:
	"""Log relocated packages no SCORM chapter's scorm_package_path names: SCORMRenderer refuses those from now on."""
	if not packages or not frappe.db.table_exists("Course Chapter"):
		return 0

	claimed = set(
		frappe.get_all("Course Chapter", filters={"is_scorm_package": 1}, pluck="scorm_package_path")
	)
	unclaimed = [
		f"{course}/{title}"
		for course, title, _source in packages
		if f"/scorm/{course}/{title}" not in claimed
	]

	if unclaimed:
		frappe.logger("lms").warning(
			f"move_public_scorm_to_private: {len(unclaimed)} relocated package(s) match no SCORM chapter and "
			f"are now refused by SCORMRenderer: {', '.join(sorted(unclaimed)[:20])}"
		)

	return len(unclaimed)


def _prune(public_root: str) -> None:
	"""Drop emptied course dirs and the legacy root. Best effort: an empty directory serves nothing."""
	try:
		for course in os.listdir(public_root):
			course_path = os.path.join(public_root, course)
			if os.path.isdir(course_path) and not os.path.islink(course_path) and not os.listdir(course_path):
				os.rmdir(course_path)

		if not os.listdir(public_root):
			os.rmdir(public_root)
	except OSError:
		pass
