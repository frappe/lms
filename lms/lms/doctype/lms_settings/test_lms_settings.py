# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import frappe
from frappe.tests import IntegrationTestCase


class TestSidebarItemSchema(IntegrationTestCase):
	def test_the_row_carries_the_fields_the_sidebar_page_writes(self):
		meta = frappe.get_meta("LMS Sidebar Item")
		for fieldname in (
			"name1",
			"is_standard",
			"item_type",
			"hidden",
			"url",
			"open_in_new_window",
			"web_page",
			"icon",
		):
			self.assertTrue(meta.has_field(fieldname), f"missing field: {fieldname}")


# Passing without completion gates nothing, so the settings never store it.
# Added on fix/course-progress-enforcement (no PR yet).
class TestPassingNeedsCompletion(IntegrationTestCase):
	def test_turning_completion_off_turns_its_passing_off(self):
		settings = frappe.get_single("LMS Settings")
		settings.update(
			{
				"enforce_quiz_completion": 0,
				"enforce_quiz_passing": 1,
				"enforce_open_ended_quiz_passing": 1,
				"enforce_assignment_completion": 1,
				"enforce_assignment_passing": 1,
			}
		)
		settings.validate_passing_needs_completion()
		self.assertEqual(settings.enforce_quiz_passing, 0)
		self.assertEqual(settings.enforce_open_ended_quiz_passing, 0)
		self.assertEqual(settings.enforce_assignment_passing, 1)


class TestShowGuestLanding(IntegrationTestCase):
	def test_field_exists_and_defaults_to_off(self):
		field = frappe.get_meta("LMS Settings").get_field("show_guest_landing")
		self.assertIsNotNone(field)
		self.assertEqual(field.fieldtype, "Check")
		self.assertEqual(str(field.default), "0")

	def test_guest_reads_the_flag_from_get_lms_settings(self):
		from lms.lms.api import get_lms_settings

		frappe.set_user("Guest")
		self.addCleanup(frappe.set_user, "Administrator")
		self.assertIn("show_guest_landing", get_lms_settings())
