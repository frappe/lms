import base64
import json

import frappe
from frappe.tests.test_api import FrappeAPITestCase

from lms.lms.doctype.course_lesson import course_lesson
from lms.lms.doctype.course_lesson.course_lesson import _resolve_lesson_references, serve_resource
from lms.lms.test_helpers import BaseTestUtils

# A minimal valid PDF so File.insert's pdf handling doesn't choke.
_MIN_PDF = (
	b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
	b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
	b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]>>endobj\n"
	b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n164\n%%EOF\n"
)


class TestServeResourceUnderscoreFilename(BaseTestUtils, FrappeAPITestCase):
	"""Regression: a private lesson PDF whose filename contains "_" must still be served
	to the users who can read the lesson.

	The reference resolver's content-field search escaped %/_ and then ran the pattern
	through frappe.db.get_all(..., ["like", ...]), which re-escaped the backslashes — so
	any file_url with "_" (e.g. Module_1_Introduction.pdf) matched no lesson. Enrolled
	students and preview guests were denied their own media (403), and a private-but-
	unattached file was denied for everyone including Administrator. The search now
	matches the url as a literal substring (LOCATE), so no escaping is involved.
	"""

	def setUp(self):
		super().setUp()
		h = frappe.generate_hash(length=6)
		self.instructor = self._create_user(
			f"instr-{h}@example.com", "Ada", "Instr", ["Course Creator", "Moderator"]
		)
		self.student = self._create_user(f"stud-{h}@example.com", "Sam", "Student", ["LMS Student"])
		self.outsider = self._create_user(f"out-{h}@example.com", "Otto", "Outsider", ["LMS Student"])

		self.course = self._create_course(title=f"Serve Course {h}", instructor=self.instructor.email)
		self.chapter = self._create_chapter(f"Chapter {h}", self.course.name)
		self.lesson = self._create_lesson(f"Lesson {h}", self.chapter.name, self.course.name)
		self._create_chapter_reference(self.course.name, self.chapter.name, idx=1)
		self._create_lesson_reference(self.chapter.name, self.lesson.name)
		self._create_enrollment(self.student.email, self.course.name)

		# Private PDF with an underscore filename, attached like an editorjs upload block
		# (attached_to_field is left unset). frappe assigns the real (hash-suffixed) url;
		# embed THAT url in the lesson content, mirroring the real upload flow.
		self.pdf = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": f"Module_1_Introduction_{h}.pdf",
				"is_private": 1,
				"attached_to_doctype": "Course Lesson",
				"attached_to_name": self.lesson.name,
				"content": base64.b64encode(_MIN_PDF).decode(),
				"decode": True,
			}
		).insert(ignore_permissions=True)
		self.cleanup_items.append(("File", self.pdf.name))
		self.file_url = self.pdf.file_url
		self.assertIn("_", self.file_url)  # the property under test

		self.lesson.content = json.dumps(
			{"blocks": [{"type": "upload", "data": {"file_url": self.file_url, "file_type": "PDF"}}]}
		)
		self.lesson.save(ignore_permissions=True)
		frappe.db.commit()

	def _serve_as(self, user):
		"""serve_resource with the byte-streaming step stubbed (no HTTP request in tests).
		Returns the stub sentinel on success; re-raises PermissionError on denial."""
		sentinel = object()
		original = course_lesson._serve_private_file
		course_lesson._serve_private_file = lambda relative_path, filename: sentinel
		frappe.set_user(user)
		try:
			return serve_resource(self.file_url)
		finally:
			course_lesson._serve_private_file = original
			frappe.set_user("Administrator")

	# --- the direct regression: content search must resolve the underscore url ----

	def test_content_search_yields_student_reference(self):
		refs = _resolve_lesson_references(self.file_url)
		self.assertIn(
			(self.lesson.name, False),
			refs,
			msg="content-field search must resolve a student-accessible reference for an underscore filename",
		)

	def test_underscore_is_not_a_wildcard(self):
		"""The "_" must be matched literally, not as a single-character LIKE wildcard: a
		lesson embedding a url the searched one matches only wildcard-wise must not
		resolve as student-accessible content."""
		other_url = self.file_url.replace("_", "Z")
		self.lesson.content = json.dumps(
			{"blocks": [{"type": "upload", "data": {"file_url": other_url, "file_type": "PDF"}}]}
		)
		self.lesson.save(ignore_permissions=True)
		frappe.db.commit()

		self.assertIn((self.lesson.name, False), _resolve_lesson_references(other_url))
		self.assertNotIn((self.lesson.name, False), _resolve_lesson_references(self.file_url))

	def test_content_search_matches_percent_filename(self):
		"""A filename with a literal % must resolve too, and the % must stay literal
		rather than acting as a multi-character wildcard."""
		pct_url = "/private/files/report50%final.pdf"
		self.lesson.content = json.dumps(
			{"blocks": [{"type": "upload", "data": {"file_url": pct_url, "file_type": "PDF"}}]}
		)
		self.lesson.save(ignore_permissions=True)
		frappe.db.commit()

		self.assertIn((self.lesson.name, False), _resolve_lesson_references(pct_url))
		# the % is literal: a url that differs only where the % sits must not match.
		self.assertNotIn(
			(self.lesson.name, False),
			_resolve_lesson_references("/private/files/report50XXXXXfinal.pdf"),
		)

	def test_unattached_private_file_still_resolves(self):
		"""The prod 'everyone incl. Administrator 403s' case: a private file not attached to
		the lesson must still resolve via the content search (its documented fallback)."""
		frappe.db.set_value("File", self.pdf.name, {"attached_to_doctype": None, "attached_to_name": None})
		frappe.db.commit()
		self.assertTrue(_resolve_lesson_references(self.file_url))

	# --- user-facing behaviour ----------------------------------------------------

	def test_enrolled_student_served(self):
		self.assertIsNotNone(self._serve_as(self.student.email))

	def test_instructor_served(self):
		self.assertIsNotNone(self._serve_as(self.instructor.email))

	def test_preview_guest_served_when_enabled(self):
		self.lesson.db_set("include_in_preview", 1)
		frappe.db.set_single_value("LMS Settings", "allow_guest_access", 1)
		frappe.db.commit()
		self.assertIsNotNone(self._serve_as("Guest"))

	def test_non_member_denied(self):
		"""The fix must not over-open access: an unenrolled, non-preview user is still denied."""
		with self.assertRaises(frappe.PermissionError):
			self._serve_as(self.outsider.email)
