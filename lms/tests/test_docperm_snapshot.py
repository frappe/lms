# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

import json
from pathlib import Path

import frappe
from frappe.modules.utils import get_module_list
from frappe.tests.utils import FrappeTestCase

BASELINE = Path(__file__).parent / "docperms.json"

# Roles a self-signup user can hold, or an authoring user can be given without
# an administrator's involvement. A grant to any of these is the interesting case.
WATCHED_ROLES = ("LMS Student", "Course Creator", "Batch Evaluator", "Moderator", "All", "Guest")

PTYPES = ("read", "write", "create", "delete", "submit", "cancel", "share", "report", "export")


def _snapshot():
	# The app's own modules, read from lms/modules.txt rather than matched with a
	# LIKE pattern: the app ships both "LMS" and "Job", and a "%LMS%" filter drops
	# every Job doctype without saying so.
	modules = get_module_list("lms")
	out = {}
	for name in frappe.get_all("DocType", filters={"module": ("in", modules)}, pluck="name"):
		meta = frappe.get_meta(name)
		roles = {}
		for perm in meta.permissions:
			if perm.role not in WATCHED_ROLES:
				continue
			granted = [p for p in PTYPES if perm.get(p)]
			if granted:
				key = f"{perm.role}#{perm.permlevel}" + ("#if_owner" if perm.if_owner else "")
				roles[key] = granted
		if roles:
			out[name] = roles
	return out


class TestDocPermSnapshot(FrappeTestCase):
	def test_snapshot_covers_both_app_modules(self):
		modules = set(get_module_list("lms"))
		self.assertEqual(
			modules,
			{"LMS", "Job"},
			"lms/modules.txt changed. Regenerate lms/tests/docperms.json so the new "
			"module's doctypes are covered — a module missing from the snapshot is "
			"invisible to the test below, not absent from the REST API.",
		)

	def test_docperms_match_baseline(self):
		expected = json.loads(BASELINE.read_text())
		actual = _snapshot()
		self.assertEqual(
			actual,
			expected,
			"low-privilege DocPerms changed. Every diff here widens or narrows what a "
			"self-signup user can reach through the generic REST API, which is a "
			"separate door from the app's whitelisted endpoints. Update "
			"lms/tests/docperms.json in the same commit if the change is intended.",
		)
