import io
import json
from contextlib import redirect_stdout

import frappe
from frappe.utils import escape_html

from lms.lms.test_helpers import BaseTestUtils
from lms.patches.v2_0.clean_lesson_content import execute

MANGLED = (
	'{"blocks":[{"type":"paragraph","data":{"text":"<a href="\\&quot;https://frappe.io/\\&quot;" '
	'rel="noopener noreferrer">here</a><script>alert(1)</script>"}}]}'
)


class TestCleanLessonContentPatch(BaseTestUtils):
	"""Rows saved before lesson content was fully cleaned on save. Seeded straight
	into the table, since a save would clean them."""

	def setUp(self):
		super().setUp()
		self._create_user("frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"])
		self.course = self._create_course(title="Clean Content Course")
		self.chapter = self._create_chapter("Clean Content Chapter", self.course.name)

	def _seed(self, title, content, instructor_content=None):
		lesson = self._create_lesson(title, self.chapter.name, self.course.name)
		frappe.db.set_value(
			"Course Lesson",
			lesson.name,
			{"content": content, "instructor_content": instructor_content},
			update_modified=False,
		)
		return lesson.name

	def _stored(self, name):
		return frappe.db.get_value("Course Lesson", name, ["content", "instructor_content", "modified"])

	def test_cleans_markup_in_a_key_and_a_value(self):
		name = self._seed(
			"Lesson with markup",
			json.dumps({"blocks": [{"type": "paragraph", "data": {"text": "<img src=x onerror=alert(1)>"}}]}),
			json.dumps({"<svg onload=alert(1)>": "x", "blocks": []}),
		)
		modified = self._stored(name)[2]
		execute()
		content, instructor_content, after = self._stored(name)
		self.assertNotIn("onerror", content)
		self.assertNotIn("onload", instructor_content)
		self.assertEqual(after, modified)

	def test_cleans_markup_spelled_as_json_escapes(self):
		content = '{"\\u003csvg onload=alert(1)\\u003e":"x","blocks":[{"type":"paragraph","data":{"text":"\\u003cimg src=x onerror=alert(1)\\u003e"}}]}'
		self.assertNotIn("<", content)
		name = self._seed("Lesson with escaped markup", content)
		execute()
		stored = self._stored(name)[0]
		self.assertNotIn("onerror", stored)
		self.assertNotIn("onload", stored)

	def test_repairs_and_cleans_a_row_the_old_sanitiser_mangled(self):
		name = self._seed("Mangled lesson", MANGLED)
		execute()
		text = json.loads(self._stored(name)[0])["blocks"][0]["data"]["text"]
		self.assertEqual(text, '<a href="https://frappe.io/" rel="noopener noreferrer">here</a>')

	def test_escapes_a_row_that_does_not_parse_and_names_it(self):
		broken = '{"blocks":[{"data":{"text":"<img src=x onerror=alert(1)>'
		name = self._seed("Broken lesson", broken, MANGLED)
		output = io.StringIO()
		with redirect_stdout(output):
			execute()
		content, instructor_content, _ = self._stored(name)
		self.assertEqual(content, escape_html(broken))
		self.assertNotIn("<script", instructor_content)
		self.assertIn(name, output.getvalue())

		# Neither a second run nor a save escapes it again.
		execute()
		frappe.get_doc("Course Lesson", name).save()
		self.assertEqual(self._stored(name)[0], escape_html(broken))

	def test_leaves_a_clean_row_untouched(self):
		# Spaced, unlike what a save writes, so any rewrite would show.
		content = json.dumps({"blocks": [{"type": "paragraph", "data": {"text": "<b>bold</b> é"}}]})
		name = self._seed("Clean lesson", content)
		execute()
		self.assertEqual(self._stored(name)[0], content)
