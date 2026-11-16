import frappe
from frappe.utils.password import update_password

from lms.lms.onboarding import (
	FIRST_GOAL,
	get_first_course,
	get_setup_state,
	save_setup,
)
from lms.lms.test_helpers import BaseTestUtils

ENDPOINTS = (get_first_course, get_setup_state)


class TestOnboarding(BaseTestUtils):
	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def test_endpoints_are_whitelisted(self):
		for endpoint in ENDPOINTS:
			method = frappe.get_attr(f"lms.lms.onboarding.{endpoint.__name__}")
			frappe.is_whitelisted(method)

	def test_guest_is_refused(self):
		frappe.set_user("Guest")
		for endpoint in ENDPOINTS:
			self.assertRaises(frappe.PermissionError, endpoint)

	def test_student_is_refused(self):
		student = self._create_user(
			"onboarding.student@example.com", "Onboarding", "Student", roles=["LMS Student"]
		)
		frappe.set_user(student.name)
		for endpoint in ENDPOINTS:
			self.assertRaises(frappe.PermissionError, endpoint)

	def test_moderator_gets_the_first_course(self):
		moderator = self._create_user(
			"onboarding.moderator@example.com", "Onboarding", "Moderator", roles=["Moderator"]
		)
		self._create_course(instructor=moderator.name)
		first = frappe.get_all("LMS Course", order_by="creation", limit=1, pluck="name")
		frappe.set_user(moderator.name)
		self.assertEqual(get_first_course(), first[0])

	def test_system_manager_may_call_them(self):
		manager = self._create_user(
			"onboarding.manager@example.com",
			"Onboarding",
			"Manager",
			roles=["System Manager"],
			user_type="System User",
		)
		frappe.set_user(manager.name)
		for endpoint in ENDPOINTS:
			endpoint()

	def test_setup_is_only_for_system_managers(self):
		moderator = self._create_user(
			"onboarding.moderator@example.com", "Onboarding", "Moderator", roles=["Moderator"]
		)
		frappe.set_user(moderator.name)
		self.assertRaises(frappe.PermissionError, save_setup, "Publish my first course")

	def test_saving_setup_keeps_the_goal_and_stops_asking(self):
		manager = self._create_user(
			"onboarding.manager@example.com",
			"Onboarding",
			"Manager",
			roles=["System Manager"],
			user_type="System User",
		)
		update_password(manager.name, "Onboarding-manager-1")
		frappe.db.set_single_value("LMS Settings", "persona_captured", 0)
		self.addCleanup(frappe.defaults.clear_default, FIRST_GOAL)
		frappe.set_user(manager.name)

		save_setup("Onboard my existing learners")

		state = get_setup_state()
		self.assertFalse(state["needs_setup"])
		self.assertEqual(state["first_goal"], "Onboard my existing learners")

	def test_only_a_known_goal_is_saved(self):
		manager = self._create_user(
			"onboarding.manager@example.com",
			"Onboarding",
			"Manager",
			roles=["System Manager"],
			user_type="System User",
		)
		frappe.defaults.clear_default(FIRST_GOAL)
		frappe.set_user(manager.name)
		self.assertRaises(frappe.ValidationError, save_setup, "<script>alert(1)</script>")
		self.assertIsNone(frappe.db.get_default(FIRST_GOAL))
