# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

import json
from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from lms.lms.permissions import enforces_lesson_completion, get_locked_lessons
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import compute_locked_lessons


class TestComputeLockedLessons(FrappeTestCase):
	def test_nothing_complete_leaves_only_the_first_lesson_open(self):
		locked = compute_locked_lessons(["L1", "L2", "L3"], set())
		self.assertEqual(locked, {"L2", "L3"})

	def test_completing_the_first_opens_the_second(self):
		locked = compute_locked_lessons(["L1", "L2", "L3"], {"L1"})
		self.assertEqual(locked, {"L3"})

	def test_all_complete_locks_nothing(self):
		locked = compute_locked_lessons(["L1", "L2"], {"L1", "L2"})
		self.assertEqual(locked, set())

	def test_a_lesson_completed_out_of_order_stays_open(self):
		# Flag switched on mid-cohort: L3 was already finished, so it must not lock.
		locked = compute_locked_lessons(["L1", "L2", "L3", "L4"], {"L3"})
		self.assertEqual(locked, {"L2", "L4"})

	def test_empty_course_locks_nothing(self):
		self.assertEqual(compute_locked_lessons([], set()), set())

	def test_a_repeated_lesson_does_not_lock_its_own_first_occurrence(self):
		# A lesson referenced from two chapters used to be locked by its later
		# occurrence, which — the return value being a set of names — locked the first
		# one too. With lesson one locked there is nowhere left to redirect to.
		locked = compute_locked_lessons(["L1", "L2", "L1"], set())
		self.assertEqual(locked, {"L2"})


class TestLessonLockingIntegration(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		# The worktree's field reaches the test site's schema only via reload_doctype;
		# bench migrate cannot see this worktree.
		frappe.reload_doctype("LMS Course")

	def setUp(self):
		super().setUp()
		self.student = self._create_user("locking-student@example.com", "Lock", "Student", ["LMS Student"])
		self.author = self._create_user(
			"locking-author@example.com", "Lock", "Author", ["Course Creator", "Moderator"]
		)
		self.course = self._create_course(title="Locking Course", instructor=self.author.email)
		self.chapter = self._create_chapter("Locking Chapter", self.course.name)
		self._create_chapter_reference(self.course.name, self.chapter.name, idx=1)

		self.lessons = []
		for idx in range(1, 4):
			lesson = self._create_lesson(f"Locking Lesson {idx}", self.chapter.name, self.course.name)
			self.lessons.append(lesson)

		chapter_doc = frappe.get_doc("Course Chapter", self.chapter.name)
		for lesson in self.lessons:
			chapter_doc.append("lessons", {"lesson": lesson.name})
		chapter_doc.save()

		self._create_enrollment(self.student.email, self.course.name)
		frappe.set_user(self.student.email)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _enable(self):
		frappe.db.set_value("LMS Course", self.course.name, "enforce_lesson_completion", 1)

	def _complete(self, lesson_name):
		"""Mark a lesson complete for the student, as the system would."""
		user = frappe.session.user
		frappe.set_user("Administrator")
		progress = self._create_progress(self.student.email, self.course.name, lesson_name)
		frappe.db.set_value("LMS Course Progress", progress.name, "status", "Complete")
		frappe.set_user(user)
		return progress

	def _set_pointer(self, lesson_name):
		user = frappe.session.user
		frappe.set_user("Administrator")
		enrollment = frappe.db.get_value(
			"LMS Enrollment", {"course": self.course.name, "member": self.student.email}
		)
		frappe.db.set_value("LMS Enrollment", enrollment, "current_lesson", lesson_name)
		frappe.set_user(user)

	def _add_scorm_chapter(self, title="Locking SCORM Chapter"):
		"""A SCORM chapter after the plain ones, so it is locked until they are done."""
		user = frappe.session.user
		frappe.set_user("Administrator")
		chapter = self._create_chapter(title, self.course.name)
		self._create_chapter_reference(self.course.name, chapter.name, idx=2)
		frappe.db.set_value(
			"Course Chapter", chapter.name, {"is_scorm_package": 1, "launch_file": "index.html"}
		)
		lesson = self._create_lesson("SCORM Lesson", chapter.name, self.course.name)
		self._create_lesson_reference(chapter.name, lesson.name)
		frappe.set_user(user)
		return chapter, lesson

	def _create_lesson_quiz(self, lesson_name, title="Locking Lesson Quiz"):
		user = frappe.session.user
		frappe.set_user("Administrator")
		quiz = frappe.get_doc(
			{
				"doctype": "LMS Quiz",
				"title": title,
				"course": self.course.name,
				"lesson": lesson_name,
				"passing_percentage": 70,
			}
		).insert(ignore_permissions=True)
		self.cleanup_items.append(("LMS Quiz", quiz.name))
		frappe.set_user(user)
		return quiz

	def test_flag_off_locks_nothing(self):
		self.assertFalse(enforces_lesson_completion(self.course.name))
		self.assertEqual(get_locked_lessons(self.course.name), set())

	def test_flag_on_locks_everything_past_the_first_lesson(self):
		self._enable()
		self.assertTrue(enforces_lesson_completion(self.course.name))
		self.assertEqual(
			get_locked_lessons(self.course.name),
			{self.lessons[1].name, self.lessons[2].name},
		)

	def test_completing_the_first_lesson_unlocks_the_second(self):
		self._enable()
		frappe.set_user("Administrator")
		progress = self._create_progress(self.student.email, self.course.name, self.lessons[0].name)
		frappe.db.set_value("LMS Course Progress", progress.name, "status", "Complete")
		frappe.set_user(self.student.email)
		self.assertEqual(get_locked_lessons(self.course.name), {self.lessons[2].name})

	def test_partially_complete_does_not_unlock(self):
		self._enable()
		frappe.set_user("Administrator")
		progress = self._create_progress(self.student.email, self.course.name, self.lessons[0].name)
		frappe.db.set_value("LMS Course Progress", progress.name, "status", "Partially Complete")
		frappe.set_user(self.student.email)
		self.assertEqual(
			get_locked_lessons(self.course.name),
			{self.lessons[1].name, self.lessons[2].name},
		)

	def test_course_author_is_exempt(self):
		self._enable()
		frappe.set_user(self.author.email)
		self.assertFalse(enforces_lesson_completion(self.course.name))
		self.assertEqual(get_locked_lessons(self.course.name), set())

	def test_unenrolled_user_is_not_gated_by_sequencing(self):
		self._enable()
		frappe.set_user("Guest")
		self.assertFalse(enforces_lesson_completion(self.course.name))

	def test_malformed_course_argument_locks_nothing(self):
		self.assertEqual(get_locked_lessons(None), set())
		self.assertEqual(get_locked_lessons(["!=", ""]), set())

	def test_outline_stamps_locked_when_the_gate_applies(self):
		self._enable()
		from lms.lms.utils import get_course_outline

		outline = get_course_outline(self.course.name, progress=True)
		lessons = [lesson for chapter in outline for lesson in chapter.lessons]
		self.assertEqual([lesson.locked for lesson in lessons], [0, 1, 1])

	def test_outline_without_progress_does_not_stamp_locked(self):
		self._enable()
		from lms.lms.utils import get_course_outline

		outline = get_course_outline(self.course.name, progress=False)
		lessons = [lesson for chapter in outline for lesson in chapter.lessons]
		self.assertFalse(any("locked" in lesson for lesson in lessons))

	def test_get_lesson_refuses_a_locked_lesson(self):
		self._enable()
		from lms.lms.utils import get_lesson

		payload = get_lesson(self.course.name, 1, 2)
		self.assertEqual(payload.get("locked"), 1)
		self.assertEqual(payload.get("redirect_to"), "1-1")
		self.assertNotIn("content", payload)
		self.assertNotIn("body", payload)

	def test_get_lesson_sends_a_nonexistent_lesson_number_back_to_the_current_one(self):
		"""Typing a lesson number that does not exist is the same URL tampering the gate
		catches, so a gated course lands the student on their current lesson rather than
		bouncing them to the course page."""
		self._enable()
		from lms.lms.utils import get_lesson

		# Chapter 1 has three lessons and there is no chapter 9.
		for chapter, lesson in ((1, 99), (9, 1)):
			with self.subTest(chapter=chapter, lesson=lesson):
				payload = get_lesson(self.course.name, chapter, lesson)
				self.assertEqual(payload.get("locked"), 1)
				self.assertEqual(payload.get("not_found"), 1)
				self.assertEqual(payload.get("redirect_to"), "1-1")

	def test_a_lesson_that_exists_but_is_locked_is_not_flagged_not_found(self):
		# Both payloads redirect, so the page tells them apart on this flag alone:
		# "finish the earlier lessons to unlock this one" is false of a lesson that
		# does not exist.
		self._enable()
		from lms.lms.utils import get_lesson

		payload = get_lesson(self.course.name, 1, 2)
		self.assertEqual(payload.get("locked"), 1)
		self.assertIsNone(payload.get("not_found"))

	def test_a_nonexistent_lesson_number_is_still_empty_without_the_gate(self):
		from lms.lms.utils import get_lesson

		self.assertEqual(get_lesson(self.course.name, 9, 1), {})

	def test_get_lesson_serves_the_current_lesson(self):
		self._enable()
		from lms.lms.utils import get_lesson

		payload = get_lesson(self.course.name, 1, 1)
		self.assertFalse(payload.get("locked"))
		self.assertEqual(payload.get("title"), "Locking Lesson 1")

	def test_redirect_target_follows_the_enrollment_pointer(self):
		self._enable()
		frappe.set_user("Administrator")
		progress = self._create_progress(self.student.email, self.course.name, self.lessons[0].name)
		frappe.db.set_value("LMS Course Progress", progress.name, "status", "Complete")
		enrollment = frappe.db.get_value(
			"LMS Enrollment", {"course": self.course.name, "member": self.student.email}
		)
		frappe.db.set_value("LMS Enrollment", enrollment, "current_lesson", self.lessons[1].name)
		frappe.set_user(self.student.email)

		from lms.lms.utils import get_lesson

		payload = get_lesson(self.course.name, 1, 3)
		self.assertEqual(payload.get("locked"), 1)
		self.assertEqual(payload.get("redirect_to"), "1-2")

	def test_get_lesson_refuses_a_locked_scorm_lesson(self):
		self._enable()
		self._add_scorm_chapter()

		from lms.lms.utils import get_lesson

		payload = get_lesson(self.course.name, 2, 1)
		self.assertEqual(payload.get("locked"), 1)
		self.assertNotIn("is_scorm_package", payload)

	def test_course_author_still_gets_a_locked_lesson(self):
		self._enable()
		frappe.set_user(self.author.email)
		from lms.lms.utils import get_lesson

		payload = get_lesson(self.course.name, 1, 3)
		self.assertFalse(payload.get("locked"))
		self.assertEqual(payload.get("title"), "Locking Lesson 3")

	def test_redirect_target_is_never_locked_when_the_pointer_is_stale(self):
		# The pointer can name a locked lesson: save_progress wrote it while the setting
		# was off, or the chapters were reordered afterwards. Redirecting there is a dead
		# end — the router replaces the route it is already on and nothing happens.
		self._enable()
		self._complete(self.lessons[0].name)
		self._set_pointer(self.lessons[2].name)

		from lms.lms.utils import get_lesson

		locked = get_locked_lessons(self.course.name)
		self.assertIn(self.lessons[2].name, locked)

		payload = get_lesson(self.course.name, 1, 3)
		self.assertEqual(payload.get("locked"), 1)
		self.assertEqual(payload.get("redirect_to"), "1-2")

		from lms.lms.utils import get_lesson_index

		self.assertNotIn(payload["redirect_to"], {get_lesson_index(name) for name in locked})

	def test_continue_learning_never_points_at_a_locked_lesson(self):
		self._enable()
		self._complete(self.lessons[0].name)
		self._set_pointer(self.lessons[2].name)

		from lms.lms.utils import get_course_details

		self.assertEqual(get_course_details(self.course.name).current_lesson, "1-2")

	def test_continue_learning_keeps_the_pointer_when_it_is_open(self):
		self._enable()
		self._complete(self.lessons[0].name)
		self._set_pointer(self.lessons[1].name)

		from lms.lms.utils import get_course_details

		self.assertEqual(get_course_details(self.course.name).current_lesson, "1-2")

	def test_ordered_lesson_rows_carry_no_lesson_bodies(self):
		# The lock rule needs names and order only; body/content would put the whole
		# course text on the wire for every gated lesson view.
		from lms.lms.utils import get_ordered_lesson_rows

		rows = get_ordered_lesson_rows(self.course.name)
		self.assertEqual([row.name for row in rows], [lesson.name for lesson in self.lessons])
		for row in rows:
			self.assertNotIn("body", row)
			self.assertNotIn("content", row)

	def test_save_progress_refuses_a_locked_lesson(self):
		self._enable()
		from lms.lms.doctype.course_lesson.course_lesson import save_progress

		with self.assertRaises(frappe.PermissionError):
			save_progress(self.lessons[2].name, self.course.name)
		self.assertFalse(
			frappe.db.exists(
				"LMS Course Progress", {"lesson": self.lessons[2].name, "member": self.student.email}
			)
		)

	def test_save_progress_cannot_unlock_the_whole_course(self):
		# The bypass: call save_progress once per lesson name the outline publishes and
		# every lesson gets a Complete row, emptying the lock set.
		self._enable()
		from lms.lms.doctype.course_lesson.course_lesson import save_progress

		for lesson in self.lessons[1:]:
			with self.assertRaises(frappe.PermissionError):
				save_progress(lesson.name, self.course.name)

		self.assertEqual(
			get_locked_lessons(self.course.name),
			{self.lessons[1].name, self.lessons[2].name},
		)

	def test_save_progress_still_completes_the_lesson_the_student_is_on(self):
		self._enable()
		from lms.lms.doctype.course_lesson.course_lesson import save_progress

		save_progress(self.lessons[0].name, self.course.name)
		self.assertTrue(
			frappe.db.exists(
				"LMS Course Progress",
				{"lesson": self.lessons[0].name, "member": self.student.email, "status": "Complete"},
			)
		)
		self.assertEqual(get_locked_lessons(self.course.name), {self.lessons[2].name})

	def test_scorm_renderer_refuses_bytes_for_a_locked_chapter(self):
		# SCORMChapter.vue never calls get_lesson, so this is the authoritative gate for
		# a student who opens /learn/<scorm-chapter> directly.
		self._enable()
		chapter, _lesson = self._add_scorm_chapter()

		from lms.page_renderers import SCORMRenderer

		renderer = SCORMRenderer(path=f"scorm/{self.course.name}/{chapter.title}/index.html")
		with self.assertRaises(frappe.PermissionError):
			renderer._check_permission()

	def test_scorm_renderer_serves_bytes_once_the_chapter_is_unlocked(self):
		self._enable()
		chapter, _lesson = self._add_scorm_chapter()
		for lesson in self.lessons:
			self._complete(lesson.name)

		from lms.page_renderers import SCORMRenderer

		renderer = SCORMRenderer(path=f"scorm/{self.course.name}/{chapter.title}/index.html")
		self.assertIsNone(renderer._check_permission())

	def test_outline_withholds_the_launch_file_of_a_locked_scorm_chapter(self):
		self._enable()
		chapter, _lesson = self._add_scorm_chapter()

		from lms.lms.utils import get_course_outline

		outline = get_course_outline(self.course.name, progress=True)
		scorm = next(c for c in outline if c.name == chapter.name)
		self.assertIsNone(scorm.launch_file)
		self.assertIsNone(scorm.scorm_package)

	def test_outline_serves_the_launch_file_once_the_chapter_is_unlocked(self):
		self._enable()
		chapter, _lesson = self._add_scorm_chapter()
		for lesson in self.lessons:
			self._complete(lesson.name)

		from lms.lms.utils import get_course_outline

		outline = get_course_outline(self.course.name, progress=True)
		scorm = next(c for c in outline if c.name == chapter.name)
		self.assertEqual(scorm.launch_file, "index.html")

	def test_locked_lesson_quiz_is_not_readable(self):
		self._enable()
		quiz = self._create_lesson_quiz(self.lessons[2].name)

		from lms.lms.permissions import can_access_quiz

		self.assertFalse(can_access_quiz(quiz.name))

	def test_the_current_lessons_quiz_stays_readable(self):
		self._enable()
		quiz = self._create_lesson_quiz(self.lessons[0].name)

		from lms.lms.permissions import can_access_quiz

		self.assertTrue(can_access_quiz(quiz.name))

	def test_a_quiz_orphaned_from_its_lesson_is_refused_under_the_gate(self):
		# cleanup_lesson_backreferences clears LMS Quiz.lesson on the lesson's deletion
		# and leaves LMS Quiz.course standing, so the placement carries no lesson to
		# check. `None not in locked` holds for every course, which granted any enrolled
		# member the questions of a quiz still embedded in a locked lesson.
		self._enable()
		quiz = self._create_lesson_quiz(self.lessons[2].name)
		frappe.db.set_value("LMS Quiz", quiz.name, "lesson", None)

		from lms.lms.permissions import can_access_quiz

		self.assertFalse(can_access_quiz(quiz.name))

	def test_a_quiz_orphaned_from_its_lesson_stays_readable_without_the_gate(self):
		# The refusal above is the gate talking, not a blanket rule: an ungated course
		# still hands its enrolled members a quiz whose lesson link was cleared.
		quiz = self._create_lesson_quiz(self.lessons[2].name)
		frappe.db.set_value("LMS Quiz", quiz.name, "lesson", None)

		from lms.lms.permissions import can_access_quiz

		self.assertTrue(can_access_quiz(quiz.name))

	def test_an_orphaned_quiz_reopens_once_the_course_is_finished(self):
		# Gate on, nothing left locked: there is no lesson the quiz could be gated by.
		self._enable()
		quiz = self._create_lesson_quiz(self.lessons[2].name)
		frappe.db.set_value("LMS Quiz", quiz.name, "lesson", None)
		for lesson in self.lessons:
			self._complete(lesson.name)

		from lms.lms.permissions import can_access_quiz

		self.assertEqual(get_locked_lessons(self.course.name), set())
		self.assertTrue(can_access_quiz(quiz.name))

	def test_two_placements_in_one_course_compute_the_lock_state_once(self):
		# A quiz reachable from more than one lesson of the same course walked the whole
		# lock chain per placement: get_membership plus the ordered rows and the progress
		# read, repeated for a set that cannot differ between them.
		self._enable()
		quiz = self._create_lesson_quiz(self.lessons[2].name)
		frappe.db.set_value("Course Lesson", self.lessons[1].name, "quiz_id", quiz.name)

		from lms.lms import permissions
		from lms.lms.permissions import can_access_quiz

		with patch.object(permissions, "_lock_state", wraps=permissions._lock_state) as lock_state:
			self.assertFalse(can_access_quiz(quiz.name))

		self.assertEqual(lock_state.call_count, 1)

	def test_outline_does_not_publish_the_quiz_of_a_locked_lesson(self):
		self._enable()
		quiz = self._create_lesson_quiz(self.lessons[2].name)
		frappe.db.set_value("Course Lesson", self.lessons[2].name, "quiz_id", quiz.name)

		from lms.lms.utils import get_course_outline

		outline = get_course_outline(self.course.name, progress=True)
		lessons = [lesson for chapter in outline for lesson in chapter.lessons]
		self.assertIsNone(lessons[2].quiz_id)

	def test_progress_is_published_to_the_completing_member_alone(self):
		# The outline reload for a quiz or assignment completion rides on this event,
		# so it has to reach the student who completed the lesson - and only them.
		self._enable()
		from lms.lms.doctype.course_lesson.course_lesson import save_progress

		with patch("frappe.publish_realtime") as publish:
			save_progress(self.lessons[0].name, self.course.name)

		published = [
			call for call in publish.call_args_list if call.kwargs.get("event") == "update_lesson_progress"
		]
		self.assertEqual(len(published), 1)
		self.assertEqual(published[0].kwargs.get("user"), self.student.email)
		self.assertIsNone(published[0].kwargs.get("room"))
		self.assertEqual(published[0].kwargs["message"]["lesson"], self.lessons[0].name)

	def test_a_quiz_on_a_locked_lesson_keeps_its_submission(self):
		# can_access_quiz grants through an LMS Assessment on a batch, so a quiz can be
		# submitted while its lesson is locked. save_progress refuses a locked lesson by
		# raising, which would roll back the submission already written in the same
		# request.
		self._enable()
		quiz = self._create_lesson_quiz(self.lessons[2].name)

		frappe.set_user("Administrator")
		# submit_quiz reads the row, not the doc. A questionless quiz has its passing
		# percentage forced to 100 by calculate_total_marks; drop it to 0 so the
		# submission counts as a pass and the flow actually reaches the progress
		# write, which is where the rollback happened.
		frappe.db.set_value("LMS Quiz", quiz.name, "passing_percentage", 0)
		# _create_batch links its courses row to a Course Evaluator, and that in turn
		# links a User. Both helpers default to frappe@example.com, which nothing in
		# this suite seeds — a site carrying either from an earlier run hides that,
		# CI's fresh one does not. Build both off this suite's own author instead, so
		# the test depends on nothing outside its own setUp.
		self._create_evaluator(self.author.email)
		batch = self._create_batch(
			self.course.name,
			instructor=self.author.email,
			title="Locking Batch",
			evaluator=self.author.email,
		)
		batch_doc = frappe.get_doc("LMS Batch", batch.name)
		batch_doc.append("assessment", {"assessment_type": "LMS Quiz", "assessment_name": quiz.name})
		batch_doc.save()
		self._create_batch_enrollment(self.student.email, batch.name)
		frappe.set_user(self.student.email)

		from lms.lms.doctype.lms_quiz.lms_quiz import submit_quiz

		self.assertIn(self.lessons[2].name, get_locked_lessons(self.course.name))
		# A JSON string, not a list: submit_quiz is whitelisted and `results` is typed
		# `str | None`, so frappe coerces the argument through pydantic exactly as it
		# would over HTTP. Every other caller in the suite passes json.dumps(...).
		result = submit_quiz(quiz.name, json.dumps([]))

		self.assertTrue(frappe.db.exists("LMS Quiz Submission", result["submission"]))
		# The lesson stays locked: skipping the write must not become a way past the gate.
		self.assertIn(self.lessons[2].name, get_locked_lessons(self.course.name))
		self.assertFalse(
			frappe.db.exists(
				"LMS Course Progress", {"lesson": self.lessons[2].name, "member": self.student.email}
			)
		)

	def test_the_lock_check_does_not_read_the_enrollment_pointer(self):
		# SCORMRenderer runs this on every asset request of a package.
		self._enable()
		with patch("frappe.db.get_value", wraps=frappe.db.get_value) as get_value:
			get_locked_lessons(self.course.name)

		pointer_reads = [
			call
			for call in get_value.call_args_list
			if call.args and call.args[0] == "LMS Enrollment" and "current_lesson" in call.args
		]
		self.assertEqual(pointer_reads, [])


class TestLessonLockingImportExport(FrappeTestCase):
	def test_export_carries_the_setting(self):
		from lms.lms.course_import_export import get_course_fields

		self.assertIn("enforce_lesson_completion", get_course_fields())
