# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

import frappe
import frappe.client

from lms.lms.api import get_course_assessment_progress
from lms.lms.permissions import can_access_assessment
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_batch_student_progress

SUBMISSION_FIELDS = {
	"LMS Quiz": ("LMS Quiz Submission", "quiz"),
	"LMS Assignment": ("LMS Assignment Submission", "assignment"),
	"LMS Programming Exercise": ("LMS Programming Exercise Submission", "exercise"),
}


def lists_for(doctype: str, name: str, user: str) -> bool:
	original_user = frappe.session.user
	frappe.set_user(user)
	try:
		return name in frappe.get_list(doctype, pluck="name", limit_page_length=0)
	finally:
		frappe.set_user(original_user)


class TestAssessmentPlacementGrantsUseOnly(BaseTestUtils):
	"""Course Creator B, who already runs A's assessments in a batch with no students,
	embeds them in B's own lesson. B may use them; A stays their only author, and B
	reaches only B's students' work."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		suffix = frappe.generate_hash(length=6)
		self.author = self._create_user(f"apu-a-{suffix}@example.com", "Ann", "Author", ["Course Creator"])
		self.placer = self._create_user(f"apu-b-{suffix}@example.com", "Ben", "Placer", ["Course Creator"])
		self.moderator = self._create_user(f"apu-mod-{suffix}@example.com", "Mo", "Derator", ["Moderator"])
		self.student_a = self._create_user(f"apu-sa-{suffix}@example.com", "Sal", "A", ["LMS Student"])
		self.student_b = self._create_user(f"apu-sb-{suffix}@example.com", "Sid", "B", ["LMS Student"])

		self.course_a = self._create_course(f"Author Course {suffix}", instructor=self.author.name)
		self.course_b = self._create_course(f"Placer Course {suffix}", instructor=self.placer.name)
		self._create_enrollment(self.student_a.name, self.course_a.name)
		self._create_enrollment(self.student_b.name, self.course_b.name)

		self.assessments = {
			"LMS Quiz": self._create_quiz(self._create_quiz_questions(), title=f"APU Quiz {suffix}").name,
			"LMS Assignment": self._create_assignment(title=f"APU Assignment {suffix}").name,
			"LMS Programming Exercise": self._create_programming_exercise(
				title=f"APU Exercise {suffix}"
			).name,
		}
		for doctype, name in self.assessments.items():
			self._set_authors(doctype, name, [self.author.name])
			self._place_in_lesson(self.course_a.name, doctype, name)
		self.stamp_before = frappe.db.get_value(
			"LMS Quiz", self.assessments["LMS Quiz"], ["course", "lesson"], as_dict=True
		)
		self._place_as_placer()

		self.submissions = {
			doctype: {
				student.name: self._submit(doctype, name, student.name)
				for student in (self.student_a, self.student_b)
			}
			for doctype, name in self.assessments.items()
		}

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _place_as_placer(self):
		self._create_evaluator(self.moderator.name)
		batch = self._create_batch(
			self.course_b.name,
			instructor=self.placer.name,
			title=f"Placer Batch {self.course_b.name}",
			evaluator=self.moderator.name,
		)
		for doctype, name in self.assessments.items():
			batch.append("assessment", {"assessment_type": doctype, "assessment_name": name})
		batch.save()
		chapter = self._create_chapter(f"Placer Chapter {self.course_b.name}", self.course_b.name)
		blocks = [
			{"type": "quiz", "data": {"quiz": self.assessments["LMS Quiz"]}},
			{"type": "assignment", "data": {"assignment": self.assessments["LMS Assignment"]}},
			{"type": "program", "data": {"exercise": self.assessments["LMS Programming Exercise"]}},
		]
		frappe.set_user(self.placer.name)
		try:
			self.placer_lesson = frappe.client.insert(
				{
					"doctype": "Course Lesson",
					"course": self.course_b.name,
					"chapter": chapter.name,
					"title": f"Placer Lesson {self.course_b.name}",
					"content": frappe.as_json({"blocks": blocks}),
				}
			)["name"]
		finally:
			frappe.set_user("Administrator")

	def _submit(self, doctype: str, name: str, member: str) -> str:
		submission_doctype, field = SUBMISSION_FIELDS[doctype]
		values = {"doctype": submission_doctype, field: name, "member": member}
		if doctype == "LMS Quiz":
			values.update(score=1, score_out_of=1, percentage=100, passing_percentage=70)
		elif doctype == "LMS Assignment":
			values.update(answer="An answer.")
		else:
			values.update(code="print(1)", status="Passed")
		# nosemgrep: lms-unjustified-ignore-permissions - fixture seeding, not the permission under test
		return frappe.get_doc(values).insert(ignore_permissions=True).name

	def test_the_placer_cannot_write_or_delete_the_placed_assessment(self):
		"""Placing an assessment granted write, delete and share since #2826.
		Added for audit finding #3 on branch fix/assessment-placement-use-only."""
		for doctype, name in self.assessments.items():
			for ptype in ("write", "delete", "create", "share"):
				with self.subTest(doctype=doctype, ptype=ptype):
					self.assertFalse(frappe.has_permission(doctype, ptype, doc=name, user=self.placer.name))

	def test_the_placer_cannot_add_a_question_to_the_placed_quiz(self):
		"""Placing a quiz granted child-row create on it since #2826.
		Added for audit finding #3 on branch fix/assessment-placement-use-only."""
		question = self._create_quiz_questions()[0]
		frappe.set_user(self.placer.name)
		try:
			with self.assertRaises(frappe.PermissionError):
				frappe.client.insert(
					{
						"doctype": "LMS Quiz Question",
						"parent": self.assessments["LMS Quiz"],
						"parenttype": "LMS Quiz",
						"parentfield": "questions",
						"question": question.name,
						"marks": 1,
					}
				)
		finally:
			frappe.set_user("Administrator")

	def test_placing_does_not_restamp_the_authors_quiz(self):
		"""Any lesson save restamped the quiz's course and lesson since #1410.
		Added for audit finding #3 on branch fix/assessment-placement-use-only."""
		stamp = frappe.db.get_value(
			"LMS Quiz", self.assessments["LMS Quiz"], ["course", "lesson"], as_dict=True
		)
		self.assertEqual(stamp, self.stamp_before)

	def test_placing_does_not_restamp_a_quiz_placed_by_quiz_id(self):
		quiz = self.assessments["LMS Quiz"]
		chapter = self._create_chapter(f"Quiz ID Chapter {self.course_a.name}", self.course_a.name)
		lesson = self._create_lesson(f"Quiz ID Lesson {self.course_a.name}", chapter.name, self.course_a.name)
		lesson.quiz_id = quiz
		lesson.save()
		self._stamp_legacy_quiz_placement(quiz, self.course_a.name, lesson.name)

		frappe.set_user(self.placer.name)
		try:
			placer_lesson = frappe.get_doc("Course Lesson", self.placer_lesson)
			placer_lesson.title = f"{placer_lesson.title} edited"
			placer_lesson.save()
		finally:
			frappe.set_user("Administrator")
		self.assertEqual(frappe.db.get_value("LMS Quiz", quiz, "lesson"), lesson.name)

	def test_the_placer_reads_only_their_own_students_submissions(self):
		"""Placing an assessment exposed every student's submissions since #2826.
		Added for audit finding #3 on branch fix/assessment-placement-use-only."""
		for doctype, by_member in self.submissions.items():
			submission_doctype = SUBMISSION_FIELDS[doctype][0]
			own, foreign = by_member[self.student_b.name], by_member[self.student_a.name]
			with self.subTest(doctype=doctype):
				self.assertTrue(
					frappe.has_permission(submission_doctype, "read", doc=own, user=self.placer.name)
				)
				self.assertTrue(lists_for(submission_doctype, own, self.placer.name))
				self.assertFalse(
					frappe.has_permission(submission_doctype, "read", doc=foreign, user=self.placer.name)
				)
				self.assertFalse(lists_for(submission_doctype, foreign, self.placer.name))

	def test_the_placer_cannot_read_another_courses_student_through_the_progress_endpoint(self):
		"""Course progress took any member, enrolled or not, since #2054.
		Added for audit finding #3 on branch fix/assessment-placement-use-only."""
		frappe.set_user(self.placer.name)
		try:
			self.assertTrue(get_course_assessment_progress(self.course_b.name, self.student_b.name))
			with self.assertRaises(frappe.PermissionError):
				get_course_assessment_progress(self.course_b.name, self.student_a.name)
		finally:
			frappe.set_user("Administrator")

	def test_the_author_and_a_moderator_keep_full_authority(self):
		for user in (self.author.name, self.moderator.name):
			for doctype, name in self.assessments.items():
				submission_doctype = SUBMISSION_FIELDS[doctype][0]
				with self.subTest(user=user, doctype=doctype):
					self.assertTrue(frappe.has_permission(doctype, "write", doc=name, user=user))
					self.assertTrue(frappe.has_permission(doctype, "delete", doc=name, user=user))
					for submission in self.submissions[doctype].values():
						self.assertTrue(
							frappe.has_permission(submission_doctype, "read", doc=submission, user=user)
						)
						self.assertTrue(lists_for(submission_doctype, submission, user))

	def test_students_still_take_it_in_both_courses(self):
		for doctype, name in self.assessments.items():
			for student in (self.student_a, self.student_b):
				with self.subTest(doctype=doctype, student=student.name):
					self.assertTrue(can_access_assessment(doctype, name, user=student.name))

	def test_the_placer_still_reads_the_assessment(self):
		for doctype, name in self.assessments.items():
			with self.subTest(doctype=doctype):
				self.assertTrue(frappe.has_permission(doctype, "read", doc=name, user=self.placer.name))

	def test_the_placer_can_still_edit_the_lesson_that_places_it(self):
		frappe.set_user(self.placer.name)
		try:
			lesson = frappe.get_doc("Course Lesson", self.placer_lesson)
			lesson.title = f"{lesson.title} edited"
			lesson.save()
		finally:
			frappe.set_user("Administrator")
		self.assertEqual(len(frappe.get_doc("Course Lesson", self.placer_lesson).assessments), 3)


class TestPlacingNeedsExistingUse(BaseTestUtils):
	"""A lesson save may newly place only assessments its editor can already administer."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		suffix = frappe.generate_hash(length=6)
		self.author = self._create_user(f"apn-a-{suffix}@example.com", "Ann", "Author", ["Course Creator"])
		self.placer = self._create_user(f"apn-b-{suffix}@example.com", "Ben", "Placer", ["Course Creator"])
		course_a = self._create_course(f"APN Author Course {suffix}", instructor=self.author.name)
		course_b = self._create_course(f"APN Placer Course {suffix}", instructor=self.placer.name)
		self.chapter_b = self._create_chapter(f"APN Placer Chapter {suffix}", course_b.name)
		self.course_b = course_b.name
		self.titles = {
			"LMS Quiz": f"APN Quiz {suffix}",
			"LMS Assignment": f"APN Assignment {suffix}",
			"LMS Programming Exercise": f"APN Exercise {suffix}",
		}
		self.assessments = {
			"LMS Quiz": self._create_quiz(self._create_quiz_questions(), title=self.titles["LMS Quiz"]).name,
			"LMS Assignment": self._create_assignment(title=self.titles["LMS Assignment"]).name,
			"LMS Programming Exercise": self._create_programming_exercise(
				title=self.titles["LMS Programming Exercise"]
			).name,
		}
		for doctype, name in self.assessments.items():
			self._set_authors(doctype, name, [self.author.name])
			self._place_in_lesson(course_a.name, doctype, name)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _insert_lesson_as_placer(self, **values):
		frappe.set_user(self.placer.name)
		try:
			return frappe.client.insert(
				{
					"doctype": "Course Lesson",
					"course": self.course_b,
					"chapter": self.chapter_b.name,
					"title": f"APN Lesson {frappe.generate_hash(length=6)}",
					**values,
				}
			)
		finally:
			frappe.set_user("Administrator")

	def _content(self, doctype: str, name: str) -> str:
		block_type, key = {
			"LMS Quiz": ("quiz", "quiz"),
			"LMS Assignment": ("assignment", "assignment"),
			"LMS Programming Exercise": ("program", "exercise"),
		}[doctype]
		return frappe.as_json({"blocks": [{"type": block_type, "data": {key: name}}]})

	def test_placing_an_assessment_does_not_make_it_editable(self):
		for doctype, name in self.assessments.items():
			with self.subTest(doctype=doctype):
				try:
					self._insert_lesson_as_placer(content=self._content(doctype, name))
				except frappe.PermissionError:
					pass
				frappe.set_user(self.placer.name)
				try:
					frappe.client.set_value(doctype, name, "title", "Renamed by the placer")
				except frappe.PermissionError:
					pass
				finally:
					frappe.set_user("Administrator")
				self.assertEqual(frappe.db.get_value(doctype, name, "title"), self.titles[doctype])

	def test_a_lesson_cannot_place_an_assessment_its_editor_cannot_use(self):
		for doctype, name in self.assessments.items():
			for field in ("content", "instructor_content"):
				with self.subTest(doctype=doctype, field=field):
					with self.assertRaises(frappe.PermissionError):
						self._insert_lesson_as_placer(**{field: self._content(doctype, name)})
					self.assertFalse(frappe.has_permission(doctype, "read", doc=name, user=self.placer.name))

	def test_a_lesson_cannot_name_an_unusable_quiz_by_quiz_id(self):
		with self.assertRaises(frappe.PermissionError):
			self._insert_lesson_as_placer(quiz_id=self.assessments["LMS Quiz"])

	def test_an_assessment_the_editor_authored_can_be_placed(self):
		own = self._create_assignment(title=f"APN Own {frappe.generate_hash(length=6)}").name
		self._set_authors("LMS Assignment", own, [self.placer.name])
		lesson = self._insert_lesson_as_placer(content=self._content("LMS Assignment", own))
		self.assertEqual(
			[row["assessment_name"] for row in lesson["assessments"]],
			[own],
		)


class TestBatchPlacementGrantsUseOnly(BaseTestUtils):
	"""The batch path: a batch running A's assignment hands its staff that batch's
	students' work only."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		suffix = frappe.generate_hash(length=6)
		self.author = self._create_user(f"apb-a-{suffix}@example.com", "Ann", "Author", ["Course Creator"])
		self.evaluator = self._create_user(
			f"apb-e-{suffix}@example.com", "Eve", "Evaluator", ["Batch Evaluator"]
		)
		self.batch_student = self._create_user(f"apb-sb-{suffix}@example.com", "Bo", "Batch", ["LMS Student"])
		self.course_student = self._create_user(
			f"apb-sc-{suffix}@example.com", "Cy", "Course", ["LMS Student"]
		)

		course_a = self._create_course(f"APB Author Course {suffix}", instructor=self.author.name)
		self._create_enrollment(self.course_student.name, course_a.name)
		self.assignment = self._create_assignment(title=f"APB Assignment {suffix}").name
		self._set_authors("LMS Assignment", self.assignment, [self.author.name])
		self._place_in_lesson(course_a.name, "LMS Assignment", self.assignment)

		batch_course = self._create_course(f"APB Batch Course {suffix}", instructor=self.author.name)
		self._create_evaluator(self.evaluator.name)
		batch = self._create_batch(
			batch_course.name,
			instructor=self.evaluator.name,
			title=f"APB Batch {suffix}",
			evaluator=self.evaluator.name,
		)
		batch.append("assessment", {"assessment_type": "LMS Assignment", "assessment_name": self.assignment})
		batch.save()
		self.batch = batch.name
		self._create_batch_enrollment(self.batch_student.name, self.batch)

		self.submissions = {}
		for student in (self.batch_student, self.course_student):
			submission = frappe.get_doc(
				{
					"doctype": "LMS Assignment Submission",
					"assignment": self.assignment,
					"member": student.name,
					"answer": "An answer.",
				}
			)
			# nosemgrep: lms-unjustified-ignore-permissions - fixture seeding, not the permission under test
			self.submissions[student.name] = submission.insert(ignore_permissions=True).name

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def test_batch_staff_read_only_the_batchs_students_submissions(self):
		"""Running an assessment in a batch exposed every student's submissions since #2826.
		Added for audit finding #3 on branch fix/assessment-placement-use-only."""
		own = self.submissions[self.batch_student.name]
		foreign = self.submissions[self.course_student.name]
		self.assertTrue(
			frappe.has_permission("LMS Assignment Submission", "read", doc=own, user=self.evaluator.name)
		)
		self.assertTrue(lists_for("LMS Assignment Submission", own, self.evaluator.name))
		self.assertFalse(
			frappe.has_permission("LMS Assignment Submission", "read", doc=foreign, user=self.evaluator.name)
		)
		self.assertFalse(lists_for("LMS Assignment Submission", foreign, self.evaluator.name))

	def test_batch_progress_refuses_a_student_outside_the_batch(self):
		"""Batch progress took any member, enrolled or not, since #2081.
		Added for audit finding #3 on branch fix/assessment-placement-use-only."""
		frappe.set_user(self.evaluator.name)
		try:
			self.assertTrue(get_batch_student_progress(self.batch_student.name, self.batch))
			with self.assertRaises(frappe.PermissionError):
				get_batch_student_progress(self.course_student.name, self.batch)
		finally:
			frappe.set_user("Administrator")

	def test_students_still_reach_it_through_the_batch_and_the_course(self):
		for student in (self.batch_student, self.course_student):
			with self.subTest(student=student.name):
				self.assertTrue(can_access_assessment("LMS Assignment", self.assignment, user=student.name))
