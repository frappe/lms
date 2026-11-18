from contextlib import contextmanager
from unittest.mock import patch

import frappe
from frappe.utils import add_days, nowdate

from lms.lms.api import delete_batch, delete_category, delete_chapter, delete_course, delete_lesson
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_course_details


class DeletionTestBase(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.instructor = cls._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Course Creator", "Moderator"]
		)
		cls.student = cls._create_user("student1@example.com", "Ashley", "Smith", ["LMS Student"])

	def setUp(self):
		super().setUp()
		self.course = self._create_course()

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _add_chapter(self, title, idx):
		chapter = self._create_chapter(title, self.course.name)
		frappe.get_doc(
			{
				"doctype": "Chapter Reference",
				"chapter": chapter.name,
				"parent": self.course.name,
				"parenttype": "LMS Course",
				"parentfield": "chapters",
				"idx": idx,
			}
		).insert()
		return chapter

	def _add_lesson(self, chapter, title, idx):
		lesson = self._create_lesson(title, chapter.name, self.course.name)
		frappe.get_doc(
			{
				"doctype": "Lesson Reference",
				"lesson": lesson.name,
				"parent": chapter.name,
				"parenttype": "Course Chapter",
				"parentfield": "lessons",
				"idx": idx,
			}
		).insert()
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
		reply = frappe.get_doc(
			{
				"doctype": "Discussion Reply",
				"topic": topic.name,
				"reply": "Test reply",
			}
		).insert(ignore_permissions=True)
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

		quiz = frappe.get_doc(
			{
				"doctype": "LMS Quiz",
				"title": title,
				"passing_percentage": 70,
				"questions": [{"question": question.name, "marks": 5}],
			}
		).insert(ignore_permissions=True)

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

	def test_deleting_a_lesson_cleans_up_all_its_backreferences(self):
		# Build every back-reference kind on one lesson and delete it once (the
		# pattern TestChapterDeletion.test_cleans_up_lesson_backreferences already
		# uses), then check each cascade as its own subTest row.
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
		topic, reply = self._create_discussion("Course Lesson", lesson.name)
		quiz = self._create_quiz_for_lesson(lesson.name)
		enrollment = self._create_enrollment(self.student.email, self.course.name)
		frappe.db.set_value("LMS Enrollment", enrollment.name, "current_lesson", lesson.name)
		submission = self._create_assignment_submission_for_lesson(lesson.name, self.student.email)
		note = self._create_lesson_note(lesson.name, self.student.email)

		delete_lesson(lesson.name, self.chapter.name)

		with self.subTest(case="progress_and_watch_duration"):
			self.assertFalse(frappe.db.exists("LMS Course Progress", {"lesson": lesson.name}))
			self.assertFalse(frappe.db.exists("LMS Video Watch Duration", {"lesson": lesson.name}))
		with self.subTest(case="discussions"):
			self.assertFalse(frappe.db.exists("Discussion Topic", topic.name))
			self.assertFalse(frappe.db.exists("Discussion Reply", reply.name))
		with self.subTest(case="quiz_unlinked_not_deleted"):
			self.assertTrue(frappe.db.exists("LMS Quiz", quiz.name))
			self.assertIsNone(frappe.db.get_value("LMS Quiz", quiz.name, "lesson"))
		with self.subTest(case="enrollment_current_lesson_unlinked"):
			self.assertTrue(frappe.db.exists("LMS Enrollment", enrollment.name))
			self.assertIsNone(frappe.db.get_value("LMS Enrollment", enrollment.name, "current_lesson"))
		with self.subTest(case="assignment_submission_unlinked"):
			self.assertTrue(frappe.db.exists("LMS Assignment Submission", submission.name))
			self.assertIsNone(frappe.db.get_value("LMS Assignment Submission", submission.name, "lesson"))
		with self.subTest(case="notes_deleted"):
			self.assertFalse(frappe.db.exists("LMS Lesson Note", note.name))


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


class TestChapterDeletionReferrers(DeletionTestBase):
	"""Review finding c1: rows naming a lesson by dynamic link blocked the chapter delete."""

	def setUp(self):
		super().setUp()
		self.chapter = self._add_chapter("Chapter 1", 1)
		self.lesson = self._add_lesson(self.chapter, "Lesson 1", 1)

	def test_timetable_rows_naming_a_lesson_go_with_it(self):
		self._create_evaluator()
		batch = self._create_batch(self.course.name)
		batch.append("timetable", self._timetable_row())
		# nosemgrep: lms-unjustified-ignore-permissions - test fixture seeding, not the permission under test
		batch.save(ignore_permissions=True)
		# nosemgrep: lms-unjustified-ignore-permissions - test fixture seeding, not the permission under test
		template = frappe.get_doc(
			{"doctype": "LMS Timetable Template", "title": "Template", "timetable": [self._timetable_row()]}
		).insert(ignore_permissions=True)
		frappe.set_user(self.instructor.name)

		delete_chapter(self.chapter.name)

		self.assertFalse(frappe.db.exists("Course Lesson", self.lesson.name))
		for parent in (batch.name, template.name):
			with self.subTest(parent=parent):
				self.assertFalse(frappe.db.exists("LMS Batch Timetable", {"parent": parent}))
		self.assertTrue(frappe.db.exists("LMS Batch", batch.name))
		self.assertTrue(frappe.db.exists("LMS Timetable Template", template.name))

	def test_progress_is_recounted_once_per_chapter_after_commit(self):
		"""Review finding c2: each lesson's delete enqueued its own recount of every learner."""
		self._add_lesson(self.chapter, "Lesson 2", 2)
		self._create_enrollment(self.student.name, self.course.name)
		frappe.set_user(self.instructor.name)

		with patch("frappe.enqueue") as enqueue:
			delete_chapter(self.chapter.name)

		recounts = [
			call
			for call in enqueue.call_args_list
			if call.args and getattr(call.args[0], "__name__", None) == "recalculate_progress"
		]
		self.assertEqual(len(recounts), 1)
		self.assertEqual(recounts[0].kwargs["course"], self.course.name)
		self.assertEqual(recounts[0].kwargs["members"], [self.student.name])
		self.assertTrue(recounts[0].kwargs["enqueue_after_commit"])

	def _timetable_row(self):
		return {
			"reference_doctype": "Course Lesson",
			"reference_docname": self.lesson.name,
			"date": nowdate(),
			"start_time": "10:00:00",
			"end_time": "11:00:00",
		}


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

		interest = frappe.get_doc(
			{
				"doctype": "LMS Course Interest",
				"course": self.course.name,
				"user": self.student.email,
			}
		).insert(ignore_permissions=True)

		mentor = frappe.get_doc(
			{
				"doctype": "LMS Course Mentor Mapping",
				"course": self.course.name,
				"mentor": self.student.email,
			}
		).insert(ignore_permissions=True)

		# This course listed as "related" inside another course.
		other = self._create_course(title="Other Referrer Course")
		other.append("related_courses", {"course": self.course.name})
		other.save(ignore_permissions=True)

		# This course included in a program.
		frappe.get_doc(
			{
				"doctype": "LMS Program",
				"title": f"Ref Program {frappe.generate_hash()}",
				"program_courses": [{"course": self.course.name}],
			}
		).insert(ignore_permissions=True)

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


class TestCategoryDeletion(DeletionTestBase):
	def setUp(self):
		super().setUp()
		self.category = self.course.category

	def test_unlinks_category_from_courses_then_deletes(self):
		delete_category(self.category)

		self.assertFalse(frappe.db.exists("LMS Category", self.category))
		self.assertFalse(frappe.db.get_value("LMS Course", self.course.name, "category"))

	def test_reports_what_it_unlinked(self):
		# the site is shared, so count what is linked rather than assume a number
		linked = {
			doctype: frappe.db.count(doctype, {"category": self.category})
			for doctype in ("LMS Course", "LMS Batch")
		}
		self.assertGreaterEqual(linked["LMS Course"], 1)

		unlinked = delete_category(self.category)

		self.assertEqual(unlinked, linked)

	def test_unknown_category_is_rejected(self):
		with self.assertRaises(frappe.ValidationError):
			delete_category("No Such Category")


class TestStudentCannotDelete(DeletionTestBase):
	def setUp(self):
		super().setUp()
		self.chapter = self._add_chapter("Chapter 1", 1)
		self.lesson = self._add_lesson(self.chapter, "Lesson 1", 1)
		self.category = self.course.category
		frappe.set_user(self.student.email)

	def test_student_cannot_delete_at_any_content_level(self):
		cases = [
			(
				"lesson",
				"Course Lesson",
				self.lesson.name,
				lambda: delete_lesson(self.lesson.name, self.chapter.name),
			),
			("chapter", "Course Chapter", self.chapter.name, lambda: delete_chapter(self.chapter.name)),
			("course", "LMS Course", self.course.name, lambda: delete_course(self.course.name)),
			("category", "LMS Category", self.category, lambda: delete_category(self.category)),
		]
		for case, doctype, name, action in cases:
			with self.subTest(case=case):
				with self.assertRaises(frappe.PermissionError):
					action()
				self.assertTrue(frappe.db.exists(doctype, name))


@contextmanager
def refusing_unscoped_deletes():
	"""Contain the red phase: an empty name reaching frappe.db.delete empties the table."""
	original = frappe.db.delete

	def guarded(doctype, filters=None, *args, **kwargs):
		if not filters:
			raise AssertionError(f"unscoped delete of {doctype}")
		return original(doctype, filters, *args, **kwargs)

	with patch.object(frappe.db, "delete", guarded):
		yield


class EmptyOrUnknownNameMixin:
	"""Every delete endpoint refuses a blank or missing name and deletes nothing."""

	def assert_refuses_blank_and_unknown_names(self, endpoint, doctype, survivor):
		for name in ("", f"no-such-{frappe.generate_hash(length=8)}"):
			with self.subTest(name=name):
				with refusing_unscoped_deletes(), self.assertRaises(frappe.DoesNotExistError):
					endpoint(name)
				self.assertTrue(frappe.db.exists(doctype, survivor))


class TestDeleteEndpointsArePostOnly(BaseTestUtils):
	def test_every_delete_endpoint_refuses_get(self):
		"""Regression from #1132 (cf014bca3): delete_chapter took GET, so a cross-site link
		deleted a SCORM package. Added for audit finding #27."""
		for endpoint in (delete_batch, delete_chapter, delete_course):
			with self.subTest(endpoint=endpoint.__name__):
				self.assertEqual(set(frappe.allowed_http_methods_for_whitelisted_func[endpoint]), {"POST"})


class TestBatchDeletion(EmptyOrUnknownNameMixin, DeletionTestBase):
	def setUp(self):
		super().setUp()
		self._create_evaluator()
		self.title = f"Deletion Batch {frappe.generate_hash(length=8)}"
		self.batch = self._create_batch(self.course.name, title=self.title)
		self.batch.append(
			"timetable_legends", {"reference_doctype": "Course Lesson", "color": "Red", "label": "L"}
		)
		# nosemgrep: lms-unjustified-ignore-permissions - test fixture seeding, not the permission under test
		self.batch.save(ignore_permissions=True)

	def _seed_dependants(self):
		enrollment = self._create_batch_enrollment(self.student.name, self.batch.name)
		# nosemgrep: lms-unjustified-ignore-permissions - test fixture seeding, not the permission under test
		feedback = frappe.get_doc(
			{
				"doctype": "LMS Batch Feedback",
				"member": self.student.name,
				"batch": self.batch.name,
				"feedback": "Good batch.",
			}
		).insert(ignore_permissions=True)
		topic, reply = self._create_discussion("LMS Batch", self.batch.name)
		with patch("lms.lms.doctype.lms_live_class.lms_live_class.LMSLiveClass.create_calendar_event"):
			# nosemgrep: lms-unjustified-ignore-permissions - test fixture seeding, not the permission under test
			live_class = frappe.get_doc(
				{
					"doctype": "LMS Live Class",
					"title": "Kick-off",
					"date": nowdate(),
					"time": "10:00:00",
					"duration": 60,
					"timezone": "Asia/Kolkata",
					"host": self.instructor.name,
					"batch_name": self.batch.name,
				}
			).insert(ignore_permissions=True)
		certificate = self._create_certificate(self.course.name, self.student.name)
		frappe.db.set_value("LMS Certificate", certificate.name, "batch_name", self.batch.name)
		return {
			"LMS Batch Enrollment": enrollment.name,
			"LMS Batch Feedback": feedback.name,
			"Discussion Topic": topic.name,
			"Discussion Reply": reply.name,
			"LMS Live Class": live_class.name,
		}, certificate

	def _assert_cascaded(self, dependants, certificate):
		self.assertFalse(frappe.db.exists("LMS Batch", self.batch.name))
		for child in ("Course Instructor", "LMS Timetable Legend", "Batch Course"):
			with self.subTest(child=child):
				self.assertFalse(
					frappe.db.exists(child, {"parent": self.batch.name, "parenttype": "LMS Batch"})
				)
		for doctype, name in dependants.items():
			with self.subTest(doctype=doctype):
				self.assertFalse(frappe.db.exists(doctype, name))
		self.assertTrue(frappe.db.exists("LMS Certificate", certificate.name))
		self.assertIsNone(frappe.db.get_value("LMS Certificate", certificate.name, "batch_name"))

	def test_the_endpoint_leaves_no_orphans(self):
		"""Regression from #1631 (6f9f27c03): the raw delete left dependants behind. Added for
		audit finding #60."""
		dependants, certificate = self._seed_dependants()
		frappe.set_user(self.instructor.name)

		delete_batch(self.batch.name)

		self._assert_cascaded(dependants, certificate)

	def test_a_batch_with_payments_is_refused_before_anything_is_deleted(self):
		"""Review finding c1: delete_doc's dynamic-link check refused the batch only after
		on_trash had deleted its enrolments, and named one payment in a raw message."""
		dependants, _certificate = self._seed_dependants()
		for _ in range(2):
			self._create_batch_payment()
		frappe.set_user(self.instructor.name)

		with self.assertRaises(frappe.LinkExistsError) as caught:
			delete_batch(self.batch.name)

		self.assertIn("This batch has 2 payments, so it can't be deleted.", str(caught.exception))
		self.assertTrue(frappe.db.exists("LMS Batch", self.batch.name))
		for doctype, name in dependants.items():
			with self.subTest(doctype=doctype):
				self.assertTrue(frappe.db.exists(doctype, name))

	def test_a_coupon_keeps_its_other_items(self):
		"""Review finding c1: a coupon item naming the batch blocked its delete."""
		# nosemgrep: lms-unjustified-ignore-permissions - test fixture seeding, not the permission under test
		coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"code": f"DEL{frappe.generate_hash(length=6)}".upper(),
				"discount_type": "Percentage",
				"percentage_discount": 10,
				"applicable_items": [
					{"reference_doctype": "LMS Batch", "reference_name": self.batch.name},
					{"reference_doctype": "LMS Course", "reference_name": self.course.name},
				],
			}
		).insert(ignore_permissions=True)
		frappe.set_user(self.instructor.name)

		delete_batch(self.batch.name)

		self.assertFalse(frappe.db.exists("LMS Batch", self.batch.name))
		self.assertEqual(
			frappe.get_all("LMS Coupon Item", {"parent": coupon.name}, pluck="reference_name"),
			[self.course.name],
		)

	def _create_batch_payment(self):
		# nosemgrep: lms-unjustified-ignore-permissions - test fixture seeding, not the permission under test
		return frappe.get_doc(
			{
				"doctype": "LMS Payment",
				"member": self.student.name,
				"billing_name": "Batch Payer",
				"amount": 100,
				"currency": "INR",
				"payment_for_document_type": "LMS Batch",
				"payment_for_document": self.batch.name,
			}
		).insert(ignore_permissions=True, ignore_mandatory=True)

	def test_a_same_titled_batch_does_not_inherit_the_old_instructors(self):
		"""Regression from #1631 (6f9f27c03), audit finding #60."""
		frappe.set_user(self.instructor.name)
		delete_batch(self.batch.name)
		frappe.set_user("Administrator")

		newcomer = self._create_user(
			f"batch-newcomer-{frappe.generate_hash(length=8)}@example.com", "New", "Comer", ["Course Creator"]
		)
		recreated = self._create_batch(self.course.name, instructor=newcomer.name, title=self.title)

		self.assertEqual(recreated.name, self.batch.name)
		self.assertEqual(
			frappe.get_all(
				"Course Instructor", {"parent": recreated.name, "parenttype": "LMS Batch"}, pluck="instructor"
			),
			[newcomer.name],
		)

	def test_a_student_cannot_delete(self):
		"""Guards can_modify_batch now that delete_doc skips DocPerms (#1631). Audit finding #60."""
		frappe.set_user(self.student.name)
		with self.assertRaises(frappe.PermissionError):
			delete_batch(self.batch.name)
		self.assertTrue(frappe.db.exists("LMS Batch", self.batch.name))

	def test_a_blank_or_unknown_name_is_refused(self):
		"""Regression from #1631 (6f9f27c03): a blank name emptied the table. Added for audit
		finding #19."""
		frappe.set_user(self.instructor.name)
		self.assert_refuses_blank_and_unknown_names(delete_batch, "LMS Batch", self.batch.name)


class TestBlankNamesOnCourseContent(EmptyOrUnknownNameMixin, DeletionTestBase):
	def setUp(self):
		super().setUp()
		self.chapter = self._add_chapter("Chapter 1", 1)
		frappe.set_user(self.instructor.name)

	def test_delete_chapter_refuses_a_blank_or_unknown_name(self):
		"""Regression from #1132 (cf014bca3), audit finding #19."""
		self.assert_refuses_blank_and_unknown_names(delete_chapter, "Course Chapter", self.chapter.name)

	def test_delete_course_refuses_a_blank_or_unknown_name(self):
		"""Regression from #1100 (38e6e4345), audit finding #19."""
		self.assert_refuses_blank_and_unknown_names(delete_course, "LMS Course", self.course.name)


class TestDeskDeleteOfCourseContent(DeletionTestBase):
	def setUp(self):
		super().setUp()
		self.chapter = self._add_chapter("Chapter 1", 1)
		self.lesson = self._add_lesson(self.chapter, "Lesson 1", 1)
		self.topic, self.reply = self._create_discussion("Course Lesson", self.lesson.name)
		self._create_progress(self.student.name, self.course.name, self.lesson.name)

	def _assert_outline_gone(self):
		self.assertFalse(frappe.db.exists("Course Chapter", self.chapter.name))
		self.assertFalse(frappe.db.exists("Chapter Reference", {"chapter": self.chapter.name}))
		self.assertFalse(frappe.db.exists("Course Lesson", self.lesson.name))
		self.assertFalse(frappe.db.exists("Lesson Reference", {"parent": self.chapter.name}))
		self.assertFalse(frappe.db.exists("Discussion Topic", self.topic.name))
		self.assertFalse(frappe.db.exists("Discussion Reply", self.reply.name))
		self.assertFalse(frappe.db.exists("LMS Course Progress", {"lesson": self.lesson.name}))

	def test_a_desk_chapter_delete_takes_its_lessons(self):
		"""Regression from #1132: cleanup lived in the endpoint, so a Desk delete orphaned lessons.
		Added for audit finding #60."""
		frappe.delete_doc("Course Chapter", self.chapter.name)
		self._assert_outline_gone()

	def test_a_desk_course_delete_takes_its_outline_and_enrollments(self):
		"""Regression from #1100: cleanup lived in the endpoint, so a Desk delete orphaned the outline.
		Added for audit finding #60."""
		enrollment = self._create_enrollment(self.student.name, self.course.name)

		frappe.delete_doc("LMS Course", self.course.name)

		self.assertFalse(frappe.db.exists("LMS Course", self.course.name))
		self.assertFalse(frappe.db.exists("LMS Enrollment", enrollment.name))
		self._assert_outline_gone()


class TestCourseDeletionUpdatesPrograms(DeletionTestBase):
	def test_program_course_count_drops_with_the_course(self):
		"""Regression from #2537 (c5a86ebd9): the raw delete left course_count stale. Added for
		audit finding #95."""
		other = self._create_course(title=f"Program Sibling {frappe.generate_hash(length=8)}")
		# nosemgrep: lms-unjustified-ignore-permissions - test fixture seeding, not the permission under test
		program = frappe.get_doc(
			{
				"doctype": "LMS Program",
				"title": f"Count Program {frappe.generate_hash(length=8)}",
				"program_courses": [{"course": self.course.name}, {"course": other.name}],
			}
		).insert(ignore_permissions=True)
		self.assertEqual(program.course_count, 2)
		frappe.set_user(self.instructor.name)

		delete_course(self.course.name)

		self.assertEqual(frappe.db.get_value("LMS Program", program.name, "course_count"), 1)
