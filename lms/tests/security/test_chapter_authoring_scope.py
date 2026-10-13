# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

"""`Course Chapter` carries the `LMS Course` rule on its own `course` Link.

Unlike `LMS Course`, this doctype grants `LMS Student` read/select, so its list
surface is student-facing and the narrowing needs a student control as well as a
student denial.

Every list assertion goes through `frappe.get_list`. `frappe.get_all` sets
`ignore_permissions=True` (frappe/__init__.py:1323) and would pass against a
permission_query_conditions hook that does nothing.
"""

import frappe
from frappe.client import set_value

from lms.lms.test_helpers import BaseTestUtils


class TestChapterAuthoringScope(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		hash = frappe.generate_hash(length=6)

		# Narrowest users that satisfy each role: a Moderator that also carried
		# System Manager would hide every gap these tests exist to find.
		cls.moderator = cls._create_user(f"chs-mod-{hash}@example.com", "Mia", "Mod", ["Moderator"])
		cls.author = cls._create_user(f"chs-author-{hash}@example.com", "Ana", "Author", ["Course Creator"])
		cls.outsider = cls._create_user(
			f"chs-outsider-{hash}@example.com", "Otto", "Outsider", ["Course Creator"]
		)
		cls.student = cls._create_user(f"chs-student-{hash}@example.com", "Sam", "Student", ["LMS Student"])
		cls.enrolled = cls._create_user(
			f"chs-enrolled-{hash}@example.com", "Ely", "Enrolled", ["LMS Student"]
		)

		cls.author_draft = cls._draft_course(f"CHS Author Draft {hash}", cls.author.name)
		cls.outsider_draft = cls._draft_course(f"CHS Outsider Draft {hash}", cls.outsider.name)
		cls.published = cls._create_course(title=f"CHS Published {hash}", instructor=cls.author.name).name

		cls.author_chapter = cls._create_chapter(f"CHS Author Chapter {hash}", cls.author_draft).name
		cls.outsider_chapter = cls._create_chapter(f"CHS Outsider Chapter {hash}", cls.outsider_draft).name
		cls.published_chapter = cls._create_chapter(f"CHS Published Chapter {hash}", cls.published).name
		# Nothing links to this one, so a delete reaches the permission gate instead of
		# tripping frappe's LinkExistsError check first.
		cls.author_spare = cls._create_chapter(f"CHS Author Spare {hash}", cls.author_draft).name

		cls._create_enrollment(cls.enrolled.name, cls.author_draft)

		cls.orphan_chapter = cls._orphan_chapter(hash)

		cls.courseless_chapter = cls._create_chapter(f"CHS Courseless Chapter {hash}", cls.published).name
		frappe.db.set_value("Course Chapter", cls.courseless_chapter, "course", "", update_modified=False)

	@classmethod
	def _draft_course(cls, title, instructor):
		"""_create_course publishes; the interesting rows are the unpublished ones."""
		course = cls._create_course(title=title, instructor=instructor)
		course.published = 0
		course.save()
		return course.name

	@classmethod
	def _orphan_chapter(cls, hash):
		"""A chapter whose course link resolves to nothing.

		`course` is reqd and a Link, so this state is not reachable through a save --
		it is what a chapter looks like after its course row is gone. The row is
		written with db.set_value rather than by deleting a course, because
		delete_lesson-style cascades would take the chapter with it and there would be
		nothing left to assert on.
		"""
		chapter = cls._create_chapter(f"CHS Orphan Chapter {hash}", cls.published)
		frappe.db.set_value(
			"Course Chapter", chapter.name, "course", f"chs-course-that-is-gone-{hash}", update_modified=False
		)
		return chapter.name

	def _as(self, user, fn):
		# frappe.set_user, not `frappe.session.user = ...`: only set_user clears the
		# frappe.local permission cache, so a bare assignment reuses the last actor's
		# answers and every role assertion below would be meaningless.
		frappe.set_user(user)
		try:
			return fn()
		finally:
			frappe.set_user("Administrator")

	def _listed(self, user):
		return self._as(user, lambda: frappe.get_list("Course Chapter", pluck="name", limit_page_length=0))

	def _may(self, user, chapter, ptype):
		return self._as(user, lambda: frappe.has_permission("Course Chapter", ptype, doc=chapter))

	def _actors(self):
		"""(label, user) for every role that reaches the Course Chapter list surface."""
		return (
			("moderator", self.moderator.name),
			("author", self.author.name),
			("outsider", self.outsider.name),
			("student", self.student.name),
			("enrolled_student", self.enrolled.name),
		)

	# --- controls: this PR narrows an existing grant, so the legitimate actors need
	# --- guards the fix cannot move. These pass on the base commit and must keep passing.

	def test_an_author_can_still_create_write_and_list_a_chapter_on_their_own_course(self):
		def create():
			chapter = frappe.new_doc("Course Chapter")
			chapter.update(
				{"course": self.author_draft, "title": f"CHS Made {frappe.generate_hash(length=6)}"}
			)
			chapter.insert()
			return chapter.name

		created = self._as(self.author.name, create)
		self.assertTrue(frappe.db.exists("Course Chapter", created))

		self._as(
			self.author.name,
			lambda: set_value("Course Chapter", self.author_chapter, "title", "edited by author"),
		)
		self.assertEqual(
			frappe.db.get_value("Course Chapter", self.author_chapter, "title"), "edited by author"
		)

		listed = self._listed(self.author.name)
		self.assertIn(self.author_chapter, listed)
		self.assertIn(created, listed)

	def test_a_plain_student_still_reaches_a_published_courses_chapters(self):
		"""Course Chapter grants LMS Student read/select, unlike LMS Course.

		SCORMChapter.vue reads the chapter document straight through
		createDocumentResource, so the single-doc answer matters as much as the list.
		"""
		self.assertTrue(self._may(self.student.name, self.published_chapter, "read"))
		self.assertIn(self.published_chapter, self._listed(self.student.name))

	def test_an_enrolled_student_still_reaches_an_unpublished_courses_chapters(self):
		self.assertTrue(self._may(self.enrolled.name, self.author_chapter, "read"))
		self.assertIn(self.author_chapter, self._listed(self.enrolled.name))

	def test_a_moderator_still_reaches_every_chapter_on_both_paths(self):
		for chapter in (self.author_chapter, self.outsider_chapter, self.published_chapter):
			with self.subTest(chapter=chapter):
				self.assertTrue(self._may(self.moderator.name, chapter, "write"))
				self.assertIn(chapter, self._listed(self.moderator.name))

	# --- the narrowing: these fail on the base commit.

	def test_a_non_instructor_course_creator_cannot_create_a_chapter_on_another_authors_course(self):
		"""`create` IS gated here, where `LMS Course`'s pair could not gate it.

		frappe checks "create" at model/document.py:731, four lines before
		set_new_name() at :735, so there is no `doc.name` -- which is why the course
		pair leaves `create` to the DocPerm grant. A chapter carries its scope in a
		field instead: `doc.course` is already populated at that moment, proven by the
		probe in the design doc, so the rule is evaluatable before the row exists.
		"""
		before = frappe.db.count("Course Chapter", {"course": self.author_draft})

		def create_on_someone_elses_course():
			chapter = frappe.new_doc("Course Chapter")
			chapter.update(
				{"course": self.author_draft, "title": f"CHS Pwn {frappe.generate_hash(length=6)}"}
			)
			chapter.insert()
			return chapter.name

		with self.assertRaises(frappe.PermissionError):
			self._as(self.outsider.name, create_on_someone_elses_course)

		self.assertEqual(frappe.db.count("Course Chapter", {"course": self.author_draft}), before)

	def test_a_non_instructor_course_creator_cannot_write_another_authors_chapter(self):
		before = frappe.db.get_value("Course Chapter", self.author_chapter, "title")

		with self.assertRaises(frappe.PermissionError):
			self._as(
				self.outsider.name,
				lambda: set_value("Course Chapter", self.author_chapter, "title", "PWNED"),
			)

		self.assertTrue(frappe.db.exists("Course Chapter", self.author_chapter))
		self.assertEqual(frappe.db.get_value("Course Chapter", self.author_chapter, "title"), before)

	def test_a_course_creator_cannot_move_another_authors_chapter_into_their_course(self):
		with self.assertRaises(frappe.PermissionError):
			self._as(
				self.outsider.name,
				lambda: set_value("Course Chapter", self.author_chapter, "course", self.outsider_draft),
			)

		self.assertEqual(
			frappe.db.get_value("Course Chapter", self.author_chapter, "course"), self.author_draft
		)

	def test_a_non_instructor_course_creator_cannot_delete_another_authors_chapter(self):
		with self.assertRaises(frappe.PermissionError):
			self._as(self.outsider.name, lambda: frappe.delete_doc("Course Chapter", self.author_spare))

		self.assertTrue(frappe.db.exists("Course Chapter", self.author_spare))

	def test_another_authors_draft_chapter_is_absent_from_a_list_read(self):
		listed = self._listed(self.outsider.name)
		self.assertNotIn(self.author_chapter, listed)
		self.assertIn(self.outsider_chapter, listed, "control failed: the actor cannot see its own chapter")

	def test_a_plain_student_no_longer_enumerates_unpublished_chapters(self):
		listed = self._listed(self.student.name)
		self.assertNotIn(self.author_chapter, listed)
		self.assertNotIn(self.outsider_chapter, listed)
		self.assertIn(self.published_chapter, listed, "control failed: the student lost published chapters")

	def test_has_permission_matches_the_authoring_rule_for_every_actor(self):
		cases = (
			("moderator", self.moderator.name, self.author_chapter, True),
			("author_own", self.author.name, self.author_chapter, True),
			("author_on_their_published_course", self.author.name, self.published_chapter, True),
			("author_on_someone_elses", self.author.name, self.outsider_chapter, False),
			("outsider_on_someone_elses", self.outsider.name, self.author_chapter, False),
			("outsider_on_a_published_course", self.outsider.name, self.published_chapter, False),
			("outsider_own", self.outsider.name, self.outsider_chapter, True),
			("enrolled_student", self.enrolled.name, self.author_chapter, False),
		)
		for ptype in ("write", "delete", "share"):
			for label, user, chapter, expected in cases:
				with self.subTest(ptype=ptype, case=label):
					self.assertEqual(self._may(user, chapter, ptype), expected)

	def test_has_permission_matches_the_read_rule_for_every_actor(self):
		cases = (
			("moderator_on_a_draft", self.moderator.name, self.author_chapter, True),
			("author_own_draft", self.author.name, self.author_chapter, True),
			("author_on_someone_elses_draft", self.author.name, self.outsider_chapter, False),
			("outsider_on_someone_elses_draft", self.outsider.name, self.author_chapter, False),
			("outsider_on_a_published_course", self.outsider.name, self.published_chapter, True),
			("student_on_a_published_course", self.student.name, self.published_chapter, True),
			("student_on_a_draft", self.student.name, self.author_chapter, False),
			("enrolled_on_the_draft_they_joined", self.enrolled.name, self.author_chapter, True),
			("enrolled_on_an_unrelated_draft", self.enrolled.name, self.outsider_chapter, False),
			("guest_on_a_draft", "Guest", self.author_chapter, False),
		)
		for ptype in ("read", "select", "print"):
			for label, user, chapter, expected in cases:
				with self.subTest(ptype=ptype, case=label):
					self.assertEqual(self._may(user, chapter, ptype), expected)

	# --- the case this PR owns that the course pair did not have to answer.

	def test_a_chapter_whose_course_is_unresolvable_is_denied_not_shown(self):
		"""A missing course must not read as "no restriction".

		The has_permission side gets there through can_access_course, which returns
		False for a course row that is not there rather than deferring. The list side
		gets there because the condition is a subquery over `tabLMS Course`: a link
		that matches no row matches no subquery result either.
		"""
		self.assertFalse(
			frappe.db.exists(
				"LMS Course", frappe.db.get_value("Course Chapter", self.orphan_chapter, "course")
			),
			"fixture is wrong: the orphan chapter's course still exists",
		)
		for label, user in self._actors():
			if label == "moderator":
				continue
			with self.subTest(actor=label):
				self.assertFalse(self._may(user, self.orphan_chapter, "read"))
				self.assertFalse(self._may(user, self.orphan_chapter, "write"))
				self.assertNotIn(self.orphan_chapter, self._listed(user))

	def test_an_unresolvable_course_does_not_block_a_moderator(self):
		"""The control for the test above: the denial is the course rule, not a crash.

		A Moderator's answer is role-shaped on both sides -- can_modify_course is true
		for them whatever the course is, and the query condition short-circuits to no
		restriction -- so an orphan row stays reachable to the one actor who has to be
		able to clean it up.

		`read` is asserted alongside `write` because it is the half that broke: asking
		can_access_course before can_author_course refused a Moderator here while the
		list still showed the row, and this is the assertion that caught it.
		"""
		for ptype in ("read", "write"):
			with self.subTest(ptype=ptype):
				self.assertTrue(self._may(self.moderator.name, self.orphan_chapter, ptype))
		self.assertIn(self.orphan_chapter, self._listed(self.moderator.name))

	def test_a_chapter_with_no_course_at_all_still_gets_the_mandatory_error(self):
		"""Denying an empty `course` would hide "Course is required" behind a 403.

		_validate_mandatory runs inside validate(), long after frappe checks "create",
		so the hook sees an empty link and holds its opinion. The row is unsaveable
		either way, which is what makes the deferral safe.
		"""

		def create_without_a_course():
			chapter = frappe.new_doc("Course Chapter")
			chapter.update({"title": f"CHS No Course {frappe.generate_hash(length=6)}"})
			chapter.insert()

		with self.assertRaises(frappe.MandatoryError):
			self._as(self.outsider.name, create_without_a_course)

	def test_a_saved_chapter_with_no_course_is_denied_not_deferred(self):
		"""The empty-`course` deferral belongs to a new row, not a saved one.

		_validate_mandatory only runs on a row still being saved, so a row already on
		disk gets no second chance -- it is denied, like the orphan course above. An
		unconditional deferral handed an unrelated Course Creator `write` on it.
		"""
		for label, user in self._actors():
			if label == "moderator":
				continue
			with self.subTest(actor=label):
				self.assertFalse(self._may(user, self.courseless_chapter, "read"))
				self.assertFalse(self._may(user, self.courseless_chapter, "write"))
				self.assertNotIn(self.courseless_chapter, self._listed(user))

	def test_the_two_layers_agree_for_every_actor(self):
		"""The single-doc answer and the list answer must be the same sentence.

		Nothing in the course rule is inexpressible as SQL -- unlike the assessment
		rule's sequential lock -- so agreement here is total and any divergence is a bug.
		"""
		chapters = (
			self.author_chapter,
			self.outsider_chapter,
			self.published_chapter,
			self.orphan_chapter,
			self.courseless_chapter,
		)
		for label, user in self._actors():
			listed = set(self._listed(user))
			for chapter in chapters:
				with self.subTest(actor=label, chapter=chapter):
					self.assertEqual(
						self._may(user, chapter, "read"),
						chapter in listed,
						f"{label}: has_permission and permission_query_conditions disagree",
					)

	def test_guest_never_reaches_the_chapter_list_surface(self):
		"""Course Chapter grants no DocPerm to Guest or All.

		check_select_permission (frappe/database/query.py:1581-1586) refuses before the
		query condition is consulted, so the guest denial is the grant, not this rule.
		"""
		with self.assertRaises(frappe.PermissionError):
			self._listed("Guest")
