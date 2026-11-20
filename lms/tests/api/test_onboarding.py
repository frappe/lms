from unittest.mock import patch

import frappe
from frappe.utils.password import update_password

from lms.lms.onboarding import (
	FIRST_GOAL,
	get_first_course,
	get_setup_state,
	needs_password_setup,
	save_setup,
	set_first_password,
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

		# CI sites never run the setup wizard, which would send every admin there first.
		with patch("frappe.is_setup_complete", return_value=True):
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


class TestFirstPassword(BaseTestUtils):
	"""A Frappe Cloud trial owner arrives signed in without a password, on a v2 site with email
	login links on, which Frappe's own check skips; Learning's setup still asks for one."""

	def setUp(self):
		super().setUp()
		self.owner = self._create_user(
			"cloud.owner@example.com", "Cloud", "Owner", roles=["System Manager"], user_type="System User"
		)
		frappe.db.delete("__Auth", {"doctype": "User", "name": self.owner.name})

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def system_settings(self, **values):
		"""System Settings read as these values, without saving them: saving needs a language and
		time zone, which a CI site that never ran the setup wizard does not have."""
		read = frappe.get_system_settings
		return patch(
			"frappe.get_system_settings",
			side_effect=lambda key: values[key] if key in values else read(key),
		)

	def as_trial_site(self):
		return patch.dict(
			frappe.conf, {"pilot_endpoint": "https://pilot.example.com", "pilot_auth_token": "t"}
		)

	def test_a_trial_owner_without_a_password_is_asked_for_one(self):
		with self.as_trial_site(), self.system_settings(login_with_email_link=1):
			self.assertTrue(needs_password_setup(self.owner.name))

	def test_the_password_step_saves_on_a_trial_site(self):
		from frappe.utils.password import check_password

		with self.as_trial_site(), self.system_settings(login_with_email_link=1):
			frappe.set_user(self.owner.name)
			set_first_password("Eastern_43A1W")
			frappe.set_user("Administrator")
			self.assertFalse(needs_password_setup(self.owner.name))
		self.assertEqual(check_password(self.owner.name, "Eastern_43A1W"), self.owner.name)

	def test_the_framework_password_step_reaches_learnings_check(self):
		overrides = frappe.get_hooks("override_whitelisted_methods")
		self.assertEqual(
			overrides.get("frappe.core.doctype.user.user.set_first_password"),
			["lms.lms.onboarding.set_first_password"],
		)

	def test_a_user_with_a_password_cannot_use_it(self):
		update_password(self.owner.name, "Eastern_43A1W")
		frappe.set_user(self.owner.name)
		self.assertRaises(frappe.PermissionError, set_first_password, "Another_43A1W")

	def test_not_asked_where_a_password_cannot_sign_in(self):
		self.assertFalse(needs_password_setup("Administrator"))
		with self.system_settings(disable_user_pass_login=1):
			self.assertFalse(needs_password_setup(self.owner.name))
		self.owner.append("social_logins", {"provider": "google", "userid": "1234"})
		self.owner.save()
		self.assertFalse(needs_password_setup(self.owner.name))
