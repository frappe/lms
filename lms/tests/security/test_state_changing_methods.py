# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

import frappe
from frappe.handler import is_valid_http_method
from frappe.utils import set_request

from lms.lms import api, utils
from lms.lms.doctype.lms_batch.lms_batch import create_google_meet_live_class, create_live_class
from lms.lms.test_helpers import BaseTestUtils

# Whitelisted methods whose effects do not roll back with the request: files
# removed from or written to disk, meetings and calendar events made elsewhere,
# enrolments paid for. frappe checks the CSRF token on POST only, so each must
# refuse GET.
STATE_CHANGING = [
	api.delete_chapter,
	api.delete_course,
	api.delete_batch,
	api.delete_documents,
	api.delete_programming_exercise,
	api.delete_category,
	api.delete_evaluator_slot,
	api.delete_sidebar_item,
	api.cancel_evaluation,
	api.import_course_from_zip,
	utils.enroll_in_batch,
	create_google_meet_live_class,
	create_live_class,
]

MISSING = object()


class TestStateChangingMethods(BaseTestUtils):
	"""A top-level link from another site sends the session cookie with a GET, and
	frappe only checks the CSRF token on POST. A delete reachable by GET let such a
	link remove a chapter's SCORM package from disk for a signed-in author."""

	def setUp(self):
		super().setUp()
		# Tests after this one must not find a request that was never theirs.
		self.request_before = getattr(frappe.local, "request", MISSING)

	def tearDown(self):
		if self.request_before is MISSING:
			if hasattr(frappe.local, "request"):
				del frappe.local.request
		else:
			frappe.local.request = self.request_before
		super().tearDown()

	def test_every_state_changing_method_is_post_only(self):
		for fn in STATE_CHANGING:
			with self.subTest(fn=fn.__name__):
				self.assertEqual(
					tuple(frappe.allowed_http_methods_for_whitelisted_func[fn]), ("POST",)
				)

	def test_get_is_refused_before_the_body_runs(self):
		for fn in STATE_CHANGING:
			with self.subTest(fn=fn.__name__):
				set_request(method="GET", path=f"/api/method/{fn.__module__}.{fn.__name__}")
				with self.assertRaises(frappe.PermissionError):
					is_valid_http_method(fn)
				set_request(method="POST", path=f"/api/method/{fn.__module__}.{fn.__name__}")
				is_valid_http_method(fn)
