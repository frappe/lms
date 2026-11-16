import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.patches.v2_0.keep_quiz_completion_on_passing import PASSING_FIELDS, execute


# Guards that existing sites keep quizzes on a pass, as a fresh site's defaults do.
# Added on fix/course-progress-enforcement (no PR yet).
class TestKeepQuizCompletionOnPassingPatch(BaseTestUtils):
	def setUp(self):
		super().setUp()
		frappe.db.delete("Singles", {"doctype": "LMS Settings", "field": ["in", PASSING_FIELDS]})
		frappe.db.set_single_value("LMS Settings", "enforce_quiz_completion", 1)

	def _stored(self):
		stored = frappe.db.get_singles_dict("LMS Settings")
		return {field: value for field, value in stored.items() if field in PASSING_FIELDS}

	def test_unset_switches_are_turned_on_once(self):
		execute()
		execute()
		self.assertEqual(
			self._stored(), {"enforce_quiz_passing": "1", "enforce_open_ended_quiz_passing": "1"}
		)

	def test_a_site_not_gating_quizzes_is_left_alone(self):
		frappe.db.set_single_value("LMS Settings", "enforce_quiz_completion", 0)
		execute()
		self.assertEqual(self._stored(), {})

	def test_a_switch_an_admin_already_set_is_left_alone(self):
		frappe.db.set_single_value("LMS Settings", "enforce_quiz_passing", 0)
		execute()
		self.assertEqual(
			self._stored(), {"enforce_quiz_passing": "0", "enforce_open_ended_quiz_passing": "1"}
		)

	def test_a_site_that_never_saved_its_settings_is_left_alone(self):
		frappe.db.delete("Singles", {"doctype": "LMS Settings"})
		execute()
		self.assertEqual(frappe.db.get_singles_dict("LMS Settings"), {})
