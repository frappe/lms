import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_batch_categories


class TestBatchCategories(BaseTestUtils):
	"""The batch list's category chips come from every published batch, not the loaded rows."""

	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6)
		self.instructor = self._create_user(
			f"cat-instr-{hash}@example.com", "Cat", "Instr", ["Moderator"]
		).name
		course = self._create_course(f"Category Course {hash}", instructor=self.instructor).name
		self.shown = self._batch_in(course, f"Shown {hash}", published=1)
		self.hidden = self._batch_in(course, f"Hidden {hash}", published=0)

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
