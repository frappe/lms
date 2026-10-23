import frappe

from lms.lms.api import get_my_batches
from lms.lms.test_helpers import BaseTestUtils


class TestMyBatchesProgress(BaseTestUtils):
	"""get_my_batches carries the learner's progress for the Home batch card."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		instructor = cls._create_user(
			"mb-instructor@example.com", "Card", "Instructor", ["Course Creator"]
		).name
		cls.student = cls._create_user("mb-student@example.com", "Card", "Student", ["LMS Student"])
		cls.visitor = cls._create_user("mb-visitor@example.com", "Card", "Visitor", ["LMS Student"])
		cls.short = cls._create_course("My Batches Short Course", instructor=instructor)
		cls.long = cls._create_course("My Batches Long Course", instructor=instructor)
		short_lessons = cls._create_outline(cls.short.name, 1)
		cls._create_outline(cls.long.name, 3)

		batch = {"instructor": instructor, "evaluator": None}
		cls.two_courses = cls._create_batch(cls.short.name, title="My Batches Two Courses", **batch)
		cls.two_courses.append("courses", {"course": cls.long.name})
		cls.two_courses.save()
		cls.one_course = cls._create_batch(cls.short.name, title="My Batches One Course", **batch)
		cls.with_classes = cls._create_batch(cls.short.name, title="My Batches With Classes", **batch)
		for batch in (cls.two_courses, cls.one_course, cls.with_classes):
			cls._create_batch_enrollment(cls.student.email, batch.name)

		attended = cls._create_live_class(cls.with_classes.name, attendees=2)
		cls._create_live_class(cls.with_classes.name, attendees=1)
		cls._create_live_class(cls.with_classes.name, attendees=None)
		# Rejoining a class leaves a second participant row; it is still one class.
		for _ in range(2):
			cls._insert_raw("LMS Live Class Participant", live_class=attended, member=cls.student.email)

		cls._create_enrollment(cls.student.email, cls.short.name)
		cls._create_lesson_progress(cls.student.email, cls.short.name, short_lessons[0])

	@classmethod
	def _create_outline(cls, course, lesson_count):
		chapter = cls._create_chapter(f"{course} Chapter", course)
		cls._create_chapter_reference(course, chapter.name)
		lessons = []
		for i in range(lesson_count):
			lesson = cls._create_lesson(f"{course} Lesson {i}", chapter.name, course)
			cls._create_lesson_reference(chapter.name, lesson.name)
			lessons.append(lesson.name)
		return lessons

	@classmethod
	def _create_live_class(cls, batch, attendees):
		"""A class with attendees has its attendance synced; one without was never tracked."""
		return cls._insert_raw(
			"LMS Live Class",
			title="My Batches Live Class",
			date=frappe.utils.nowdate(),
			time="10:00:00",
			duration=60,
			batch_name=batch,
			attendees=attendees,
		)

	@classmethod
	def _insert_raw(cls, doctype, **fields):
		"""Written straight to the table: the live class controller calls out to calendars."""
		doc = frappe.get_doc({"doctype": doctype, **fields})
		doc.name = frappe.generate_hash(length=10)
		doc.db_insert()
		return doc.name

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _my_batches(self, user):
		frappe.set_user(user)
		return {batch.name: batch for batch in get_my_batches()}

	def test_progress_counts_completed_lessons_across_the_batch_courses(self):
		batches = self._my_batches(self.student.email)

		self.assertEqual(batches[self.two_courses.name].progress, 25)
		self.assertEqual(batches[self.one_course.name].progress, 100)

	def test_progress_breakdown_lists_each_batch_course(self):
		batches = self._my_batches(self.student.email)

		self.assertEqual(
			batches[self.two_courses.name].progress_breakdown,
			[{"title": self.short.title, "progress": 100}, {"title": self.long.title, "progress": 0}],
		)

	def test_progress_counts_live_classes_whose_attendance_is_tracked(self):
		batch = self._my_batches(self.student.email)[self.with_classes.name]

		# One lesson done, and one of the two tracked classes attended: 2 of 3.
		self.assertEqual(batch.progress, 66.67)
		self.assertEqual(
			batch.progress_breakdown,
			[{"title": self.short.title, "progress": 100}, {"title": "Live Classes", "progress": 50}],
		)

	def test_upcoming_batches_shown_to_a_learner_with_none_carry_no_progress(self):
		batches = self._my_batches(self.visitor.email)

		self.assertTrue(batches)
		self.assertEqual({batch.progress for batch in batches.values()}, {None})
		self.assertEqual({batch.progress_breakdown for batch in batches.values()}, {None})
