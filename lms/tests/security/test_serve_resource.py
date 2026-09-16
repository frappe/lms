import base64
import json

import frappe

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


class TestServeResourceUnderscoreFilename(BaseTestUtils):
	"""Regression: a private lesson PDF whose filename contains "_" must still be served
	to the users who can read the lesson.

	The reference resolver's content-field search escaped %/_ and then ran the pattern
	through frappe.db.get_all(..., ["like", ...]), which re-escaped the backslashes, so
	any file_url with "_" (e.g. Module_1_Introduction.pdf) matched no lesson. Enrolled
	students and preview guests were denied their own media (403), and a private-but-
	unattached file was denied for everyone including Administrator. The search now
	matches the url as a literal substring (LOCATE), so no escaping is involved.
	"""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		h = frappe.generate_hash(length=6)
		cls.instructor = cls._create_user(
			f"instr-{h}@example.com", "Ada", "Instr", ["Course Creator", "Moderator"]
		)
		cls.student = cls._create_user(f"stud-{h}@example.com", "Sam", "Student", ["LMS Student"])
		cls.outsider = cls._create_user(f"out-{h}@example.com", "Otto", "Outsider", ["LMS Student"])

		cls.course = cls._create_course(title=f"Serve Course {h}", instructor=cls.instructor.email)
		cls.chapter = cls._create_chapter(f"Chapter {h}", cls.course.name)
		cls.lesson = cls._create_lesson(f"Lesson {h}", cls.chapter.name, cls.course.name)
		cls._create_chapter_reference(cls.course.name, cls.chapter.name, idx=1)
		cls._create_lesson_reference(cls.chapter.name, cls.lesson.name)
		cls._create_enrollment(cls.student.email, cls.course.name)

		# Private PDF with an underscore filename, attached like an editorjs upload block
		# (attached_to_field is left unset). frappe assigns the real (hash-suffixed) url;
		# embed THAT url in the lesson content, mirroring the real upload flow.
		cls.pdf = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": f"Module_1_Introduction_{h}.pdf",
				"is_private": 1,
				"attached_to_doctype": "Course Lesson",
				"attached_to_name": cls.lesson.name,
				"content": base64.b64encode(_MIN_PDF).decode(),
				"decode": True,
			}
		).insert(ignore_permissions=True)
		cls.file_url = cls.pdf.file_url
		assert "_" in cls.file_url  # the property under test

		cls.lesson.content = json.dumps(
			{"blocks": [{"type": "upload", "data": {"file_url": cls.file_url, "file_type": "PDF"}}]}
		)
		cls.lesson.save(ignore_permissions=True)

	def setUp(self):
		super().setUp()
		# test_underscore_is_not_a_wildcard and test_content_search_matches_percent_filename
		# both call self.lesson.save() below; the savepoint rollback reverts the DB row's
		# `modified` afterwards, so reload keeps the in-memory doc from going stale for the
		# next test's save.
		self.lesson.reload()

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

	def test_wildcard_characters_are_matched_literally(self):
		# LIKE wildcards ("_" a single character, "%" any run of characters) must not
		# act as wildcards here: a lesson embedding a url the searched one matches
		# only wildcard-wise must not resolve as student-accessible content.
		cases = [
			("underscore", self.file_url, self.file_url.replace("_", "Z")),
			(
				"percent",
				"/private/files/report50%final.pdf",
				"/private/files/report50XXXXXfinal.pdf",
			),
		]
		for case, embedded_url, mismatched_query in cases:
			with self.subTest(case=case):
				self.lesson.content = json.dumps(
					{"blocks": [{"type": "upload", "data": {"file_url": embedded_url, "file_type": "PDF"}}]}
				)
				self.lesson.save(ignore_permissions=True)

				self.assertIn((self.lesson.name, False), _resolve_lesson_references(embedded_url))
				self.assertNotIn((self.lesson.name, False), _resolve_lesson_references(mismatched_query))

	def test_unattached_private_file_still_resolves(self):
		"""The prod 'everyone incl. Administrator 403s' case: a private file not attached to
		the lesson must still resolve via the content search (its documented fallback)."""
		frappe.db.set_value("File", self.pdf.name, {"attached_to_doctype": None, "attached_to_name": None})
		self.assertTrue(_resolve_lesson_references(self.file_url))

	# --- user-facing behaviour ----------------------------------------------------

	def test_enrolled_student_served(self):
		self.assertIsNotNone(self._serve_as(self.student.email))

	def test_instructor_served(self):
		self.assertIsNotNone(self._serve_as(self.instructor.email))

	def test_preview_guest_served_when_enabled(self):
		original = frappe.db.get_single_value("LMS Settings", "allow_guest_access")
		self.addCleanup(frappe.db.set_single_value, "LMS Settings", "allow_guest_access", original)
		self.lesson.db_set("include_in_preview", 1)
		frappe.db.set_single_value("LMS Settings", "allow_guest_access", 1)
		self.assertIsNotNone(self._serve_as("Guest"))

	def test_non_member_denied(self):
		"""The fix must not over-open access: an unenrolled, non-preview user is still denied."""
		with self.assertRaises(frappe.PermissionError):
			self._serve_as(self.outsider.email)
