import frappe

from lms.lms.api import (
	delete_sidebar_item,
	get_sidebar_settings,
	save_sidebar_items,
	update_sidebar_item,
)
from lms.lms.sidebar import ROW_FIELDS, seed_sidebar_items
from lms.lms.test_helpers import BaseTestUtils


class TestSidebar(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.settings = frappe.get_single("LMS Settings")
		self.settings.reload()
		# Content fields only -- a stale `name` here would make the reset try to
		# update rows a test's own save_sidebar_items() call already replaced,
		# silently restoring nothing rather than the original thirteen.
		self.original_rows = [
			{field: row.get(field) for field in ROW_FIELDS} for row in self.settings.sidebar_items
		]

	def tearDown(self):
		settings = frappe.get_single("LMS Settings")
		settings.reload()
		settings.set("sidebar_items", self.original_rows)
		settings.flags.ignore_permissions = True
		settings.save()
		super().tearDown()

	def test_seed_sidebar_items_is_idempotent(self):
		seed_sidebar_items()
		count_after_first = frappe.db.count("LMS Sidebar Item")

		seed_sidebar_items()

		self.assertEqual(frappe.db.count("LMS Sidebar Item"), count_after_first)

	def test_save_sidebar_items_requires_moderator(self):
		student = self._create_user(
			"sidebar.student@example.com", "Sidebar", "Student", roles=["LMS Student"]
		)
		self.cleanup_items.append(("User", student.name))

		frappe.set_user(student.name)
		try:
			self.assertRaises(frappe.PermissionError, save_sidebar_items, rows=[])
		finally:
			frappe.set_user("Administrator")

	def test_save_sidebar_items_replaces_the_table(self):
		# Every standard row must stay (save_sidebar_items refuses to drop one --
		# covered separately below), reordered with a new External row appended.
		rows = [
			{field: row.get(field) for field in ROW_FIELDS} for row in reversed(self.settings.sidebar_items)
		]
		rows.append(
			{
				"name1": "docs",
				"item_type": "External",
				"url": "https://docs.frappe.io/learning",
				"title": "Docs",
				"icon": "lucide-book",
			}
		)

		save_sidebar_items(rows=rows)

		self.settings.reload()
		names = [row.name1 for row in self.settings.sidebar_items]
		self.assertEqual(names, [row["name1"] for row in rows])

	def test_save_sidebar_items_rejects_a_deleted_standard_row(self):
		self.assertRaises(
			frappe.ValidationError,
			save_sidebar_items,
			rows=[],
		)

	def test_save_sidebar_items_rejects_hiding_home(self):
		rows = [
			{field: row.get(field) for field in ("name1", "is_standard", "item_type", "hidden")}
			for row in self.settings.sidebar_items
		]
		for row in rows:
			if row["name1"] == "home":
				row["hidden"] = 1

		self.assertRaises(frappe.ValidationError, save_sidebar_items, rows=rows)

	def test_save_sidebar_items_rejects_an_off_site_route(self):
		rows = [
			{
				"name1": "custom_route",
				"item_type": "Route",
				"route": "//evil.example.com",
				"title": "Escape",
				"icon": "lucide-link",
			}
		]

		self.assertRaises(frappe.ValidationError, save_sidebar_items, rows=rows)

	def test_update_sidebar_item_rejects_an_unpublished_page(self):
		self.assertRaises(
			frappe.ValidationError,
			update_sidebar_item,
			webpage="not-a-real-page",
		)

	def test_get_sidebar_settings_blocks_guest_without_guest_access(self):
		self.settings.reload()
		self.settings.allow_guest_access = 0
		self.settings.flags.ignore_permissions = True
		self.settings.save()

		frappe.set_user("Guest")
		try:
			self.assertEqual(get_sidebar_settings(), [])
		finally:
			frappe.set_user("Administrator")

	def test_get_sidebar_settings_hides_target_and_icon_on_a_hidden_row(self):
		rows = [
			{field: row.get(field) for field in ("name1", "is_standard", "item_type", "hidden", "icon")}
			for row in self.settings.sidebar_items
		]
		for row in rows:
			if row["name1"] == "batches":
				row["hidden"] = 1

		save_sidebar_items(rows=rows)

		result = get_sidebar_settings()
		batches_row = next(r for r in result.sidebar_rows if r["name1"] == "batches")
		self.assertEqual(batches_row["hidden"], 1)
		self.assertIsNone(batches_row["to"])
		self.assertIsNone(batches_row["icon"])

	def test_delete_sidebar_item_removes_only_the_matching_web_page_row(self):
		webpage = frappe.get_doc(
			{
				"doctype": "Web Page",
				"title": "Sidebar Test Page",
				"route": "sidebar-test-page",
				"published": 1,
			}
		).insert(ignore_permissions=True)
		self.cleanup_items.append(("Web Page", webpage.name))

		update_sidebar_item(webpage=webpage.name, icon="lucide-link")
		self.settings.reload()
		self.assertTrue(any(row.web_page == webpage.name for row in self.settings.sidebar_items))

		delete_sidebar_item(webpage=webpage.name)
		self.settings.reload()
		self.assertFalse(any(row.web_page == webpage.name for row in self.settings.sidebar_items))
