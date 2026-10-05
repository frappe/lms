# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

import frappe
from frappe.client import get as client_get

from lms.lms.utils import get_course_outline
from lms.tests.security.test_chapter_scorm_field_scope import (
	LAUNCH_FILE,
	ScormChapterFixture,
)

AUTHORING_ACTORS = ("creator", "moderator")
WITHHELD_ACTORS = ("guest", "outsider", "learner", "manager")

ABSENT = "<absent>"


class TestCourseOutlineScormScope(ScormChapterFixture):
	"""The outline is the route the permlevel does not reach: get_course_outline allows
	guests and builds rows with frappe.qb, which consults no permission layer. Its old lock
	rule never covered them. launch_file is no longer selected at all; scorm_package is
	gated on can_modify_course, the predicate its only readers' own save is refused on."""

	def setUp(self):
		super().setUp()
		self.lesson_less_chapter = self._create_lesson_less_scorm_chapter()
		self.guest_access = frappe.db.get_single_value("LMS Settings", "allow_guest_access")
		self._set_guest_access(1)

	def tearDown(self):
		self._set_guest_access(self.guest_access)
		super().tearDown()

	def _set_guest_access(self, value):
		"""`guest_access_allowed` reads through `frappe.get_cached_value`, so the write
		has to be followed by a cache clear or the flag under test is the cached one."""
		frappe.db.set_single_value("LMS Settings", "allow_guest_access", value)
		frappe.clear_document_cache("LMS Settings", "LMS Settings")

	def _create_lesson_less_scorm_chapter(self):
		"""The case the old rule skipped entirely: `if lessons and ...` is False for a
		chapter with none, so it fell through to the branch that serves the expanded
		File record. `delete_lesson` leaves chapters in exactly this state."""
		chapter = self._create_chapter(f"SCORM No Lesson {frappe.generate_hash(length=6)}", self.course.name)
		chapter.update({"is_scorm_package": 1, "scorm_package": self.package, "launch_file": LAUNCH_FILE})
		chapter.save()
		self._create_chapter_reference(self.course.name, chapter.name, idx=3)
		return chapter

	def _outline(self, label, progress=False):
		"""Rows keyed by chapter name, read as `label`. Guest is an ordinary actor here:
		it is the session every unauthenticated request already runs as, and the one this
		endpoint was measured open to."""
		frappe.set_user("Guest" if label == "guest" else getattr(self, label).name)
		try:
			return {row.name: row for row in get_course_outline(self.course.name, progress=progress)}
		finally:
			frappe.set_user("Administrator")

	def _scorm_rows(self, label, progress=False):
		outline = self._outline(label, progress=progress)
		return [outline[self.chapter.name], outline[self.lesson_less_chapter.name]]

	def test_a_control_an_author_still_receives_the_expanded_package_record(self):
		"""Read this before the refusals. ChapterForm renders `file_name`/`file_size`
		off this record and posts `name` back to `upsert_chapter`, which throws "Please
		attach a SCORM package" when it arrives empty — so an author losing it cannot
		rename their own SCORM chapter again."""
		for label in AUTHORING_ACTORS:
			for row in self._scorm_rows(label):
				self.assertEqual(
					row.scorm_package.get("name"),
					self.package,
					f"{label} lost the package record the authoring form saves back",
				)
				self.assertTrue(row.scorm_package.get("file_name"))
				self.assertIsNotNone(row.scorm_package.get("file_size"))

	def test_a_control_the_outline_still_describes_the_course_to_everyone(self):
		"""This narrows two fields, not the outline. A refusal that emptied the syllabus
		would pass every assertion below and break every course page."""
		for label in WITHHELD_ACTORS:
			outline = self._outline(label)
			row = outline[self.chapter.name]
			self.assertEqual(row.title, self.chapter.title)
			self.assertEqual(row.is_scorm_package, 1)
			self.assertEqual([lesson.name for lesson in row.lessons], [self.lesson.name])

	def test_a_logged_out_visitor_receives_no_package_location(self):
		"""The route as measured: `allow_guest_access` on, no account, both fields served."""
		for row in self._scorm_rows("guest"):
			self.assertIsNone(row.scorm_package, "the outline handed a package record to a Guest session")
			self.assertNotIn("launch_file", row)

	def test_an_account_enrolled_in_nothing_receives_no_package_location(self):
		for row in self._scorm_rows("outsider"):
			self.assertIsNone(row.scorm_package)
			self.assertNotIn("launch_file", row)

	def test_an_enrolled_student_receives_no_package_location_either(self):
		"""And that is the point: the outline is not the player's source. An enrolled
		student reaches the package through `get_scorm_playback`, which answers off the
		pair `SCORMRenderer._check_permission` serves the bytes on."""
		for row in self._scorm_rows("learner"):
			self.assertIsNone(row.scorm_package)
			self.assertNotIn("launch_file", row)

	def test_the_lesson_less_chapter_is_covered_too(self):
		"""The one the old rule could never reach. `if lessons and all(...)` is False
		with no lessons, so this chapter went to the branch that expands the File."""
		row = self._outline("outsider")[self.lesson_less_chapter.name]
		self.assertEqual(row.lessons, [])
		self.assertIsNone(row.scorm_package)
		self.assertNotIn("launch_file", row)

	def test_a_system_manager_keeps_every_read_it_already_held(self):
		"""can_modify_course is False for a System Manager who is neither a Moderator nor
		listed on the course, so the outline withholds — and costs them nothing: their
		permlevel-1 row still carries the field on the document and list reads."""
		for row in self._scorm_rows("manager"):
			self.assertIsNone(row.scorm_package)

		frappe.set_user(self.manager.name)
		try:
			document = client_get("Course Chapter", self.chapter.name)
			rows = frappe.get_list(
				"Course Chapter",
				filters={"name": self.chapter.name},
				fields=["name", "scorm_package", "launch_file"],
			)
		finally:
			frappe.set_user("Administrator")
		self.assertEqual(document.get("scorm_package", ABSENT), self.package)
		self.assertEqual(document.get("launch_file", ABSENT), LAUNCH_FILE)
		self.assertEqual(rows[0].get("scorm_package", ABSENT), self.package)

	def test_the_outline_serves_the_launch_file_to_nobody_at_all(self):
		"""Not a narrowing: nothing reads it. `OutlineChapter` does not declare it, no
		`.vue` or `.ts` file outside the player's `get_scorm_playback` resource mentions
		it, and no Python caller reads the outline's return value."""
		for label in AUTHORING_ACTORS + WITHHELD_ACTORS:
			for row in self._scorm_rows(label):
				self.assertNotIn("launch_file", row, f"{label} was handed the SCORM entry URL")

	def test_an_author_is_never_locked_so_the_lock_rule_could_not_have_covered_this(self):
		"""Why the old all(locked) branch is gone rather than kept alongside:
		enforces_lesson_completion returns False for anyone can_modify_course admits, so it
		could never fire for the only caller that still receives the field."""
		frappe.db.set_value("LMS Course", self.course.name, "enforce_lesson_completion", 1)

		author_row = self._outline("creator", progress=True)[self.chapter.name]
		self.assertEqual([lesson.get("locked") for lesson in author_row.lessons], [None])
		self.assertEqual(author_row.scorm_package.get("name"), self.package)

		student_row = self._outline("learner", progress=True)[self.chapter.name]
		self.assertEqual([lesson.get("locked") for lesson in student_row.lessons], [1])
		self.assertIsNone(student_row.scorm_package)
