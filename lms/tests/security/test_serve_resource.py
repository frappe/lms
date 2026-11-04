import base64
import json
import os

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
		# Tests below save self.lesson; the savepoint reverts the DB row's `modified`,
		# so reload keeps the in-memory doc from going stale for the next save.
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
			(self.lesson.name, False, False),
			[r[:3] for r in refs],
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

				self.assertIn(
					(self.lesson.name, False, False),
					[r[:3] for r in _resolve_lesson_references(embedded_url)],
				)
				self.assertNotIn(
					(self.lesson.name, False, False),
					[r[:3] for r in _resolve_lesson_references(mismatched_query)],
				)

	def test_unattached_private_file_still_resolves(self):
		"""The prod 'everyone incl. Administrator 403s' case: a private file not attached to
		the lesson must still resolve via the content search (its documented fallback)."""
		frappe.db.set_value("File", self.pdf.name, {"attached_to_doctype": None, "attached_to_name": None})
		self.assertTrue(_resolve_lesson_references(self.file_url))

	# --- user-facing behaviour ----------------------------------------------------

	def _served_name(self, user):
		"""The download name serve_resource hands to send_private_file."""
		served = {}
		original = course_lesson._serve_private_file
		course_lesson._serve_private_file = lambda relative_path, filename: served.update(name=filename)
		frappe.set_user(user)
		try:
			serve_resource(self.file_url)
		finally:
			course_lesson._serve_private_file = original
			frappe.set_user("Administrator")
		return served["name"]

	def test_a_renamed_file_is_served_as_its_stored_type(self):
		# send_private_file takes the Content-Type from this name; the owner can rename the
		# File to .html while the stored file stays a .pdf.
		original_name = self.pdf.file_name
		frappe.db.set_value("File", self.pdf.name, "file_name", "notes.html")
		self.addCleanup(frappe.db.set_value, "File", self.pdf.name, "file_name", original_name)

		self.assertEqual(self._served_name(self.student.email), os.path.basename(self.file_url))

	def test_a_name_with_the_stored_extension_is_kept(self):
		self.assertEqual(self._served_name(self.student.email), self.pdf.file_name)

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


class TestServeResourceExactUrl(BaseTestUtils):
	"""A request is authorised only by File rows and lesson content naming exactly its url,
	since the database compares file_url without case and the disk does not."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		h = frappe.generate_hash(length=6)
		cls.instructor = cls._create_user(f"sx-i-{h}@example.com", "Ivy", "Instr", ["Course Creator"])
		cls.student = cls._create_user(f"sx-s-{h}@example.com", "Stu", "Dent", ["LMS Student"])
		cls.victim = cls._create_user(f"sx-v-{h}@example.com", "Vic", "Tim", ["LMS Student"])

		cls.course = cls._create_course(title=f"Exact Url Course {h}", instructor=cls.instructor.email)
		chapter = cls._create_chapter(f"Exact Url Chapter {h}", cls.course.name)
		cls.lesson = cls._create_lesson(f"Exact Url Lesson {h}", chapter.name, cls.course.name)
		cls._create_chapter_reference(cls.course.name, chapter.name, idx=1)
		cls._create_lesson_reference(chapter.name, cls.lesson.name)
		cls._create_enrollment(cls.student.email, cls.course.name)

		cls.lesson_file = cls._private_file(cls.instructor.email, f"sx-notes-{h}.txt", "lesson notes")
		cls.victim_file = cls._private_file(cls.victim.email, f"SX-Notes-{h}.txt", "victim secret")
		assert cls.lesson_file.file_url.lower() == cls.victim_file.file_url.lower()
		assert cls.lesson_file.file_url != cls.victim_file.file_url

		frappe.db.set_value(
			"File",
			cls.lesson_file.name,
			{"attached_to_doctype": "Course Lesson", "attached_to_name": cls.lesson.name},
		)
		cls.lesson.content = json.dumps(
			{"blocks": [{"type": "upload", "data": {"file_url": cls.lesson_file.file_url}}]}
		)
		cls.lesson.save(ignore_permissions=True)

	@classmethod
	def _private_file(cls, owner, file_name, content):
		frappe.set_user(owner)
		try:
			return frappe.get_doc(
				{"doctype": "File", "file_name": file_name, "is_private": 1, "content": content}
			).insert(ignore_permissions=True)
		finally:
			frappe.set_user("Administrator")

	def _served_path(self, user, file_url):
		served = {}
		original = course_lesson._serve_private_file
		course_lesson._serve_private_file = lambda relative_path, filename: served.update(path=relative_path)
		frappe.set_user(user)
		try:
			serve_resource(file_url)
		finally:
			course_lesson._serve_private_file = original
			frappe.set_user("Administrator")
		return served["path"]

	def test_the_lesson_file_is_still_served(self):
		self.assertEqual(
			self._served_path(self.student.email, self.lesson_file.file_url),
			self.lesson_file.file_url.removeprefix("/private"),
		)

	def test_another_users_file_differing_only_in_case_is_refused(self):
		with self.assertRaises(frappe.PermissionError):
			self._served_path(self.student.email, self.victim_file.file_url)

	def test_a_case_variant_matching_only_lesson_content_is_refused(self):
		frappe.db.set_value(
			"File", self.lesson_file.name, {"attached_to_doctype": None, "attached_to_name": None}
		)
		with self.assertRaises(frappe.PermissionError):
			self._served_path(self.student.email, self.victim_file.file_url)
