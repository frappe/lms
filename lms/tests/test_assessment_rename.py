# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

import json

import frappe

from lms.lms.test_helpers import BaseTestUtils


def _editorjs(*blocks):
	return json.dumps({"time": 1765194986690, "blocks": list(blocks), "version": "2.29.0"})


def _markdown(text):
	return {"id": "md", "type": "markdown", "data": {"text": text}}


class TestAssessmentRename(BaseTestUtils):
	"""Renaming an assessment carries every lesson that places it to the new name."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.hash = frappe.generate_hash(length=6)
		self.author = self._create_user(
			f"rename-author-{self.hash}@example.com", "Rename", "Author", ["Course Creator"]
		)
		self.course = self._create_course(f"Rename course {self.hash}", self.author.email)
		self.chapter = self._create_chapter(f"Rename chapter {self.hash}", self.course.name)
		self.questions = self._create_quiz_questions()

	def _lesson(self, title, content=None):
		return self._create_lesson(f"{title} {self.hash}", self.chapter.name, self.course.name, content)

	def _stored(self, lesson, field="content"):
		return frappe.db.get_value("Course Lesson", lesson.name, field)

	def _placements(self, lesson):
		rows = frappe.get_all(
			"LMS Lesson Assessment",
			filters={"parent": lesson.name, "parenttype": "Course Lesson"},
			fields=["assessment_type", "assessment_name"],
			order_by="idx asc",
		)
		return [(row.assessment_type, row.assessment_name) for row in rows]

	def _resave(self, lesson):
		"""A real save: the path that refused a stale quiz and dropped stale placements."""
		doc = frappe.get_doc("Course Lesson", lesson.name)
		doc.save()
		return doc

	def test_renaming_a_quiz_rewrites_its_lessons_and_batches(self):
		"""Regression from #2826: lesson content kept the old name, so the next lesson save
		refused it or dropped its placement. Added for audit finding #58."""
		quiz = self._create_quiz(self.questions, title=f"Rename quiz {self.hash}")
		# Its name is a prefix of this one's, so only an exact match may move.
		lookalike = self._create_quiz(self.questions, title=f"Rename quiz {self.hash} extra")
		self.assertIn(quiz.name, lookalike.name)
		old, new = quiz.name, f"renamed-quiz-{self.hash}"

		prose = f"Revise {old} and {lookalike.name} before you start."
		in_content = self._lesson(
			"Rename content lesson",
			_editorjs(
				_markdown(prose),
				{"id": "q", "type": "quiz", "data": {"quiz": old}},
				{"id": "l", "type": "quiz", "data": {"quiz": lookalike.name}},
			),
		)
		in_content.instructor_content = _editorjs(
			{"id": "v", "type": "upload", "data": {"file": "/a.mp4", "quizzes": [{"quiz": old, "time": 4}]}}
		)
		in_content.save()
		before = json.loads(self._stored(in_content))

		legacy = self._lesson("Rename legacy lesson")
		frappe.db.set_value(
			"Course Lesson",
			legacy.name,
			{"content": None, "body": f'Intro {old}\n\n{{{{ Quiz("{old}") }}}}', "quiz_id": old},
		)
		legacy = self._resave(legacy)
		self.assertEqual(self._placements(legacy), [("LMS Quiz", old)])

		evaluator = self._create_evaluator(self.author.email)
		batch = self._create_batch(
			self.course.name,
			instructor=self.author.email,
			title=f"Rename batch {self.hash}",
			evaluator=evaluator.name,
		)
		batch.append("assessment", {"assessment_type": "LMS Quiz", "assessment_name": old})
		batch.save()

		frappe.rename_doc("LMS Quiz", old, new)

		after = json.loads(self._stored(in_content))
		self.assertEqual(after["blocks"][0]["data"]["text"], prose)
		self.assertEqual(after["blocks"][1]["data"]["quiz"], new)
		self.assertEqual(after["blocks"][2]["data"]["quiz"], lookalike.name)
		before["blocks"][1]["data"]["quiz"] = new
		self.assertEqual(self._stored(in_content), json.dumps(before, separators=(",", ":")))
		instructor = json.loads(self._stored(in_content, "instructor_content"))
		self.assertEqual(instructor["blocks"][0]["data"]["quizzes"], [{"quiz": new, "time": 4}])

		self.assertEqual(self._stored(legacy, "quiz_id"), new)
		self.assertEqual(self._stored(legacy, "body"), f'Intro {old}\n\n{{{{ Quiz("{new}") }}}}')

		self.assertEqual(
			frappe.get_all(
				"LMS Assessment", filters={"parent": batch.name}, pluck="assessment_name", order_by="idx"
			),
			[new],
		)

		self.assertEqual(
			self._placements(self._resave(in_content)), [("LMS Quiz", new), ("LMS Quiz", lookalike.name)]
		)
		self.assertEqual(self._placements(self._resave(legacy)), [("LMS Quiz", new)])

	def test_renaming_an_assignment_keeps_its_placement(self):
		"""Regression from #2826, as above, for assignments.
		Added for audit finding #58."""
		assignment = self._create_assignment(title=f"Rename assignment {self.hash}")
		old, new = assignment.name, f"renamed-assignment-{self.hash}"
		lesson = self._lesson(
			"Rename assignment lesson",
			_editorjs(_markdown(f"Submit {old}-draft"), {"type": "assignment", "data": {"assignment": old}}),
		)
		legacy = self._lesson("Rename legacy assignment lesson")
		frappe.db.set_value(
			"Course Lesson", legacy.name, {"content": None, "body": f"{{{{ Assignment('{old}') }}}}"}
		)

		frappe.rename_doc("LMS Assignment", old, new)

		blocks = json.loads(self._stored(lesson))["blocks"]
		self.assertEqual(blocks[0]["data"]["text"], f"Submit {old}-draft")
		self.assertEqual(blocks[1]["data"]["assignment"], new)
		self.assertEqual(self._stored(legacy, "body"), f"{{{{ Assignment('{new}') }}}}")
		self.assertEqual(self._placements(self._resave(lesson)), [("LMS Assignment", new)])
		self.assertEqual(self._placements(self._resave(legacy)), [("LMS Assignment", new)])

	def test_renaming_a_programming_exercise_keeps_its_placement(self):
		"""Regression from #2826, as above, for programming exercises.
		Added for audit finding #58."""
		exercise = self._create_programming_exercise(title=f"Rename exercise {self.hash}")
		old, new = exercise.name, f"renamed-exercise-{self.hash}"
		lesson = self._lesson(
			"Rename exercise lesson", _editorjs({"type": "program", "data": {"exercise": old}})
		)

		frappe.rename_doc("LMS Programming Exercise", old, new)

		self.assertEqual(json.loads(self._stored(lesson))["blocks"][0]["data"]["exercise"], new)
		self.assertEqual(self._placements(self._resave(lesson)), [("LMS Programming Exercise", new)])

	def test_content_written_by_the_editor_keeps_its_own_encoding(self):
		"""JSON.stringify leaves non-ASCII unescaped; the rewrite must not escape the rest.
		Edge case of the audit finding #58 fix."""
		quiz = self._create_quiz(self.questions, title=f"Rename encoded quiz {self.hash}")
		old, new = quiz.name, f"renamed-encoded-{self.hash}"
		blob = {"blocks": [_markdown("Café — 測驗"), {"type": "quiz", "data": {"quiz": old}}]}
		lesson = self._lesson("Rename encoded lesson")
		stringify = {"separators": (",", ":"), "ensure_ascii": False}
		frappe.db.set_value("Course Lesson", lesson.name, "content", json.dumps(blob, **stringify))

		frappe.rename_doc("LMS Quiz", old, new)

		blob["blocks"][1]["data"]["quiz"] = new
		self.assertEqual(self._stored(lesson), json.dumps(blob, **stringify))

	def test_a_block_of_another_type_naming_the_old_value_is_untouched(self):
		"""An assignment block holding a quiz's name is not a reference to the quiz.
		Edge case of the audit finding #58 fix."""
		quiz = self._create_quiz(self.questions, title=f"Rename typed quiz {self.hash}")
		old = quiz.name
		content = _editorjs({"type": "program", "data": {"exercise": old}})
		lesson = self._lesson("Rename typed lesson", content)
		stored = self._stored(lesson)

		frappe.rename_doc("LMS Quiz", old, f"renamed-typed-{self.hash}")

		self.assertEqual(self._stored(lesson), stored)

	def test_content_that_is_not_editorjs_is_left_alone(self):
		"""Edge case of the audit finding #58 fix."""
		quiz = self._create_quiz(self.questions, title=f"Rename plain quiz {self.hash}")
		lesson = self._lesson("Rename plain lesson")
		frappe.db.set_value("Course Lesson", lesson.name, "content", f"see {quiz.name}")

		frappe.rename_doc("LMS Quiz", quiz.name, f"renamed-plain-{self.hash}")

		self.assertEqual(self._stored(lesson), f"see {quiz.name}")

	def test_merging_one_quiz_into_another_is_refused(self):
		"""A merge would file one quiz's submissions under another quiz's questions.
		Edge case of the audit finding #58 fix."""
		quiz = self._create_quiz(self.questions, title=f"Rename merge quiz {self.hash}")
		target = self._create_quiz(self.questions, title=f"Rename merge target {self.hash}")
		with self.assertRaises(frappe.ValidationError):
			frappe.rename_doc("LMS Quiz", quiz.name, target.name, merge=True)
		self.assertTrue(frappe.db.exists("LMS Quiz", quiz.name))
