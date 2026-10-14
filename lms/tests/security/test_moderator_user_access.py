# Copyright (c) 2026, Frappe and Contributors
# See license.txt

import frappe
from frappe.core.doctype.user.user import change_password

from lms.install import give_user_list_permission
from lms.lms.api import add_member, delete_member, update_member
from lms.lms.test_helpers import BaseTestUtils
from lms.patches.v2_0.limit_moderator_user_access import execute as limit_moderator_user_access


class TestModeratorUserAccess(BaseTestUtils):
	"""Moderators run the LMS: they see members, add website users through
	add_member and assign LMS roles. They do not edit user accounts."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.hash = hash
		cls.moderator = cls._create_user(f"muamod-{hash}@example.com", "Mo", "Derator", ["Moderator"])
		cls.creator = cls._create_user(f"muacc-{hash}@example.com", "Cy", "Creator", ["Course Creator"])
		cls.admin = cls._create_user(
			f"muasm-{hash}@example.com", "Sam", "Manager", ["System Manager"], user_type="System User"
		)

	def setUp(self):
		# Inside the per-test savepoint, so the grant never outlives the test.
		super().setUp()
		# What earlier installs left on a site, so the tests see the same grant.
		give_user_list_permission()
		frappe.db.set_value(
			"Custom DocPerm",
			{"parent": "User", "role": "Moderator", "permlevel": 0},
			{"write": 1, "create": 1},
		)
		limit_moderator_user_access()

	def tearDown(self):
		super().tearDown()
		# The rollback restores the rows; drop the permissions cached from them.
		frappe.clear_cache(doctype="User")

	def _moderator_perm(self):
		return frappe.db.get_value(
			"Custom DocPerm",
			{"parent": "User", "role": "Moderator", "permlevel": 0},
			["read", "write", "create", "delete"],
			as_dict=True,
		)

	def test_the_patch_leaves_moderators_read_only_on_users(self):
		self.assertEqual(self._moderator_perm(), {"read": 1, "write": 0, "create": 0, "delete": 0})

	def test_a_fresh_grant_is_read_only_for_moderators(self):
		frappe.db.delete("Custom DocPerm", {"parent": "User", "role": "Moderator", "permlevel": 0})
		give_user_list_permission()
		self.assertEqual(self._moderator_perm(), {"read": 1, "write": 0, "create": 0, "delete": 0})

	def test_a_moderator_cannot_change_a_system_managers_password(self):
		frappe.set_user(self.moderator.name)
		with self.assertRaises(frappe.PermissionError):
			change_password(self.admin.name, "Another-Pass-2026!")

	def test_a_moderator_cannot_edit_a_user(self):
		frappe.set_user(self.moderator.name)
		user = frappe.get_doc("User", self.admin.name)
		user.first_name = "Changed"
		with self.assertRaises(frappe.PermissionError):
			user.save()

	def test_a_moderator_cannot_create_a_user_directly(self):
		frappe.set_user(self.moderator.name)
		with self.assertRaises(frappe.PermissionError):
			frappe.get_doc(
				{"doctype": "User", "email": f"muadirect-{self.hash}@example.com", "first_name": "Di"}
			).insert()

	def test_a_moderator_adds_a_website_user(self):
		frappe.set_user(self.moderator.name)
		email = f"muanew-{self.hash}@example.com"
		member = add_member(email, "Nia", "New")

		self.assertEqual(member["name"], email)
		self.assertEqual(frappe.db.get_value("User", email, "user_type"), "Website User")

	def test_adding_an_existing_member_is_refused(self):
		frappe.set_user(self.moderator.name)
		with self.assertRaises(frappe.DuplicateEntryError):
			add_member(self.creator.name, "Cy")

	def test_only_a_moderator_adds_members(self):
		frappe.set_user(self.creator.name)
		with self.assertRaises(frappe.PermissionError):
			add_member(f"muacc2-{self.hash}@example.com", "Ann")

	def test_a_list_of_addresses_is_refused(self):
		frappe.set_user(self.moderator.name)
		with self.assertRaises(frappe.ValidationError):
			add_member(f"muaone-{self.hash}@example.com, muatwo-{self.hash}@example.com", "Two")

	def test_a_moderator_edits_a_members_profile(self):
		frappe.set_user(self.moderator.name)
		update_member(self.creator.name, {"last_name": "Renamed", "bio": "<p>Hi</p><form>x</form>"})

		row = frappe.db.get_value("User", self.creator.name, ["last_name", "bio"], as_dict=True)
		self.assertEqual(row.last_name, "Renamed")
		self.assertNotIn("<form", row.bio)

	def test_editing_a_member_leaves_the_account_fields_alone(self):
		frappe.set_user(self.moderator.name)
		update_member(
			self.creator.name, {"email": "taken@example.com", "enabled": 0, "user_type": "System User"}
		)

		row = frappe.db.get_value("User", self.creator.name, ["email", "enabled", "user_type"], as_dict=True)
		self.assertEqual(row, {"email": self.creator.name, "enabled": 1, "user_type": "Website User"})

	def test_a_moderator_cannot_edit_a_system_managers_profile(self):
		frappe.set_user(self.moderator.name)
		with self.assertRaises(frappe.PermissionError):
			update_member(self.admin.name, {"first_name": "Changed"})

	def test_a_moderator_cannot_delete_a_system_manager(self):
		frappe.set_user(self.moderator.name)
		with self.assertRaises(frappe.PermissionError):
			delete_member(self.admin.name)
		self.assertTrue(frappe.db.exists("User", self.admin.name))

	def test_only_a_moderator_edits_members(self):
		frappe.set_user(self.creator.name)
		with self.assertRaises(frappe.PermissionError):
			update_member(self.moderator.name, {"first_name": "Changed"})
