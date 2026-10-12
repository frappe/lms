# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

import json

import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.patches.v2_0.backfill_lesson_assessment_placements import (
	_lessons_needing_placements,
	execute,
)


def _editorjs(*blocks):
	return json.dumps({"time": 1765194986690, "blocks": list(blocks), "version": "2.29.0"})


def _quiz_block(quiz):
	return {"id": "q1", "type": "quiz", "data": {"quiz": quiz}}


class TestBackfillLessonAssessmentPlacements(BaseTestUtils):
	"""A lesson authored before the placement table existed carries no rows."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.hash = frappe.generate_hash(length=6)
		self.author = self._create_user(
			f"backfill-author-{self.hash}@example.com", "Backfill", "Author", ["Course Creator"]
		)
		self.course = self._create_course(f"Backfill course {self.hash}", self.author.email)
		self.chapter = self._create_chapter(f"Backfill chapter {self.hash}", self.course.name)
		self.questions = self._create_quiz_questions()
		self.quiz = self._create_quiz(self.questions, title=f"Backfill quiz {self.hash}")

	def _unplaced_lesson(self, title, content=None, instructor_content=None):
		"""A lesson as it looked before the table shipped: saved, then its rows removed."""
		lesson = self._create_lesson(f"{title} {self.hash}", self.chapter.name, self.course.name, content)
		if instructor_content is not None:
			lesson.instructor_content = instructor_content
			lesson.save()
		self._strip_placements(lesson.name)
		return lesson.name

	def _strip_placements(self, lesson):
		frappe.db.delete("LMS Lesson Assessment", {"parent": lesson, "parenttype": "Course Lesson"})

	def _placements(self, lesson):
		return [
			(row.assessment_type, row.assessment_name, row.instructor_only)
			for row in frappe.get_doc("Course Lesson", lesson).assessments
		]

	def _row_names(self, lesson):
		return frappe.get_all(
			"LMS Lesson Assessment",
			filters={"parent": lesson, "parenttype": "Course Lesson"},
			order_by="idx asc",
			pluck="name",
		)

	def test_an_unplaced_lesson_gets_its_rows(self):
		lesson = self._unplaced_lesson("Backfill lesson one", content=_editorjs(_quiz_block(self.quiz.name)))
		self.assertEqual(self._placements(lesson), [])
		execute()
		self.assertEqual(self._placements(lesson), [("LMS Quiz", self.quiz.name, 0)])

	def test_instructor_only_survives_the_backfill(self):
		lesson = self._unplaced_lesson(
			"Backfill lesson instructor", instructor_content=_editorjs(_quiz_block(self.quiz.name))
		)
		execute()
		self.assertEqual(self._placements(lesson), [("LMS Quiz", self.quiz.name, 1)])

	def test_running_it_twice_produces_the_same_rows(self):
		"""Idempotence: the second run neither duplicates a row nor rewrites one."""
		lesson = self._unplaced_lesson(
			"Backfill lesson twice", content=_editorjs(_quiz_block(self.quiz.name))
		)
		execute()
		first = self._placements(lesson)
		first_names = self._row_names(lesson)

		execute()

		self.assertEqual(self._placements(lesson), first)
		self.assertEqual(len(self._placements(lesson)), 1)
		self.assertEqual(self._row_names(lesson), first_names)

	def test_the_second_run_finds_nothing_to_do(self):
		"""The stronger half of idempotence: not "same result", but "no work at all"."""
		self._unplaced_lesson("Backfill lesson noop", content=_editorjs(_quiz_block(self.quiz.name)))
		execute()
		self.assertEqual(_lessons_needing_placements(), [])

	def test_a_lesson_the_save_already_placed_is_not_rewritten(self):
		"""The writer and the backfill are one reading, so a saved lesson is never pending."""
		lesson = self._create_lesson(
			f"Backfill lesson saved {self.hash}",
			self.chapter.name,
			self.course.name,
			_editorjs(_quiz_block(self.quiz.name)),
		)
		self.assertNotIn(lesson.name, [name for name, _ in _lessons_needing_placements()])

	def test_a_stale_row_is_corrected_not_kept(self):
		"""A placement whose embed is gone is removed, not left behind as a grant."""
		other = self._create_quiz(self.questions, title=f"Backfill quiz other {self.hash}")
		lesson = self._unplaced_lesson(
			"Backfill lesson stale", content=_editorjs(_quiz_block(self.quiz.name))
		)
		# nosemgrep: lms-unjustified-ignore-permissions - test fixture, seeding the stale row the case reads back
		frappe.get_doc(
			{
				"doctype": "LMS Lesson Assessment",
				"parent": lesson,
				"parenttype": "Course Lesson",
				"parentfield": "assessments",
				"idx": 1,
				"assessment_type": "LMS Quiz",
				"assessment_name": other.name,
				"instructor_only": 0,
			}
		).insert(ignore_permissions=True)

		execute()

		self.assertEqual(self._placements(lesson), [("LMS Quiz", self.quiz.name, 0)])

	def test_a_lesson_with_no_embed_gets_no_rows(self):
		lesson = self._unplaced_lesson("Backfill lesson empty")
		execute()
		self.assertEqual(self._placements(lesson), [])

	def test_a_reference_to_a_missing_assessment_is_skipped(self):
		"""A deleted assessment gates nothing, and its Dynamic Link row would not save."""
		lesson = self._unplaced_lesson(
			"Backfill lesson dangling",
			content=_editorjs({"type": "assignment", "data": {"assignment": f"missing-{self.hash}"}}),
		)
		execute()
		self.assertEqual(self._placements(lesson), [])

	def test_it_is_safe_on_a_site_with_nothing_to_do(self):
		execute()
		execute()
		self.assertEqual(_lessons_needing_placements(), [])
