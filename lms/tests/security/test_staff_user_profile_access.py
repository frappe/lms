import frappe
from frappe.client import get_list, get_value
from frappe.desk.search import search_link

from lms.install import give_user_list_permission
from lms.lms.api import search_users_by_role
from lms.lms.test_helpers import BaseTestUtils

SELECT_ONLY_ROLES = ("Course Creator", "Batch Evaluator")


class TestStaffUserProfileAccess(BaseTestUtils):
	"""Course Creators and Batch Evaluators pick users; they do not read profiles."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.student = cls._create_user(f"supa-stud-{hash}@example.com", "Supa", "Student", ["LMS Student"])
		frappe.db.set_value("User", cls.student.name, {"mobile_no": "+911234567890", "location": "Pune"})
		cls.staff = {
			role: cls._create_user(
				f"supa-{role[:6].lower().strip()}-{hash}@example.com", "Supa", role, [role]
			)
			for role in SELECT_ONLY_ROLES
		}
		cls.moderator = cls._create_user(f"supa-mod-{hash}@example.com", "Supa", "Moderator", ["Moderator"])

	def setUp(self):
		# Inside the per-test savepoint, so the fresh grant never outlives the test.
		super().setUp()
		frappe.db.delete("Custom DocPerm", {"parent": "User", "role": ["in", SELECT_ONLY_ROLES]})
		give_user_list_permission()
		frappe.clear_cache(doctype="User")

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()
		frappe.clear_cache(doctype="User")

	def _perm(self, role):
		return frappe.db.get_value(
			"Custom DocPerm",
			{"parent": "User", "role": role, "permlevel": 0},
			["read", "select"],
			as_dict=True,
		)

	def test_a_fresh_install_grants_select_without_read(self):
		for role in SELECT_ONLY_ROLES:
			with self.subTest(role=role):
				self.assertEqual(self._perm(role), {"read": 0, "select": 1})
		self.assertEqual(self._perm("Moderator"), {"read": 1, "select": 1})

	def test_staff_cannot_read_another_users_profile(self):
		for role, user in self.staff.items():
			with self.subTest(role=role):
				frappe.set_user(user.name)
				self.assertFalse(get_value("User", "mobile_no", self.student.name).get("mobile_no"))
				with self.assertRaises(frappe.PermissionError):
					frappe.get_doc("User", self.student.name).check_permission("read")
				rows = get_list(
					"User",
					fields=["name", "mobile_no", "location"],
					filters={"name": self.student.name},
				)
				self.assertEqual(rows, [{"name": self.student.name}])

	def test_staff_can_still_pick_a_user(self):
		for role, user in self.staff.items():
			with self.subTest(role=role):
				frappe.set_user(user.name)
				found = search_link("User", self.student.name)
				self.assertIn(self.student.name, [row["value"] for row in found])
				picked = search_users_by_role(roles=["LMS Student"], names=[self.student.name])
				self.assertEqual(picked[0]["value"], self.student.name)
				self.assertEqual(set(picked[0]), {"value", "label", "description", "user_image"})

	def test_a_moderator_still_reads_profiles(self):
		frappe.set_user(self.moderator.name)
		row = get_value("User", "mobile_no", self.student.name)
		self.assertEqual(row["mobile_no"], "+911234567890")
