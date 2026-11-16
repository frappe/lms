from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils.fixtures import sync_fixtures

from lms import install

USER_FIELDS = {
	"country",
	"verify_terms",
	"user_category",
	"cover_image",
	"open_to",
	"linkedin",
	"github",
	"twitter",
	"medium",
	"profession",
	"hide_private",
	"education_details",
	"education",
	"work_experience_details",
	"work_experience",
	"internship",
	"certification_details",
	"certification",
	"skill_details",
	"skill",
	"carrer_preference_details",
	"preferred_functions",
	"preferred_location",
	"career_preference_column",
	"preferred_industries",
	"dream_companies",
	"work_environment",
	"attire",
	"collaboration",
	"role",
	"work_environment_column",
	"location_preference",
	"time",
	"company_type",
	"headline",
	"city",
	"college",
	"branch",
}

SEEDED = {
	"LMS Category": ["Web Development", "Business", "Design", "Personal Development", "Finance"],
	"Function": ["Consulting", "Legal", "Product", "Other"],
	"Industry": ["Accounting", "Architecture", "Engineering", "Other"],
}


def user_field_names():
	return set(
		frappe.get_all(
			"Custom Field",
			filters={"dt": "User", "fieldname": ["in", list(USER_FIELDS)]},
			pluck="fieldname",
		)
	)


class TestInstall(IntegrationTestCase):
	def tearDown(self):
		frappe.db.rollback()
		frappe.clear_cache(doctype="User")

	def test_migrate_keeps_a_deleted_category_deleted(self):
		"""Regression: the fixtures hook (#1025) re-imported deleted categories on every migrate.
		Added for audit finding #67."""
		frappe.get_doc({"doctype": "LMS Category", "category": "Business"}).insert(ignore_if_duplicate=True)
		frappe.db.delete("LMS Category", "Business")

		sync_fixtures("lms")

		self.assertFalse(frappe.db.exists("LMS Category", "Business"))

	def test_migrate_keeps_a_customised_user_field(self):
		"""Regression: the bare Custom Field fixture (#149) reverted User field edits on migrate.
		Added for audit finding #68."""
		frappe.db.set_value("Custom Field", "User-attire", {"label": "Dress code", "hidden": 1})

		sync_fixtures("lms")

		field = frappe.db.get_value("Custom Field", "User-attire", ["label", "hidden"], as_dict=True)
		self.assertEqual((field.label, field.hidden), ("Dress code", 1))

	def test_install_seeds_the_shipped_records(self):
		"""Control: without the fixtures hook (#1025) a fresh install still seeds. Audit finding #67."""
		for doctype, names in SEEDED.items():
			frappe.db.delete(doctype, {"name": ["in", names]})

		install.create_default_records()

		for doctype, names in SEEDED.items():
			for name in names:
				self.assertTrue(frappe.db.exists(doctype, name), f"{doctype} {name}")

	def test_install_creates_every_user_field(self):
		"""Control: without the fixture (#149) a fresh install still gets the fields. Audit finding #68."""
		frappe.db.delete("Custom Field", {"dt": "User", "fieldname": ["in", list(USER_FIELDS)]})

		# The columns are already there, and updatedb commits, which would keep the deletes.
		with patch.object(frappe.db, "updatedb"):
			install.create_user_custom_fields()

		self.assertEqual(user_field_names(), USER_FIELDS)
		field = frappe.db.get_value(
			"Custom Field", "User-preferred_functions", ["fieldtype", "options", "insert_after"], as_dict=True
		)
		self.assertEqual(
			(field.fieldtype, field.options, field.insert_after),
			("Table MultiSelect", "Preferred Function", "carrer_preference_details"),
		)

	def test_user_fields_ship_in_the_shape_create_custom_fields_takes(self):
		"""Loaded as is, so no export keys (name, dt, modified...) and nothing blank."""
		custom_fields = install.load_install_data("custom_field.json")

		self.assertEqual(list(custom_fields), ["User"])
		self.assertEqual({field["fieldname"] for field in custom_fields["User"]}, USER_FIELDS)
		for field in custom_fields["User"]:
			self.assertFalse({"name", "doctype", "dt", "modified", "module"} & field.keys(), field)
			self.assertNotIn(None, field.values(), field)

	def test_uninstall_removes_only_lms_user_fields(self):
		"""Regression: delete_custom_fields (#395) matched fieldnames on every doctype and missed three.
		Added for audit findings #69 and #99."""
		for dt, fieldname in (("ToDo", "city"), ("Note", "branch"), ("ToDo", "twitter")):
			frappe.get_doc(
				{
					"doctype": "Custom Field",
					"name": f"{dt}-{fieldname}",
					"dt": dt,
					"fieldname": fieldname,
					"label": fieldname,
					"fieldtype": "Data",
				}
			).db_insert()

		install.delete_custom_fields()

		self.assertEqual(user_field_names(), set())
		for name in ("ToDo-city", "Note-branch", "ToDo-twitter"):
			self.assertTrue(frappe.db.exists("Custom Field", name), name)
