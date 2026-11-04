import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import slugify


# Guards assessments being named from their titles, like quizzes since #357.
# Came with this branch's title-based naming for assignments and exercises.
# Added on feat/assessment-visual-redesign; a slug can be `new` or `submissions`.
class TestAssessmentNaming(BaseTestUtils):
	def _insert(self, doctype: str, title: str):
		fields = {
			"LMS Assignment": {
				"type": "Text",
				"question": "<p>Explain the difference between a list and a tuple.</p>",
			},
			"LMS Programming Exercise": {
				"problem_statement": "<p>Reverse a string.</p>",
				"language": "Python",
				"test_cases": [{"input": "2", "expected_output": "3"}],
			},
			"LMS Quiz": {"passing_percentage": 50, "total_marks": 10},
		}[doctype]
		doc = frappe.get_doc({"doctype": doctype, "title": title, **fields}).insert()
		return doc

	def test_every_assessment_type_is_named_from_its_title(self):
		for doctype in ("LMS Assignment", "LMS Programming Exercise", "LMS Quiz"):
			with self.subTest(doctype=doctype):
				title = f"Weekly Essay {frappe.generate_hash(length=8)}"

				doc = self._insert(doctype, title)

				self.assertEqual(doc.name, slugify(title))

	def test_a_repeated_title_is_suffixed_rather_than_colliding(self):
		# The name is the primary key, so a second document under the same slug
		# would be a DuplicateEntryError, not a silent overwrite.
		title = f"Weekly Essay {frappe.generate_hash(length=8)}"

		first = self._insert("LMS Assignment", title)
		second = self._insert("LMS Assignment", title)

		self.assertEqual(second.name, f"{first.name}-2")

	def test_a_docname_survives_a_retitle(self):
		# autoname runs on insert only, so bookmarks and lesson blocks keep working.
		doc = self._insert("LMS Assignment", f"Weekly Essay {frappe.generate_hash(length=8)}")
		original = doc.name

		doc.title = f"Fortnightly Essay {frappe.generate_hash(length=8)}"
		doc.save()

		self.assertEqual(doc.name, original)

	def test_a_slug_can_take_the_shape_the_edit_segment_defends_against(self):
		# Why /assignments/:assignmentID cannot be the form's address.
		doc = self._insert("LMS Assignment", "Submissions")

		self.assertIn(doc.name, ("submissions", *(f"submissions-{n}" for n in range(2, 50))))

	def test_a_title_slugging_to_new_does_not_take_the_create_route(self):
		# Guards "New" slugging to `new`, which the edit forms read as create mode.
		# Came with this branch's title-based naming for assignments and exercises.
		# Added on feat/assessment-visual-redesign to pin the reserved-slug check.
		for doctype in ("LMS Assignment", "LMS Programming Exercise"):
			with self.subTest(doctype=doctype):
				self.assertNotEqual(self._insert(doctype, "New").name, "new")
