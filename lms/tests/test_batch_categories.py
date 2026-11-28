import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_batch_categories


class TestBatchCategories(BaseTestUtils):
	"""The batch list's category chips come from every published batch, not the loaded rows."""

	def setUp(self):
		super().setUp()
		suffix = frappe.generate_hash(length=6)
		self.instructor = self._create_user(
			f"cat-instr-{suffix}@example.com", "Cat", "Instr", ["Moderator"]
		).name
		course = self._create_course(f"Category Course {suffix}", instructor=self.instructor).name
		self.shown = self._batch_in(course, f"Shown {suffix}", published=1)
		self.hidden = self._batch_in(course, f"Hidden {suffix}", published=0)

	def _batch_in(self, course, category, published):
		if not frappe.db.exists("LMS Category", category):
			frappe.get_doc({"doctype": "LMS Category", "category": category}).insert(ignore_permissions=True)
		batch = self._create_batch(
			course, instructor=self.instructor, title=f"Batch {category}", evaluator=None
		).name
		frappe.db.set_value("LMS Batch", batch, {"category": category, "published": published})
		return category

	def test_lists_published_batch_categories_after_a_clear_option(self):
		categories = get_batch_categories()
		self.assertEqual(categories[0], {"label": "", "value": None})
		values = [category["value"] for category in categories]
		self.assertIn(self.shown, values)
		self.assertNotIn(self.hidden, values)

	def test_a_guest_gets_nothing_while_guest_access_is_off(self):
		guest_access = frappe.db.get_single_value("LMS Settings", "allow_guest_access")
		self.addCleanup(self._set_guest_access, guest_access)
		self.addCleanup(frappe.set_user, "Administrator")
		self._set_guest_access(0)

		frappe.set_user("Guest")
		self.assertEqual(get_batch_categories(), [])

	def _set_guest_access(self, value):
		frappe.db.set_single_value("LMS Settings", "allow_guest_access", value)
		frappe.clear_document_cache("LMS Settings", "LMS Settings")
