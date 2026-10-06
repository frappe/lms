# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

import frappe

from lms.lms.permissions import resolve_lesson_course
from lms.lms.test_helpers import BaseTestUtils


class TestResolveLessonCourse(BaseTestUtils):
	"""Which course a lesson is in, resolved through its chapter rather than the mirror.

	`Course Lesson.course` is a read-only `fetch_from: chapter.course` copy, and fetch_from
	is copy-on-save, so moving a chapter to another course leaves every lesson under it
	still naming the course it left. `resolve_lesson_course` reads the chapter instead.
	"""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.departed_author = cls._create_user(
			f"rlc-a-{hash}@example.com", "Ada", "Departs", ["Course Creator"]
		)
		cls.arrived_author = cls._create_user(
			f"rlc-b-{hash}@example.com", "Bo", "Arrives", ["Course Creator"]
		)
		cls.departed_course = cls._create_course(f"Resolve Source {hash}", cls.departed_author.email)
		cls.arrived_course = cls._create_course(f"Resolve Target {hash}", cls.arrived_author.email)

	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6)
		self.chapter = self._create_chapter(f"Resolve Chapter {hash}", self.departed_course.name)
		self.lesson = self._create_lesson(
			f"Resolve Lesson {hash}", self.chapter.name, self.departed_course.name
		)

	def _mirror(self):
		return frappe.db.get_value("Course Lesson", self.lesson.name, "course")

	def _move_the_chapter(self):
		chapter = frappe.get_doc("Course Chapter", self.chapter.name)
		chapter.course = self.arrived_course.name
		chapter.save()

	def test_the_resolver_and_the_mirror_agree_before_the_chapter_moves(self):
		"""Characterisation of the ordinary case: on a lesson nobody has moved, the two
		readings are the same, so swapping a consumer over changes nothing for it."""
		self.assertEqual(resolve_lesson_course(self.lesson.name), self.departed_course.name)
		self.assertEqual(self._mirror(), self.departed_course.name)

	def test_moving_the_chapter_moves_the_resolver_and_leaves_the_mirror_behind(self):
		"""The trap this resolver exists for. One save of the chapter, two answers."""
		self._move_the_chapter()

		self.assertEqual(
			frappe.db.get_value("Course Chapter", self.chapter.name, "course"),
			self.arrived_course.name,
		)
		self.assertEqual(resolve_lesson_course(self.lesson.name), self.arrived_course.name)
		self.assertEqual(
			self._mirror(),
			self.departed_course.name,
			"the fetch_from mirror still names the course the lesson left",
		)

	def test_saving_the_lesson_snaps_the_mirror_to_the_answer_the_resolver_already_gave(self):
		"""Copy-on-save, not sync: the mirror was not wrong about the schema, only late.

		This is why a gate may not read it. Whether it is right depends on whether anyone
		has happened to save the lesson since the chapter moved.
		"""
		self._move_the_chapter()
		self.assertEqual(self._mirror(), self.departed_course.name)

		lesson = frappe.get_doc("Course Lesson", self.lesson.name)
		lesson.title = f"Touched {frappe.generate_hash(length=6)}"
		lesson.save()

		self.assertEqual(self._mirror(), self.arrived_course.name)
		self.assertEqual(resolve_lesson_course(self.lesson.name), self.arrived_course.name)

	def test_a_lesson_with_no_chapter_resolves_to_no_course(self):
		"""`chapter` is reqd, so a save cannot produce this; a legacy row or a direct SQL
		import can, which is what `db.set_value` reproduces here."""
		frappe.db.set_value("Course Lesson", self.lesson.name, "chapter", None, update_modified=False)

		self.assertIsNone(resolve_lesson_course(self.lesson.name))

	def test_a_lesson_whose_chapter_row_is_gone_resolves_to_no_course(self):
		"""Deleted out from under the lesson. No course means no grant to anyone but a
		Moderator, which is the safe direction for an unresolvable row."""
		frappe.db.delete("Course Chapter", {"name": self.chapter.name})

		self.assertIsNone(resolve_lesson_course(self.lesson.name))

	def test_a_chapter_naming_a_course_that_is_gone_resolves_to_that_dangling_name(self):
		"""Pins the one unresolvable case that does not return None.

		Proving the course exists would cost a third query on a per-row permission path,
		to defend a state the app cannot reach: `delete_doc` refuses an LMS Course while a
		chapter links it (`LinkExistsError`). A name matching no course matches no row in
		any gate composed on this, so nothing is granted by it. If the contract is ever
		tightened to require an existing course, this becomes assertIsNone.
		"""
		frappe.db.set_value(
			"Course Chapter", self.chapter.name, "course", "no-such-course", update_modified=False
		)

		self.assertEqual(resolve_lesson_course(self.lesson.name), "no-such-course")

	def test_a_lesson_that_does_not_exist_resolves_to_no_course(self):
		self.assertIsNone(resolve_lesson_course("no-such-lesson"))

	def test_a_mapping_argument_resolves_to_no_course_instead_of_an_arbitrary_lesson(self):
		"""`frappe.db.get_value`'s second argument is `filters`, not `name`: anything that
		is not a string is matched against the whole table. The control shows the same
		mapping resolving a real row through get_value; the guard makes the resolver
		answer None instead of gating against whichever lesson the filter happened to hit.
		"""
		mapping = {"chapter": self.chapter.name}

		self.assertEqual(
			frappe.db.get_value("Course Lesson", mapping, "chapter"),
			self.chapter.name,
			"control: the mapping does resolve a row when get_value is called directly",
		)
		self.assertIsNone(resolve_lesson_course(mapping))
		self.assertIsNone(resolve_lesson_course(""))
		self.assertIsNone(resolve_lesson_course(None))
