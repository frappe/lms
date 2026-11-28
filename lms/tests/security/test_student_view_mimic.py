import json

import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import (
	get_batch_courses,
	get_batch_details,
	get_course_details,
	get_course_outline,
	get_lesson,
	get_quiz_with_questions,
)

NOTES = json.dumps({"blocks": [{"type": "paragraph", "data": {"text": "a"}}] * 2})


class TestStudentViewMimicsAStudent(BaseTestUtils):
	"""In student view an author gets exactly what a plain LMS Student in the same
	enrollment state gets; the flag never gives anyone more."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		suffix = frappe.generate_hash(length=6)
		user = cls._create_user
		cls.moderator = user(f"svm-mod-{suffix}@example.com", "Mod", suffix, ["Moderator"]).name
		cls.instructor = user(f"svm-ins-{suffix}@example.com", "Ins", suffix, ["Course Creator"]).name
		cls.student = user(f"svm-stu-{suffix}@example.com", "Stu", suffix, ["LMS Student"]).name
		cls.visitor = user(f"svm-vis-{suffix}@example.com", "Vis", suffix, ["LMS Student"]).name
		cls._require_no_moderators(cls.instructor, cls.student, cls.visitor)

		cls.course, cls.lessons = cls.gated_course(f"SVM course {suffix}")
		cls.draft, cls.draft_lessons = cls.gated_course(f"SVM draft {suffix}")
		frappe.db.set_value("LMS Course", cls.draft, "published", 0)

		# Every previewer and the student are enrolled with the first lesson done.
		for member in (cls.moderator, cls.instructor, cls.student):
			for course, lessons in ((cls.course, cls.lessons), (cls.draft, cls.draft_lessons)):
				cls._create_enrollment(member, course)
				cls._create_lesson_progress(member, course, lessons[0])

		cls.quiz = cls._create_quiz(cls._create_quiz_questions(), f"SVM quiz {suffix}").name
		frappe.db.set_value("LMS Quiz", cls.quiz, "show_answers", 0)
		quiz_course = cls._create_course(f"SVM quiz course {suffix}", cls.instructor).name
		cls._place_in_lesson(quiz_course, "LMS Quiz", cls.quiz)
		cls._create_evaluator(cls.instructor)
		cls.batch = cls._create_batch(cls.course, cls.instructor, f"SVM batch {suffix}", cls.instructor).name

	@classmethod
	def gated_course(cls, title):
		course = cls._create_course(title, cls.instructor).name
		frappe.db.set_value("LMS Course", course, "enforce_lesson_completion", 1)
		chapter = cls._create_chapter(f"{title} chapter", course).name
		cls._create_chapter_reference(course, chapter)
		lessons = []
		for idx in range(1, 4):
			lesson = cls._create_lesson(f"{title} lesson {idx}", chapter, course).name
			frappe.get_doc(
				{
					"doctype": "Lesson Reference",
					"lesson": lesson,
					"parent": chapter,
					"parenttype": "Course Chapter",
					"parentfield": "lessons",
					"idx": idx,
				}
			).insert()
			lessons.append(lesson)
		frappe.db.set_value("Course Lesson", lessons[0], "include_in_preview", 1)
		for lesson in lessons:
			frappe.db.set_value("Course Lesson", lesson, "instructor_content", NOTES)
		return course, lessons

	def call_as(self, user, fn, *args, **kwargs):
		frappe.set_user(user)
		try:
			return normalise(fn(*args, **kwargs))
		finally:
			frappe.set_user("Administrator")

	def assert_previewers_match(self, mode, baseline, fn, *args):
		expected = self.call_as(baseline, fn, *args)
		for previewer in (self.moderator, self.instructor):
			with self.subTest(previewer=previewer, mode=mode, endpoint=fn.__name__, args=args):
				self.assertEqual(self.call_as(previewer, fn, *args, student_view=mode), expected)

	def test_outline_locks_match_a_student(self):
		self.assert_previewers_match("enrolled", self.student, get_course_outline, self.course, True)
		self.assert_previewers_match("not-enrolled", self.visitor, get_course_outline, self.course, True)
		lessons = self.call_as(self.moderator, get_course_outline, self.course, True, student_view="enrolled")
		self.assertEqual([lesson["locked"] for lesson in lessons[0]["lessons"]], [0, 0, 1])

	def test_a_locked_lesson_redirects_like_a_student(self):
		self.assert_previewers_match("enrolled", self.student, get_lesson, self.course, 1, 3)
		response = self.call_as(self.instructor, get_lesson, self.course, 1, 3, student_view="enrolled")
		self.assertEqual((response["locked"], response["redirect_to"]), (1, "1-2"))

	def test_an_open_lesson_matches_a_student_without_notes(self):
		self.assert_previewers_match("enrolled", self.student, get_lesson, self.course, 1, 2)
		response = self.call_as(self.moderator, get_lesson, self.course, 1, 2, student_view="enrolled")
		self.assertIsNone(response["instructor_content"])
		real = self.call_as(self.moderator, get_lesson, self.course, 1, 2)
		self.assertEqual(real["instructor_content"], NOTES)

	def test_not_enrolled_sees_only_preview_lessons(self):
		for lesson in (1, 2, 3):
			self.assert_previewers_match("not-enrolled", self.visitor, get_lesson, self.course, 1, lesson)
		response = self.call_as(self.moderator, get_lesson, self.course, 1, 2, student_view="not-enrolled")
		self.assertEqual(response["no_preview"], 1)
		self.assertNotIn("content", response)

	def test_course_details_match_a_student(self):
		self.assert_previewers_match("enrolled", self.student, get_course_details, self.course)
		self.assert_previewers_match("not-enrolled", self.visitor, get_course_details, self.course)

	def test_a_draft_course_stays_open_to_its_author_but_answers_as_a_student(self):
		self.assert_previewers_match("enrolled", self.student, get_lesson, self.draft, 1, 2)
		self.assert_previewers_match("enrolled", self.student, get_course_outline, self.draft, True)
		response = self.call_as(self.instructor, get_lesson, self.draft, 1, 2, student_view="not-enrolled")
		self.assertEqual(response["no_preview"], 1)
		self.assertNotIn("instructor_content", response)

	def test_a_student_passing_the_flag_gets_nothing_extra(self):
		for user in (self.student, self.visitor):
			for mode in ("enrolled", "not-enrolled", "1"):
				for fn, args in (
					(get_lesson, (self.course, 1, 2)),
					(get_lesson, (self.course, 1, 3)),
					(get_course_outline, (self.course, True)),
					(get_course_details, (self.course,)),
				):
					with self.subTest(user=user, mode=mode, endpoint=fn.__name__, args=args):
						self.assertEqual(
							self.call_as(user, fn, *args, student_view=mode), self.call_as(user, fn, *args)
						)

	def test_an_unknown_mode_is_ignored(self):
		real = self.call_as(self.moderator, get_lesson, self.course, 1, 3)
		self.assertEqual(self.call_as(self.moderator, get_lesson, self.course, 1, 3, student_view="x"), real)
		self.assertNotIn("locked", real)

	def test_the_flag_does_not_leak_past_the_request(self):
		self.call_as(self.moderator, get_lesson, self.course, 1, 2, student_view="enrolled")
		self.assertFalse(frappe.flags.student_view)
		self.assertNotIn("locked", self.call_as(self.moderator, get_lesson, self.course, 1, 3))

	def test_quiz_answers_are_withheld_in_student_view(self):
		def explanations(user, **kwargs):
			questions = self.call_as(user, get_quiz_with_questions, self.quiz, **kwargs)["questions_by_name"]
			return [key for row in questions.values() for key in row if key.startswith("explanation")]

		self.assertTrue(explanations(self.moderator))
		self.assertEqual(explanations(self.moderator, student_view="enrolled"), [])

	def test_batch_answers_as_a_student(self):
		for mode, is_student in (("enrolled", False), ("not-enrolled", False)):
			with self.subTest(mode=mode):
				details = self.call_as(self.instructor, get_batch_details, self.batch, student_view=mode)
				self.assertFalse(details["can_manage"] or details["can_change_instructors"])
				self.assertEqual(details["is_student"], is_student)
		self.assertTrue(self.call_as(self.instructor, get_batch_details, self.batch)["can_manage"])

		courses = self.call_as(self.instructor, get_batch_courses, self.batch, student_view="not-enrolled")
		self.assertFalse(courses[0]["membership"])
		courses = self.call_as(self.instructor, get_batch_courses, self.batch, student_view="enrolled")
		self.assertTrue(courses[0]["membership"])


def normalise(response):
	"""The response with the caller's own identity taken out, so two callers compare:
	their enrollment's name, and their own email, which instructor rows keep."""
	response = json.loads(frappe.as_json(response))
	for item in response if isinstance(response, list) else [response]:
		if not isinstance(item, dict):
			continue
		for key in ("name", "member"):
			(item.get("membership") or {}).pop(key, None)
		for instructor in item.get("instructors") or []:
			if instructor.get("name") == frappe.session.user:
				instructor.pop("name")
	return response
