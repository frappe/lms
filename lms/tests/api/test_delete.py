import frappe
from frappe.utils import add_days, nowdate

from lms.lms.api import delete_chapter, delete_course, delete_lesson
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_course_details


class DeletionTestBase(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.instructor = self._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Course Creator", "Moderator"]
		)
		self.student = self._create_user("student1@example.com", "Ashley", "Smith", ["LMS Student"])
		self.course = self._create_course()

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _add_chapter(self, title, idx):
		chapter = self._create_chapter(title, self.course.name)
		ref = frappe.get_doc(
			{
				"doctype": "Chapter Reference",
				"chapter": chapter.name,
				"parent": self.course.name,
				"parenttype": "LMS Course",
				"parentfield": "chapters",
				"idx": idx,
			}
		).insert()
		self.cleanup_items.append(("Chapter Reference", ref.name))
		return chapter

	def _add_lesson(self, chapter, title, idx):
		lesson = self._create_lesson(title, chapter.name, self.course.name)
		ref = frappe.get_doc(
			{
				"doctype": "Lesson Reference",
				"lesson": lesson.name,
				"parent": chapter.name,
				"parenttype": "Course Chapter",
				"parentfield": "lessons",
				"idx": idx,
			}
		).insert()
		self.cleanup_items.append(("Lesson Reference", ref.name))
		return lesson

	def _lesson_ref_idx(self, chapter, lesson):
		return frappe.db.get_value("Lesson Reference", {"parent": chapter.name, "lesson": lesson.name}, "idx")

	def _chapter_ref_idx(self, chapter):
		return frappe.db.get_value(
			"Chapter Reference", {"parent": self.course.name, "chapter": chapter.name}, "idx"
		)

	def _create_discussion(self, reference_doctype, reference_docname):
		topic = frappe.get_doc(
			{
				"doctype": "Discussion Topic",
				"title": "Test Topic",
				"reference_doctype": reference_doctype,
				"reference_docname": reference_docname,
			}
		).insert(ignore_permissions=True)
		self.cleanup_items.append(("Discussion Topic", topic.name))
		reply = frappe.get_doc(
			{
				"doctype": "Discussion Reply",
				"topic": topic.name,
				"reply": "Test reply",
			}
		).insert(ignore_permissions=True)
		self.cleanup_items.append(("Discussion Reply", reply.name))
		return topic, reply

	def _create_quiz_for_lesson(self, lesson, title="Deletion Quiz"):
		question = frappe.get_doc(
			{
				"doctype": "LMS Question",
				"question": "Deletion question?",
				"type": "Choices",
				"option_1": "A",
				"is_correct_1": 1,
				"option_2": "B",
				"is_correct_2": 0,
			}
		).insert(ignore_permissions=True)
		self.cleanup_items.append(("LMS Question", question.name))

		quiz = frappe.get_doc(
			{
				"doctype": "LMS Quiz",
				"title": title,
				"passing_percentage": 70,
				"questions": [{"question": question.name, "marks": 5}],
			}
		).insert(ignore_permissions=True)
		self.cleanup_items.append(("LMS Quiz", quiz.name))

		# Mirror save_lesson_details_in_quiz: an embedded quiz back-references its lesson.
		frappe.db.set_value("LMS Quiz", quiz.name, {"lesson": lesson, "course": self.course.name})
		return quiz

	def _create_assignment_submission_for_lesson(self, lesson, member):
		assignment = frappe.get_doc(
			{
				"doctype": "LMS Assignment",
				"title": f"Deletion Assignment {frappe.generate_hash()}",
				"question": "Do the thing.",
				"type": "Text",
			}
		).insert(ignore_permissions=True)
		self.cleanup_items.append(("LMS Assignment", assignment.name))

		submission = frappe.get_doc(
			{
				"doctype": "LMS Assignment Submission",
				"assignment": assignment.name,
				"member": member,
				"lesson": lesson,
				"answer": "My answer.",
				"status": "Pass",
			}
		).insert(ignore_permissions=True)
		self.cleanup_items.append(("LMS Assignment Submission", submission.name))
		return submission

	def _create_lesson_note(self, lesson, member):
		note = frappe.get_doc(
			{
				"doctype": "LMS Lesson Note",
				"lesson": lesson,
				"member": member,
				"note": "My note",
			}
		).insert(ignore_permissions=True)
		self.cleanup_items.append(("LMS Lesson Note", note.name))
		return note


class TestLessonDeletion(DeletionTestBase):
	def setUp(self):
		super().setUp()
		self.chapter = self._add_chapter("Chapter 1", 1)
		frappe.set_user(self.instructor.email)

	def test_removes_lesson_and_its_reference(self):
		lesson = self._add_lesson(self.chapter, "Lesson 1", 1)

		delete_lesson(lesson.name, self.chapter.name)

		self.assertFalse(frappe.db.exists("Course Lesson", lesson.name))
		self.assertFalse(
			frappe.db.exists("Lesson Reference", {"parent": self.chapter.name, "lesson": lesson.name})
		)

	def test_reindexes_remaining_lessons(self):
		first = self._add_lesson(self.chapter, "Lesson 1", 1)
		middle = self._add_lesson(self.chapter, "Lesson 2", 2)
		last = self._add_lesson(self.chapter, "Lesson 3", 3)

		delete_lesson(middle.name, self.chapter.name)

		self.assertEqual(self._lesson_ref_idx(self.chapter, first), 1)
		self.assertEqual(self._lesson_ref_idx(self.chapter, last), 2)

	def test_cleans_up_progress_and_watch_duration(self):
		lesson = self._add_lesson(self.chapter, "Lesson 1", 1)
		self._create_progress(self.student.email, self.course.name, lesson.name)
		frappe.get_doc(
			{
				"doctype": "LMS Video Watch Duration",
				"member": self.student.email,
				"lesson": lesson.name,
				"source": "a.mp4",
				"watch_time": 12,
			}
		).insert(ignore_permissions=True)

		delete_lesson(lesson.name, self.chapter.name)

		self.assertFalse(frappe.db.exists("LMS Course Progress", {"lesson": lesson.name}))
		self.assertFalse(frappe.db.exists("LMS Video Watch Duration", {"lesson": lesson.name}))

	def test_removes_lesson_discussions(self):
		lesson = self._add_lesson(self.chapter, "Lesson 1", 1)
		topic, reply = self._create_discussion("Course Lesson", lesson.name)

		delete_lesson(lesson.name, self.chapter.name)

		self.assertFalse(frappe.db.exists("Discussion Topic", topic.name))
		self.assertFalse(frappe.db.exists("Discussion Reply", reply.name))

	def test_unlinks_quiz_instead_of_blocking_deletion(self):
		lesson = self._add_lesson(self.chapter, "Lesson 1", 1)
		quiz = self._create_quiz_for_lesson(lesson.name)

		delete_lesson(lesson.name, self.chapter.name)

		self.assertFalse(frappe.db.exists("Course Lesson", lesson.name))
		self.assertTrue(frappe.db.exists("LMS Quiz", quiz.name))
		self.assertIsNone(frappe.db.get_value("LMS Quiz", quiz.name, "lesson"))

	def test_unlinks_enrollment_current_lesson(self):
		lesson = self._add_lesson(self.chapter, "Lesson 1", 1)
		enrollment = self._create_enrollment(self.student.email, self.course.name)
		frappe.db.set_value("LMS Enrollment", enrollment.name, "current_lesson", lesson.name)

		delete_lesson(lesson.name, self.chapter.name)

		self.assertTrue(frappe.db.exists("LMS Enrollment", enrollment.name))
		self.assertIsNone(frappe.db.get_value("LMS Enrollment", enrollment.name, "current_lesson"))

	def test_unlinks_assignment_submission(self):
		lesson = self._add_lesson(self.chapter, "Lesson 1", 1)
		submission = self._create_assignment_submission_for_lesson(lesson.name, self.student.email)

		delete_lesson(lesson.name, self.chapter.name)

		self.assertTrue(frappe.db.exists("LMS Assignment Submission", submission.name))
		self.assertIsNone(frappe.db.get_value("LMS Assignment Submission", submission.name, "lesson"))

	def test_deletes_linked_notes(self):
		lesson = self._add_lesson(self.chapter, "Lesson 1", 1)
		note = self._create_lesson_note(lesson.name, self.student.email)

		delete_lesson(lesson.name, self.chapter.name)

		self.assertFalse(frappe.db.exists("LMS Lesson Note", note.name))

	def test_student_cannot_delete_lesson(self):
		lesson = self._add_lesson(self.chapter, "Lesson 1", 1)
		frappe.set_user(self.student.email)

		with self.assertRaises(frappe.PermissionError):
			delete_lesson(lesson.name, self.chapter.name)

		self.assertTrue(frappe.db.exists("Course Lesson", lesson.name))


class TestChapterDeletion(DeletionTestBase):
	def setUp(self):
		super().setUp()
		frappe.set_user(self.instructor.email)

	def test_removes_chapter_with_its_lessons_and_references(self):
		chapter = self._add_chapter("Chapter 1", 1)
		lesson = self._add_lesson(chapter, "Lesson 1", 1)

		delete_chapter(chapter.name)

		self.assertFalse(frappe.db.exists("Course Chapter", chapter.name))
		self.assertFalse(frappe.db.exists("Chapter Reference", {"chapter": chapter.name}))
		self.assertFalse(frappe.db.exists("Course Lesson", lesson.name))
		self.assertFalse(frappe.db.exists("Lesson Reference", {"parent": chapter.name}))

	def test_reindexes_remaining_chapters(self):
		first = self._add_chapter("Chapter 1", 1)
		middle = self._add_chapter("Chapter 2", 2)
		last = self._add_chapter("Chapter 3", 3)

		delete_chapter(middle.name)

		self.assertEqual(self._chapter_ref_idx(first), 1)
		self.assertEqual(self._chapter_ref_idx(last), 2)

	def test_removes_lesson_discussions_and_progress(self):
		chapter = self._add_chapter("Chapter 1", 1)
		lesson = self._add_lesson(chapter, "Lesson 1", 1)
		topic, reply = self._create_discussion("Course Lesson", lesson.name)
		self._create_progress(self.student.email, self.course.name, lesson.name)

		delete_chapter(chapter.name)

		self.assertFalse(frappe.db.exists("Discussion Topic", topic.name))
		self.assertFalse(frappe.db.exists("Discussion Reply", reply.name))
		self.assertFalse(frappe.db.exists("LMS Course Progress", {"lesson": lesson.name}))

	def test_cleans_up_lesson_backreferences(self):
		# delete_chapter deletes lessons via a raw db.delete that bypasses on_trash,
		# so it must clean up back-references itself or leave them dangling.
		chapter = self._add_chapter("Chapter 1", 1)
		lesson = self._add_lesson(chapter, "Lesson 1", 1)
		quiz = self._create_quiz_for_lesson(lesson.name)
		note = self._create_lesson_note(lesson.name, self.student.email)
		submission = self._create_assignment_submission_for_lesson(lesson.name, self.student.email)
		enrollment = self._create_enrollment(self.student.email, self.course.name)
		frappe.db.set_value("LMS Enrollment", enrollment.name, "current_lesson", lesson.name)

		delete_chapter(chapter.name)

		self.assertFalse(frappe.db.exists("Course Lesson", lesson.name))
		self.assertFalse(frappe.db.exists("LMS Lesson Note", note.name))
		self.assertIsNone(frappe.db.get_value("LMS Quiz", quiz.name, "lesson"))
		self.assertIsNone(frappe.db.get_value("LMS Assignment Submission", submission.name, "lesson"))
		self.assertIsNone(frappe.db.get_value("LMS Enrollment", enrollment.name, "current_lesson"))

	def test_student_cannot_delete_chapter(self):
		chapter = self._add_chapter("Chapter 1", 1)
		frappe.set_user(self.student.email)

		with self.assertRaises(frappe.PermissionError):
			delete_chapter(chapter.name)

		self.assertTrue(frappe.db.exists("Course Chapter", chapter.name))


class TestCourseDeletion(DeletionTestBase):
	def setUp(self):
		super().setUp()
		self.chapter = self._add_chapter("Chapter 1", 1)
		self.lesson = self._add_lesson(self.chapter, "Lesson 1", 1)
		frappe.set_user(self.instructor.email)

	def test_removes_course_with_chapters_and_lessons(self):
		delete_course(self.course.name)

		self.assertFalse(frappe.db.exists("LMS Course", self.course.name))
		self.assertFalse(frappe.db.exists("Course Chapter", self.chapter.name))
		self.assertFalse(frappe.db.exists("Course Lesson", self.lesson.name))
		self.assertFalse(frappe.db.exists("Chapter Reference", {"parent": self.course.name}))
		self.assertFalse(frappe.db.exists("Lesson Reference", {"parent": self.chapter.name}))

	def test_cascades_enrollment_progress_and_review(self):
		self._create_enrollment(self.student.email, self.course.name)
		self._create_progress(self.student.email, self.course.name, self.lesson.name)

		delete_course(self.course.name)

		self.assertFalse(frappe.db.exists("LMS Enrollment", {"course": self.course.name}))
		self.assertFalse(frappe.db.exists("LMS Course Progress", {"course": self.course.name}))

	def test_cascades_reviews_certificates_and_discussions(self):
		self._create_enrollment(self.student.email, self.course.name)
		self._add_rating(self.course.name, self.student.email, 4, "Great course")
		self._create_certificate(self.course.name, self.student.email)
		topic, reply = self._create_discussion("Course Lesson", self.lesson.name)

		delete_course(self.course.name)

		self.assertFalse(frappe.db.exists("LMS Course Review", {"course": self.course.name}))
		self.assertFalse(frappe.db.exists("LMS Certificate", {"course": self.course.name}))
		self.assertFalse(frappe.db.exists("Discussion Topic", topic.name))
		self.assertFalse(frappe.db.exists("Discussion Reply", reply.name))

	def test_unlinks_lesson_backreferences(self):
		quiz = self._create_quiz_for_lesson(self.lesson.name)
		note = self._create_lesson_note(self.lesson.name, self.student.email)
		submission = self._create_assignment_submission_for_lesson(self.lesson.name, self.student.email)

		delete_course(self.course.name)

		self.assertFalse(frappe.db.exists("Course Lesson", self.lesson.name))
		self.assertFalse(frappe.db.exists("LMS Lesson Note", note.name))
		self.assertTrue(frappe.db.exists("LMS Quiz", quiz.name))
		self.assertIsNone(frappe.db.get_value("LMS Quiz", quiz.name, "lesson"))
		self.assertIsNone(frappe.db.get_value("LMS Assignment Submission", submission.name, "lesson"))

	def test_deletes_course_with_all_course_referrers(self):
		# Every doc that references the course via a Link must be cleaned up, else the
		# final course delete is blocked by LinkExistsError.
		assignment = frappe.get_doc(
			{
				"doctype": "LMS Assignment",
				"title": f"Ref Assignment {frappe.generate_hash()}",
				"question": "Q",
				"type": "Text",
				"course": self.course.name,
			}
		).insert(ignore_permissions=True)
		self.cleanup_items.append(("LMS Assignment", assignment.name))

		cert_request = frappe.get_doc(
			{
				"doctype": "LMS Certificate Request",
				"course": self.course.name,
				"member": self.student.email,
				"date": add_days(nowdate(), 5),
				"start_time": "10:00:00",
				"end_time": "11:00:00",
			}
		).insert(ignore_permissions=True)
		self.cleanup_items.append(("LMS Certificate Request", cert_request.name))

		cert_eval = frappe.get_doc(
			{
				"doctype": "LMS Certificate Evaluation",
				"course": self.course.name,
				"member": self.student.email,
				"date": add_days(nowdate(), 5),
				"start_time": "10:00:00",
				"status": "Pending",
			}
		).insert(ignore_permissions=True)
		self.cleanup_items.append(("LMS Certificate Evaluation", cert_eval.name))

		interest = frappe.get_doc(
			{
				"doctype": "LMS Course Interest",
				"course": self.course.name,
				"user": self.student.email,
			}
		).insert(ignore_permissions=True)
		self.cleanup_items.append(("LMS Course Interest", interest.name))

		mentor = frappe.get_doc(
			{
				"doctype": "LMS Course Mentor Mapping",
				"course": self.course.name,
				"mentor": self.student.email,
			}
		).insert(ignore_permissions=True)
		self.cleanup_items.append(("LMS Course Mentor Mapping", mentor.name))

		# This course listed as "related" inside another course.
		other = self._create_course(title="Other Referrer Course")
		other.append("related_courses", {"course": self.course.name})
		other.save(ignore_permissions=True)

		# This course included in a program.
		program = frappe.get_doc(
			{
				"doctype": "LMS Program",
				"title": f"Ref Program {frappe.generate_hash()}",
				"program_courses": [{"course": self.course.name}],
			}
		).insert(ignore_permissions=True)
		self.cleanup_items.append(("LMS Program", program.name))

		delete_course(self.course.name)

		self.assertFalse(frappe.db.exists("LMS Course", self.course.name))
		self.assertFalse(frappe.db.exists("LMS Certificate Request", cert_request.name))
		self.assertFalse(frappe.db.exists("LMS Certificate Evaluation", cert_eval.name))
		self.assertFalse(frappe.db.exists("LMS Course Interest", interest.name))
		self.assertFalse(frappe.db.exists("LMS Course Mentor Mapping", mentor.name))
		self.assertFalse(frappe.db.exists("Related Courses", {"course": self.course.name}))
		self.assertFalse(frappe.db.exists("LMS Program Course", {"course": self.course.name}))
		# The reusable assignment definition is preserved, just unlinked from the course.
		self.assertTrue(frappe.db.exists("LMS Assignment", assignment.name))
		self.assertIsNone(frappe.db.get_value("LMS Assignment", assignment.name, "course"))

	def test_get_course_details_on_deleted_course_returns_empty(self):
		course_name = self.course.name
		delete_course(course_name)

		# A moderator can_modify any course, so the published/membership early-return
		# is skipped; the function must still not crash on the now-missing course.
		self.assertEqual(get_course_details(course_name), {})

	def test_student_cannot_delete_course(self):
		frappe.set_user(self.student.email)

		with self.assertRaises(frappe.PermissionError):
			delete_course(self.course.name)

		self.assertTrue(frappe.db.exists("LMS Course", self.course.name))
