import frappe
from frappe.client import get as client_get
from frappe.client import get_list
from frappe.desk.search import search_link

from lms.lms.test_helpers import BaseTestUtils
from lms.patches.v2_0.revoke_staff_user_read import execute

SELECT_ONLY_ROLES = ("Course Creator", "Batch Evaluator")
PTYPES = ("read", "select", "write", "create", "delete", "if_owner")
ROW_FILTERS = {"parent": "User", "permlevel": 0, "role": ["in", (*SELECT_ONLY_ROLES, "Moderator")]}


class TestRevokeStaffUserReadPatch(BaseTestUtils):
	"""Sites installed before select-only User access keep a read=1 row that
	create_role never revisits; the patch takes read back and keeps select."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.snapshot = frappe.get_all("Custom DocPerm", ROW_FILTERS, ["name", "role", *PTYPES])
		cls.addClassCleanup(cls._restore_rows)
		hash = frappe.generate_hash(length=6)
		cls.student = cls._create_user(f"rsur-stud-{hash}@example.com", "Rsur", "Student", ["LMS Student"])
		cls.location = f"Pune {hash}"
		frappe.db.set_value("User", cls.student.name, "location", cls.location)
		cls.staff = {
			role: cls._create_user(f"rsur-{role.split()[0].lower()}-{hash}@example.com", "Rsur", role, [role])
			for role in SELECT_ONLY_ROLES
		}
		cls.moderator = cls._create_user(f"rsur-mod-{hash}@example.com", "Rsur", "Moderator", ["Moderator"])

	@classmethod
	def _restore_rows(cls):
		"""Each test's savepoint undoes its seeding; this catches a commit that slipped
		past it, since Custom DocPerm writes would then outlive the runner's rollback.
		The rollback first keeps the fixture users from being committed with them."""
		frappe.db.rollback()
		if frappe.get_all("Custom DocPerm", ROW_FILTERS, ["name", "role", *PTYPES]) == cls.snapshot:
			return
		frappe.db.delete("Custom DocPerm", ROW_FILTERS)
		for row in cls.snapshot:
			doc = frappe.new_doc("Custom DocPerm")
			doc.update({"parent": "User", "parenttype": "DocType", "parentfield": "permissions"})
			doc.update({"role": row.role, "permlevel": 0, **{ptype: row[ptype] for ptype in PTYPES}})
			doc.name = row.name
			doc.db_insert()
		frappe.db.commit()  # nosemgrep
		frappe.clear_cache(doctype="User")

	def setUp(self):
		super().setUp()
		self._seed_pre_fix_rows()

	def tearDown(self):
		super().tearDown()
		frappe.clear_cache(doctype="User")

	def _seed_pre_fix_rows(self):
		"""The rows an install before select-only User access left behind."""
		frappe.db.delete("Custom DocPerm", ROW_FILTERS)
		for role in (*SELECT_ONLY_ROLES, "Moderator"):
			frappe.get_doc(
				{
					"doctype": "Custom DocPerm",
					"parent": "User",
					"parenttype": "DocType",
					"parentfield": "permissions",
					"role": role,
					"permlevel": 0,
					"read": 1,
					"select": 1,
				}
			).db_insert()
		frappe.clear_cache(doctype="User")

	def _row(self, role):
		return frappe.db.get_value(
			"Custom DocPerm",
			{"parent": "User", "role": role, "permlevel": 0},
			["read", "select"],
			as_dict=True,
		)

	def test_staff_read_the_profile_before_the_patch(self):
		"""Control: without the patch the leak is there to fix."""
		for role, user in self.staff.items():
			with self.subTest(role=role):
				frappe.set_user(user.name)
				self.assertEqual(client_get("User", self.student.name)["location"], self.location)

	def test_patch_takes_read_and_keeps_select(self):
		"""Staff kept read on User from earlier installs. Added for security#681."""
		execute()
		for role in SELECT_ONLY_ROLES:
			with self.subTest(role=role):
				self.assertEqual(self._row(role), {"read": 0, "select": 1})

	def test_staff_cannot_open_profiles_after_the_patch(self):
		"""Staff could open any profile. Added for security#681."""
		execute()
		for role, user in self.staff.items():
			with self.subTest(role=role):
				frappe.set_user(user.name)
				with self.assertRaises(frappe.PermissionError):
					client_get("User", self.student.name)
				rows = get_list("User", fields=["name", "location"], filters={"name": self.student.name})
				self.assertEqual(rows, [{"name": self.student.name}])

	def test_staff_still_pick_users_after_the_patch(self):
		"""Control: select stays, so user pickers keep working (security#681)."""
		execute()
		for role, user in self.staff.items():
			with self.subTest(role=role):
				frappe.set_user(user.name)
				found = search_link("User", self.student.name)
				self.assertIn(self.student.name, [row["value"] for row in found])

	def test_moderator_keeps_read(self):
		"""Control: the patch leaves Moderator alone (security#681)."""
		execute()
		self.assertEqual(self._row("Moderator"), {"read": 1, "select": 1})
		frappe.set_user(self.moderator.name)
		self.assertEqual(client_get("User", self.student.name)["location"], self.location)

	def test_patch_is_idempotent(self):
		"""A rerun patch must not change anything (security#681)."""
		execute()
		execute()
		for role in SELECT_ONLY_ROLES:
			with self.subTest(role=role):
				self.assertEqual(self._row(role), {"read": 0, "select": 1})

	def test_patch_creates_nothing_on_a_site_without_the_rows(self):
		"""Fresh sites have no row to revoke (security#681)."""
		frappe.db.delete("Custom DocPerm", {"parent": "User", "role": ["in", SELECT_ONLY_ROLES]})
		execute()
		self.assertFalse(
			frappe.db.exists("Custom DocPerm", {"parent": "User", "role": ["in", SELECT_ONLY_ROLES]})
		)
