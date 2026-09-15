# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import nowdate

from lms import hooks
from lms.lms.doctype.lms_live_class.lms_live_class import LMSLiveClass
from lms.lms.test_helpers import BaseTestUtils

# Doctypes deliberately registered in only one hook. Adding a name here is a
# reviewed decision: state why the other half cannot exist.
PAIR_EXEMPT = {
	# File is a framework doctype; its list surface is governed by frappe core.
	"File",
}


class TestPermissionPairs(FrappeTestCase):
	def test_every_has_permission_hook_has_a_query_condition(self):
		has_perm = set(hooks.has_permission) - PAIR_EXEMPT
		query_cond = set(hooks.permission_query_conditions)
		missing = sorted(has_perm - query_cond)
		self.assertEqual(
			missing,
			[],
			f"has_permission without permission_query_conditions: {missing}. "
			"A has_permission hook is not consulted on list queries, so these "
			"doctypes enforce their rule on the single-doc read and drop it on "
			"the list read.",
		)

	def test_every_query_condition_has_a_has_permission_hook(self):
		has_perm = set(hooks.has_permission)
		query_cond = set(hooks.permission_query_conditions) - PAIR_EXEMPT
		missing = sorted(query_cond - has_perm)
		self.assertEqual(
			missing,
			[],
			f"permission_query_conditions without has_permission: {missing}. "
			"The list read is filtered but the single-doc read is not.",
		)


class TestLiveClassListRead(BaseTestUtils):
	"""The audit's exact repro: 403 on the single doc, 200 with every row on the list.

	`frappe.get_all` is not usable here — it sets `ignore_permissions=True`, so it
	bypasses the very condition under test. Only `frappe.get_list` runs it.
	"""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		instructor = self._create_user(
			"pairtest-instructor@example.com", "Pair", "Instructor", ["Course Creator"]
		)
		course = self._create_course(title="Pair Test Course", instructor=instructor.name)
		self._create_evaluator(evaluator_email=instructor.name)
		self.batch = self._create_batch(
			course.name,
			instructor=instructor.name,
			title="Pair Test Batch",
			evaluator=instructor.name,
		)
		live_class = frappe.new_doc("LMS Live Class")
		live_class.update(
			{
				"title": "Pair Test Live Class",
				"batch_name": self.batch.name,
				"date": nowdate(),
				"time": "09:00:00",
				"duration": 60,
				"timezone": "Asia/Kolkata",
				"host": "Administrator",
				"start_url": "https://zoom.example/s/1?zak=PAIR_TEST_CANARY",
			}
		)
		# after_insert throws unless a Google Calendar is configured, which this
		# test has no use for — the condition under test never reads the event.
		with patch.object(LMSLiveClass, "create_calendar_event"):
			live_class.insert()
		self.cleanup_items.append(("LMS Live Class", live_class.name))
		self.live_class = live_class.name

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def test_unenrolled_user_sees_no_live_classes_in_a_list_read(self):
		outsider = self._create_user("pairtest-outsider@example.com", "Pair", "Outsider", [])

		visible_to_admin = frappe.get_list("LMS Live Class", pluck="name", limit_page_length=0)
		self.assertIn(
			self.live_class,
			visible_to_admin,
			"control failed: the fixture row is not visible even to Administrator",
		)

		frappe.set_user(outsider.name)
		roles = frappe.get_roles(outsider.name)
		self.assertNotIn("Moderator", roles)
		self.assertNotIn("Batch Evaluator", roles)
		self.assertFalse(
			frappe.db.exists("LMS Batch Enrollment", {"batch": self.batch.name, "member": outsider.name})
		)

		visible = frappe.get_list("LMS Live Class", pluck="name", limit_page_length=0)
		self.assertNotIn(
			self.live_class,
			visible,
			"an unenrolled user must see no live classes of batches they are not in",
		)
