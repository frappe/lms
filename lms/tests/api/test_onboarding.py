import frappe

from lms.lms.onboarding import get_first_batch, get_first_course
from lms.lms.test_helpers import BaseTestUtils, enforce_role_gates

ENDPOINTS = (get_first_course, get_first_batch)


class TestOnboarding(BaseTestUtils):
	def setUp(self):
		super().setUp()
		enforce_role_gates(self)

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

	def test_system_manager_may_call_both(self):
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
