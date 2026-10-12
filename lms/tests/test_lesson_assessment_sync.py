# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

import json

import frappe

from lms.lms.lesson_assessments import extract_lesson_assessments
from lms.lms.test_helpers import BaseTestUtils


def _editorjs(*blocks):
	return json.dumps({"time": 1765194986690, "blocks": list(blocks), "version": "2.29.0"})


def _quiz_block(quiz):
	return {"id": "q1", "type": "quiz", "data": {"quiz": quiz}}


class TestExtractLessonAssessments(BaseTestUtils):
	"""The places an assessment can hide in one lesson, read by one function."""

	def test_reads_a_quiz_block(self):
		content = _editorjs(_quiz_block("QZ-1"))
		self.assertEqual(
			extract_lesson_assessments(None, content),
			[{"assessment_type": "LMS Quiz", "assessment_name": "QZ-1"}],
		)

	def test_reads_an_assignment_block(self):
		content = _editorjs({"type": "assignment", "data": {"assignment": "AS-1"}})
		self.assertEqual(
			extract_lesson_assessments(None, content),
			[{"assessment_type": "LMS Assignment", "assessment_name": "AS-1"}],
		)

	def test_reads_a_programming_exercise_block(self):
		"""The block type is "program" and the key is "exercise" -- they do not match."""
		content = _editorjs({"type": "program", "data": {"exercise": "PE-1"}})
		self.assertEqual(
			extract_lesson_assessments(None, content),
			[{"assessment_type": "LMS Programming Exercise", "assessment_name": "PE-1"}],
		)

	def test_reads_quizzes_nested_in_an_upload_block(self):
		"""In-video quizzes: get_quiz_progress reads these, and nothing ever placed them."""
		content = _editorjs({"type": "upload", "data": {"quizzes": [{"quiz": "QZ-2"}, {"quiz": "QZ-3"}]}})
		self.assertEqual(
			[row["assessment_name"] for row in extract_lesson_assessments(None, content)],
			["QZ-2", "QZ-3"],
		)

	def test_reads_legacy_body_macros_when_there_is_no_content(self):
		self.assertEqual(
			extract_lesson_assessments("{{ Quiz('QZ-4') }}", None),
			[{"assessment_type": "LMS Quiz", "assessment_name": "QZ-4"}],
		)

	def test_reads_a_legacy_assignment_macro(self):
		self.assertEqual(
			extract_lesson_assessments("{{ Assignment('AS-2') }}", None),
			[{"assessment_type": "LMS Assignment", "assessment_name": "AS-2"}],
		)

	def test_content_wins_over_body(self):
		content = _editorjs(_quiz_block("QZ-5"))
		self.assertEqual(
			[row["assessment_name"] for row in extract_lesson_assessments("{{ Quiz('QZ-4') }}", content)],
			["QZ-5"],
		)

	def test_document_order_is_preserved(self):
		content = _editorjs(
			_quiz_block("QZ-6"),
			{"type": "assignment", "data": {"assignment": "AS-3"}},
			{"type": "upload", "data": {"quizzes": [{"quiz": "QZ-7"}]}},
		)
		self.assertEqual(
			[row["assessment_name"] for row in extract_lesson_assessments(None, content)],
			["QZ-6", "AS-3", "QZ-7"],
		)

	def test_non_json_content_yields_nothing_rather_than_raising(self):
		self.assertEqual(extract_lesson_assessments(None, "a pasted URL"), [])

	def test_nothing_at_all_yields_nothing(self):
		self.assertEqual(extract_lesson_assessments(None, None), [])

	def test_a_block_naming_no_assessment_is_skipped(self):
		"""A half-authored quiz block holds an empty id, and an empty id is not a placement."""
		self.assertEqual(extract_lesson_assessments(None, _editorjs(_quiz_block(""))), [])

	def test_an_upload_block_with_no_quizzes_is_skipped(self):
		content = _editorjs({"type": "upload", "data": {"file": {"url": "/a.mp4"}}})
		self.assertEqual(extract_lesson_assessments(None, content), [])


class TestSyncLessonAssessments(BaseTestUtils):
	"""Saving a lesson rebuilds its LMS Lesson Assessment placement rows."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.hash = frappe.generate_hash(length=6)
		self.author = self._create_user(
			f"sync-author-{self.hash}@example.com", "Sync", "Author", ["Course Creator"]
		)
		self.course = self._create_course(f"Sync course {self.hash}", self.author.email)
		self.chapter = self._create_chapter(f"Sync chapter {self.hash}", self.course.name)
		self.questions = self._create_quiz_questions()
		self.quiz_a = self._create_quiz(self.questions, title=f"Sync quiz A {self.hash}")
		self.quiz_b = self._create_quiz(self.questions, title=f"Sync quiz B {self.hash}")

	def _lesson(self, title, content=None, instructor_content=None):
		"""A distinct title per call: _create_lesson is a get-or-create on (course, title)."""
		lesson = self._create_lesson(f"{title} {self.hash}", self.chapter.name, self.course.name, content)
		if instructor_content is not None:
			lesson.instructor_content = instructor_content
			lesson.save()
		return frappe.get_doc("Course Lesson", lesson.name)

	def _placements(self, lesson):
		return [(row.assessment_type, row.assessment_name, row.instructor_only) for row in lesson.assessments]

	def test_a_saved_lesson_gets_a_placement_row(self):
		lesson = self._lesson("Sync lesson one", content=_editorjs(_quiz_block(self.quiz_a.name)))
		self.assertEqual(self._placements(lesson), [("LMS Quiz", self.quiz_a.name, 0)])

	def test_an_in_video_quiz_is_placed_too(self):
		content = _editorjs({"type": "upload", "data": {"quizzes": [{"quiz": self.quiz_a.name}]}})
		lesson = self._lesson("Sync lesson video", content=content)
		self.assertEqual(self._placements(lesson), [("LMS Quiz", self.quiz_a.name, 0)])

	def test_an_assignment_is_placed(self):
		assignment = self._create_assignment(title=f"Sync assignment {self.hash}")
		content = _editorjs({"type": "assignment", "data": {"assignment": assignment.name}})
		lesson = self._lesson("Sync lesson assignment", content=content)
		self.assertEqual(self._placements(lesson), [("LMS Assignment", assignment.name, 0)])

	def test_a_programming_exercise_is_placed(self):
		exercise = self._create_programming_exercise(title=f"Sync exercise {self.hash}")
		content = _editorjs({"type": "program", "data": {"exercise": exercise.name}})
		lesson = self._lesson("Sync lesson exercise", content=content)
		self.assertEqual(self._placements(lesson), [("LMS Programming Exercise", exercise.name, 0)])

	def test_instructor_content_sets_instructor_only(self):
		lesson = self._lesson(
			"Sync lesson instructor", instructor_content=_editorjs(_quiz_block(self.quiz_a.name))
		)
		self.assertEqual(self._placements(lesson), [("LMS Quiz", self.quiz_a.name, 1)])

	def test_an_assessment_in_both_fields_yields_one_visible_row(self):
		"""The more permissive placement is the real one; the other hides a student's own quiz."""
		block = _editorjs(_quiz_block(self.quiz_a.name))
		lesson = self._lesson("Sync lesson both", content=block, instructor_content=block)
		self.assertEqual(self._placements(lesson), [("LMS Quiz", self.quiz_a.name, 0)])

	def test_resaving_replaces_rather_than_accumulates(self):
		lesson = self._lesson("Sync lesson replace", content=_editorjs(_quiz_block(self.quiz_a.name)))
		lesson.content = _editorjs(_quiz_block(self.quiz_b.name))
		lesson.save()
		lesson.reload()
		self.assertEqual(self._placements(lesson), [("LMS Quiz", self.quiz_b.name, 0)])

	def test_removing_the_embed_removes_the_row(self):
		lesson = self._lesson("Sync lesson remove", content=_editorjs(_quiz_block(self.quiz_a.name)))
		lesson.content = _editorjs({"type": "markdown", "data": {"text": "no quiz here"}})
		lesson.save()
		lesson.reload()
		self.assertEqual(lesson.assessments, [])

	def test_a_quiz_in_two_lessons_of_two_courses_keeps_both_rows(self):
		"""One row per placement, not one stamp per quiz: the old link held a single value."""
		other_course = self._create_course(f"Sync course two {self.hash}", self.author.email)
		other_chapter = self._create_chapter(f"Sync chapter two {self.hash}", other_course.name)
		content = _editorjs(_quiz_block(self.quiz_a.name))
		first = self._lesson("Sync lesson first", content=content)
		second = self._create_lesson(
			f"Sync lesson second {self.hash}", other_chapter.name, other_course.name, content
		)
		first.reload()
		self.assertEqual(self._placements(first), [("LMS Quiz", self.quiz_a.name, 0)])
		self.assertEqual(
			self._placements(frappe.get_doc("Course Lesson", second.name)),
			[("LMS Quiz", self.quiz_a.name, 0)],
		)

	def test_a_lesson_with_no_assessments_gets_no_rows(self):
		lesson = self._lesson("Sync lesson empty")
		self.assertEqual(lesson.assessments, [])

	def test_a_reference_to_a_missing_assessment_is_dropped_not_placed(self):
		"""assessment_name is a Dynamic Link, so a row naming a deleted assessment
		cannot save at all -- dropping it here is required, not a preference."""
		content = _editorjs({"type": "assignment", "data": {"assignment": f"missing-{self.hash}"}})
		lesson = self._lesson("Sync lesson dangling", content=content)
		self.assertEqual(lesson.assessments, [])

	def test_a_hand_added_row_is_replaced_by_the_rows_computed_from_content(self):
		"""sync_lesson_assessments rebuilds `assessments` from content on every save --
		a hand-added row naming a real assessment does not survive it either."""
		assignment = self._create_assignment(title=f"Sync handmade assignment {self.hash}")
		lesson = self._lesson("Sync lesson handmade", content=_editorjs(_quiz_block(self.quiz_a.name)))
		lesson.append(
			"assessments",
			{
				"assessment_type": "LMS Assignment",
				"assessment_name": assignment.name,
				"instructor_only": 0,
			},
		)
		lesson.save()
		lesson.reload()
		self.assertEqual(self._placements(lesson), [("LMS Quiz", self.quiz_a.name, 0)])

	def test_the_legacy_quiz_placement_stamp_is_still_written(self):
		"""Nothing reads LMS Lesson Assessment yet, so LMS Quiz.course/.lesson stays the
		placement every current gate consults. Retiring it is a later change."""
		lesson = self._lesson("Sync lesson stamped", content=_editorjs(_quiz_block(self.quiz_a.name)))
		self.assertEqual(
			frappe.db.get_value("LMS Quiz", self.quiz_a.name, ["course", "lesson"], as_dict=True),
			{"course": self.course.name, "lesson": lesson.name},
		)

	def test_a_quiz_block_naming_a_missing_quiz_is_still_refused(self):
		"""Unchanged pre-existing behaviour: save_lesson_details_in_quiz owns this error."""
		content = _editorjs(_quiz_block(f"missing-quiz-{self.hash}"))
		with self.assertRaises(frappe.ValidationError):
			self._lesson("Sync lesson bad quiz", content=content)

	def test_the_suite_leaves_no_placement_rows_behind(self):
		"""Row-count proof for the shared site: every fixture above is per-test and rolled back."""
		self.assertEqual(
			frappe.db.count("LMS Lesson Assessment", {"assessment_name": ["like", f"%{self.hash}%"]}),
			0,
		)
