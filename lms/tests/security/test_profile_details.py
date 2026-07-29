import frappe

from lms.lms.api import get_profile_details
from lms.lms.test_helpers import BaseTestUtils


class TestProfileDetails(BaseTestUtils):
	"""`get_profile_details` checked `has_lms_role()` against the *caller*, so a
	user holding no LMS role could not load their own profile page. Every user
	created through the LMS picks up `LMS Student` via the `before_insert` hook,
	but users created in Desk, by Data Import or by another app do not — they hit
	a dead profile.

	Widening that must not reopen the username-enumeration hole the earlier
	security work closed: a caller with no LMS role still gets the same
	PermissionError whether or not the username exists.
	"""

	USERS = {
		"member": ("profile-member@example.com", ["LMS Student"], "profilemember"),
		"roleless": ("profile-roleless@example.com", [], "profileroleless"),
	}

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		original_in_import = frappe.flags.in_import
		frappe.flags.in_import = True
		try:
			for attr, (email, roles, username) in cls.USERS.items():
				if not frappe.db.exists("User", email):
					user = frappe.new_doc("User")
					user.update(
						{
							"email": email,
							"first_name": attr,
							"username": username,
							"user_type": "Website User",
							"send_welcome_email": False,
						}
					)
					for role in roles:
						user.append("roles", {"role": role})
					user.insert(ignore_permissions=True)
				# The LMS before_insert hook grants LMS Student; strip it back off
				# so "no LMS role" really means none. `frappe.get_roles` memoises
				# per user, so the cache has to go too or the role lingers.
				if not roles:
					frappe.db.delete("Has Role", {"parent": email})
					frappe.clear_cache(user=email)
				frappe.db.set_value("User", email, "username", username, update_modified=False)
				setattr(cls, attr, frappe._dict(email=email, username=username))
		finally:
			frappe.flags.in_import = original_in_import
		frappe.db.commit()

	def setUp(self):
		super().setUp()
		self.original_user = frappe.session.user
		self.addCleanup(self._restore_user)

	def _restore_user(self):
		frappe.session.user = self.original_user

	def test_user_without_an_lms_role_can_load_their_own_profile(self):
		frappe.session.user = self.roleless.email
		details = get_profile_details(self.roleless.username)

		self.assertEqual(details.name, self.roleless.email)

	def test_user_without_an_lms_role_cannot_load_someone_elses(self):
		frappe.session.user = self.roleless.email
		with self.assertRaises(frappe.PermissionError):
			get_profile_details(self.member.username)

	def test_lms_member_can_load_another_profile(self):
		frappe.session.user = self.member.email
		details = get_profile_details(self.roleless.username)

		self.assertEqual(details.name, self.roleless.email)

	def test_unknown_username_does_not_leak_existence_to_a_roleless_caller(self):
		"""Same error for a real username and a made-up one, so the endpoint
		can't be used to enumerate accounts."""
		frappe.session.user = self.roleless.email

		with self.assertRaises(frappe.PermissionError):
			get_profile_details(self.member.username)
		with self.assertRaises(frappe.PermissionError):
			get_profile_details("no-such-username-at-all")

	def test_unknown_username_raises_does_not_exist_for_a_member(self):
		frappe.session.user = self.member.email
		with self.assertRaises(frappe.DoesNotExistError):
			get_profile_details("no-such-username-at-all")

	def test_non_string_username_is_rejected(self):
		frappe.session.user = self.member.email
		for bad in (["a"], {"b": 1}, 7, "", "   "):
			with self.assertRaises((frappe.ValidationError, frappe.exceptions.FrappeTypeError)):
				get_profile_details(bad)
