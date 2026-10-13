import frappe

from lms.lms.api import update_lesson_index
from lms.lms.doctype.course_lesson import course_lesson
from lms.lms.doctype.course_lesson.course_lesson import save_progress
from lms.lms.doctype.lms_quiz.lms_quiz import save_progress_after_quiz
from lms.lms.test_helpers import BaseTestUtils


class TestProgressCourseFromLesson(BaseTestUtils):
	"""save_progress checks enrollment and the lock on the lesson's own course, not the one passed in."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		original_capture = course_lesson.capture
		course_lesson.capture = lambda *a, **k: None
		cls.addClassCleanup(setattr, course_lesson, "capture", original_capture)

		hash = frappe.generate_hash(length=6)
		cls.author = cls._create_user(
			f"pcl-author-{hash}@example.com", "Pat", "Author", ["Course Creator", "Moderator"]
		)
		cls.student = cls._create_user(f"pcl-student-{hash}@example.com", "Sam", "Student", ["LMS Student"])

		cls.course_a, (cls.lesson_a,) = cls._make_course(f"PCL Open {hash}", 1)
		cls.course_b, cls.lessons_b = cls._make_course(f"PCL Sequential {hash}", 3)
		frappe.db.set_value("LMS Course", cls.course_b.name, "enforce_lesson_completion", 1)
		cls._create_enrollment(cls.student.email, cls.course_a.name)

	@classmethod
	def _make_course(cls, title, lesson_count):
		course = cls._create_course(title=title, instructor=cls.author.email)
		chapter = cls._create_chapter(f"{title} Chapter", course.name)
		cls._create_chapter_reference(course.name, chapter.name)
		lessons = [
			cls._create_lesson(f"{title} Lesson {idx}", chapter.name, course.name)
			for idx in range(1, lesson_count + 1)
		]
		chapter_doc = frappe.get_doc("Course Chapter", chapter.name)
		for lesson in lessons:
			chapter_doc.append("lessons", {"lesson": lesson.name})
		chapter_doc.save()
		return course, lessons

	def _progress_rows(self, lesson):
		return frappe.db.count("LMS Course Progress", {"lesson": lesson, "member": self.student.email})

	def _as_student(self, *args, **kwargs):
		frappe.set_user(self.student.email)
		try:
			return save_progress(*args, **kwargs)
		finally:
			frappe.set_user("Administrator")

	def _enroll_in_b(self):
		self._create_enrollment(self.student.email, self.course_b.name)

	def test_enrollment_in_another_course_does_not_admit_the_lesson(self):
		locked = self.lessons_b[1].name
		with self.assertRaises(frappe.ValidationError):
			self._as_student(locked, self.course_a.name)
		self.assertEqual(self._progress_rows(locked), 0)

	def test_scorm_progress_is_refused_through_another_course(self):
		locked = self.lessons_b[1].name
		with self.assertRaises(frappe.ValidationError):
			self._as_student(locked, self.course_a.name, {"is_complete": True, "scorm_content": ""})
		self.assertEqual(self._progress_rows(locked), 0)

	def test_the_sequential_lock_of_the_lessons_course_applies(self):
		self._enroll_in_b()
		locked = self.lessons_b[1].name
		with self.assertRaises(frappe.ValidationError):
			self._as_student(locked, self.course_a.name)
		self.assertEqual(self._progress_rows(locked), 0)

	def test_the_lock_holds_when_no_course_is_passed(self):
		self._enroll_in_b()
		locked = self.lessons_b[1].name
		with self.assertRaises(frappe.PermissionError):
			self._as_student(locked)
		self.assertEqual(self._progress_rows(locked), 0)

	def test_unenrolled_course_writes_nothing_when_no_course_is_passed(self):
		first = self.lessons_b[0].name
		self.assertEqual(self._as_student(first), 0)
		self.assertEqual(self._progress_rows(first), 0)

	def test_matching_course_still_records_progress(self):
		self._as_student(self.lesson_a.name, self.course_a.name)
		self.assertEqual(self._progress_rows(self.lesson_a.name), 1)

	def test_course_can_be_omitted(self):
		self._as_student(self.lesson_a.name)
		self.assertEqual(self._progress_rows(self.lesson_a.name), 1)

	def test_guest_writes_nothing(self):
		frappe.set_user("Guest")
		try:
			self.assertEqual(save_progress(self.lesson_a.name, self.course_a.name), 0)
		finally:
			frappe.set_user("Administrator")
		self.assertEqual(frappe.db.count("LMS Course Progress", {"member": "Guest"}), 0)

	def test_malformed_input_is_rejected(self):
		# __wrapped__ skips frappe's argument coercion to reach the endpoint's own guard.
		unvalidated = save_progress.__wrapped__
		for lesson, course, message in (
			(["!=", ""], self.course_a.name, "must be strings"),
			(self.lesson_a.name, ["!=", ""], "must be strings"),
			("no-such-lesson", self.course_a.name, "Invalid lesson"),
		):
			with self.subTest(lesson=lesson, course=course):
				frappe.set_user(self.student.email)
				try:
					with self.assertRaisesRegex(frappe.ValidationError, message):
						unvalidated(lesson, course)
				finally:
					frappe.set_user("Administrator")

	def test_quiz_submission_uses_the_lessons_current_course_not_the_quizzes_stale_one(self):
		# LMS Quiz.course is fetch_from lesson.course, which only copies on save, so an
		# already-saved quiz can keep pointing at a course the lesson has since left.
		question = frappe.get_doc(
			{
				"doctype": "LMS Question",
				"question": "PCL Quiz Question?",
				"type": "Choices",
				"option_1": "Option 1",
				"is_correct_1": 1,
				"option_2": "Option 2",
				"is_correct_2": 0,
			}
		).insert()
		quiz = frappe.get_doc(
			{
				"doctype": "LMS Quiz",
				"title": f"PCL Quiz {frappe.generate_hash(length=6)}",
				"lesson": self.lesson_a.name,
				"passing_percentage": 0,
				"total_marks": 5,
			}
		)
		quiz.append("questions", {"question": question.name, "marks": 5})
		quiz.insert()
		self.assertEqual(quiz.course, self.course_a.name)
		frappe.db.set_value("LMS Quiz", quiz.name, "course", self.course_b.name)

		quiz_details = frappe._dict(
			lesson=self.lesson_a.name, course=self.course_b.name, passing_percentage=0
		)
		frappe.set_user(self.student.email)
		try:
			save_progress_after_quiz(quiz_details, 100)
		finally:
			frappe.set_user("Administrator")

		self.assertEqual(self._progress_rows(self.lesson_a.name), 1)
		self.assertEqual(
			frappe.db.count(
				"LMS Course Progress", {"lesson": self.lesson_a.name, "course": self.course_b.name}
			),
			0,
		)


class TestUpdateLessonIndexCourseMove(BaseTestUtils):
	"""Moving a lesson to another course's chapter must keep the lesson's own
	chapter/course in sync and needs permission on both courses, not just the source."""

	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6)
		self.owner_a = self._create_user(f"pcl-owner-a-{hash}@example.com", "Owner", "A", ["Course Creator"])
		self.owner_b = self._create_user(f"pcl-owner-b-{hash}@example.com", "Owner", "B", ["Course Creator"])
		self.moderator = self._create_user(f"pcl-mod-{hash}@example.com", "Mod", "Erator", ["Moderator"])

		self.course_a = self._create_course(title=f"PCL Move A {hash}", instructor=self.owner_a.email)
		self.course_b = self._create_course(title=f"PCL Move B {hash}", instructor=self.owner_b.email)
		self.chapter_a = self._create_chapter(f"PCL Move A Chapter {hash}", self.course_a.name)
		self.chapter_b = self._create_chapter(f"PCL Move B Chapter {hash}", self.course_b.name)
		self._create_chapter_reference(self.course_a.name, self.chapter_a.name)
		self._create_chapter_reference(self.course_b.name, self.chapter_b.name)
		self.lesson = self._create_lesson(f"PCL Move Lesson {hash}", self.chapter_a.name, self.course_a.name)
		self._create_lesson_reference(self.chapter_a.name, self.lesson.name)

	def _move(self, as_user):
		frappe.set_user(as_user)
		try:
			return update_lesson_index(self.lesson.name, self.chapter_a.name, self.chapter_b.name, 0)
		finally:
			frappe.set_user("Administrator")

	def test_a_permitted_move_updates_the_lessons_stored_chapter_and_course(self):
		self._move(self.moderator.email)

		moved = frappe.get_doc("Course Lesson", self.lesson.name)
		self.assertEqual(moved.chapter, self.chapter_b.name)
		self.assertEqual(moved.course, self.course_b.name)

	def test_moving_into_a_course_you_cannot_modify_is_refused(self):
		with self.assertRaises(frappe.PermissionError):
			self._move(self.owner_a.email)

		unmoved = frappe.get_doc("Course Lesson", self.lesson.name)
		self.assertEqual(unmoved.chapter, self.chapter_a.name)
		self.assertEqual(unmoved.course, self.course_a.name)
		self.assertTrue(
			frappe.db.exists("Lesson Reference", {"parent": self.chapter_a.name, "lesson": self.lesson.name})
		)
		self.assertFalse(
			frappe.db.exists("Lesson Reference", {"parent": self.chapter_b.name, "lesson": self.lesson.name})
		)
