import json

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from lms.lms.doctype.lms_certificate.lms_certificate import get_default_certificate_template
from lms.lms.doctype.lms_quiz.lms_quiz import submit_quiz


class BaseTestUtils(IntegrationTestCase):
	"""
	Base class with helper methods for creating test data.
	Subclasses should call super().setUp() and super().tearDown().

	Fixture helpers are classmethods so they can build shared fixtures in
	setUpClass as well as per-test state in setUp. Each test runs inside a
	savepoint that undoes everything it did; nothing needs to be registered
	for cleanup.
	"""

	def setUp(self):
		super().setUp()
		frappe.db.savepoint("lms_test")

	def tearDown(self):
		frappe.db.rollback(save_point="lms_test")
		if hasattr(frappe.local, "document_cache"):
			frappe.local.document_cache.clear()
		frappe.session.user = "Administrator"
		super().tearDown()

	@classmethod
	def _create_user(cls, email, first_name, last_name, roles, user_type="Website User"):
		if frappe.db.exists("User", email):
			return frappe.get_doc("User", email)

		user = frappe.new_doc("User")
		user.update(
			{
				"email": email,
				"first_name": first_name,
				"last_name": last_name,
				"user_type": user_type,
				"send_welcome_email": False,
			}
		)
		for role in roles:
			user.append("roles", {"role": role})
		user.save()
		return user

	@classmethod
	def _create_course(cls, title="Utility Course", instructor="frappe@example.com"):
		existing = frappe.db.exists("LMS Course", {"title": title})
		if existing:
			return frappe.get_doc("LMS Course", existing)

		# LMS Category autonames from `category`, so the name is the category itself and a
		# duplicate insert fails on the primary key -- the unique constraint already exists.
		# nosemgrep: lms-exists-then-insert - name is the category, duplicate insert fails on the PK
		if not frappe.db.exists("LMS Category", "Business"):
			frappe.get_doc({"doctype": "LMS Category", "category": "Business"}).insert(
				ignore_permissions=True
			)

		course = frappe.new_doc("LMS Course")
		course.update(
			{
				"title": title,
				"short_introduction": "A course to test utilities of Frappe Learning",
				"description": "This is a detailed description of the Utility Course.",
				"tags": "Frappe,Learning,Utility",
				"category": "Business",
				"published": 1,
				"instructors": [{"instructor": instructor}],
			}
		)
		course.save()
		return course

	@classmethod
	def _create_chapter(cls, title, course):
		if not title:
			title = f"Course Chapter {frappe.generate_hash()}"

		existing = frappe.db.exists("Course Chapter", {"course": course, "title": title})
		if existing:
			return frappe.get_doc("Course Chapter", existing)

		chapter = frappe.new_doc("Course Chapter")
		chapter.update(
			{
				"course": course,
				"title": title,
			}
		)
		chapter.save()
		return chapter

	@classmethod
	def _create_lesson(cls, title, chapter, course, content=None):
		existing = frappe.db.exists("Course Lesson", {"course": course, "title": title})
		if existing:
			return frappe.get_doc("Course Lesson", existing)

		if not content:
			content = '{"time":1765194986690,"blocks":[{"id":"dkLzbW14ds","type":"markdown","data":{"text":"This is a simple content for the current lesson."}},{"id":"KBwuWPc8rV","type":"markdown","data":{"text":""}}],"version":"2.29.0"}'

		lesson = frappe.new_doc("Course Lesson")
		lesson.update(
			{
				"course": course,
				"chapter": chapter,
				"title": title,
				"content": content,
			}
		)
		lesson.save()
		return lesson

	@classmethod
	def _create_lesson_reference(cls, chapter, lesson):
		lesson_ref = frappe.get_doc(
			{
				"doctype": "Lesson Reference",
				"lesson": lesson,
				"parent": chapter,
				"parenttype": "Course Chapter",
				"parentfield": "lessons",
				"idx": 1,
			}
		)
		lesson_ref.insert()
		return lesson_ref

	@classmethod
	def _create_chapter_reference(cls, course, chapter, idx=1):
		chapter_ref = frappe.get_doc(
			{
				"doctype": "Chapter Reference",
				"chapter": chapter,
				"parent": course,
				"parenttype": "LMS Course",
				"parentfield": "chapters",
				"idx": idx,
			}
		)
		chapter_ref.insert()
		return chapter_ref

	@classmethod
	def _create_enrollment(cls, member, course):
		existing = frappe.db.exists("LMS Enrollment", {"course": course, "member": member})
		if existing:
			return frappe.get_doc("LMS Enrollment", existing)

		enrollment = frappe.new_doc("LMS Enrollment")
		enrollment.update({"member": member, "course": course})
		enrollment.insert()
		return enrollment

	@classmethod
	def _create_progress(cls, member, course, lesson):
		progress = frappe.new_doc("LMS Course Progress")
		progress.update({"member": member, "course": course, "lesson": lesson})
		progress.insert()
		return progress

	@classmethod
	def _create_evaluator(cls, evaluator_email="frappe@example.com"):
		if frappe.db.exists("Course Evaluator", evaluator_email):
			evaluator = frappe.get_doc("Course Evaluator", evaluator_email)
			# The window is relative to the day it was written, and this doc
			# outlives the run that made it. Left stale, it swallows the dates
			# callers compute from today and the failure looks like a date bug.
			evaluator.unavailable_from = add_days(nowdate(), 5)
			evaluator.unavailable_to = add_days(nowdate(), 12)
			evaluator.save()
			return evaluator

		evaluator = frappe.new_doc("Course Evaluator")
		evaluator.update(
			{
				"evaluator": evaluator_email,
				"schedule": [
					{"day": "Monday", "start_time": "10:00", "end_time": "12:00"},
					{"day": "Wednesday", "start_time": "14:00", "end_time": "16:00"},
				],
				"unavailable_from": add_days(nowdate(), 5),
				"unavailable_to": add_days(nowdate(), 12),
			}
		)
		evaluator.save()
		return evaluator

	@classmethod
	def _create_batch(
		cls,
		course,
		instructor="frappe@example.com",
		title="Utility Training",
		evaluator="frappe@example.com",
	):
		existing = frappe.db.exists("LMS Batch", {"title": title})
		if existing:
			return frappe.get_doc("LMS Batch", existing)

		batch = frappe.new_doc("LMS Batch")
		batch.update(
			{
				"title": title,
				"start_date": nowdate(),
				"end_date": add_days(nowdate(), 10),
				"start_time": "09:00:00",
				"end_time": "11:00:00",
				"timezone": "Asia/Kolkata",
				"published": 1,
				"description": "Batch for Utility Course Training",
				"batch_details": "This batch is created to test utility functions.",
				"evaluation_end_date": add_days(nowdate(), 120),
				"instructors": [{"instructor": instructor}],
				"courses": [{"course": course, "evaluator": evaluator}],
			}
		)
		batch.save()
		return batch

	@classmethod
	def _create_batch_enrollment(cls, member, batch):
		existing = frappe.db.exists("LMS Batch Enrollment", {"batch": batch, "member": member})
		if existing:
			return frappe.get_doc("LMS Batch Enrollment", existing)

		batch_enrollment = frappe.new_doc("LMS Batch Enrollment")
		batch_enrollment.update({"member": member, "batch": batch})
		batch_enrollment.insert()
		return batch_enrollment

	@classmethod
	def _add_rating(cls, course, member, rating, review_text):
		existing = frappe.db.exists("LMS Course Review", {"course": course, "owner": member})
		if existing:
			return frappe.get_doc("LMS Course Review", existing)

		original_user = frappe.session.user
		frappe.session.user = member
		review_doc = frappe.new_doc("LMS Course Review")
		review_doc.update(
			{
				"course": course,
				"rating": rating,
				"review": review_text,
			}
		)
		review_doc.save()
		frappe.session.user = original_user
		return review_doc

	@classmethod
	def _create_certificate(cls, course, member):
		existing = frappe.db.exists("LMS Certificate", {"course": course, "member": member})
		if existing:
			return frappe.get_doc("LMS Certificate", existing)

		certificate = frappe.new_doc("LMS Certificate")
		certificate.update(
			{
				"course": course,
				"member": member,
				"issue_date": frappe.utils.nowdate(),
				"template": get_default_certificate_template(),
				"published": 1,
			}
		)
		certificate.save()
		return certificate

	@classmethod
	def _create_quiz_questions(cls):
		questions = []
		for index in range(1, 4):
			question = frappe.new_doc("LMS Question")
			question.update(
				{
					"question": f"Utility Question {index}?",
					"type": "Choices",
					"option_1": "Option 1",
					"is_correct_1": 1,
					"option_2": "Option 2",
					"is_correct_2": 0,
				}
			)
			question.save()
			questions.append(question)
		return questions

	@classmethod
	def _create_quiz(cls, questions, title="Utility Quiz"):
		existing = frappe.db.exists("LMS Quiz", {"title": title})
		if existing:
			return frappe.get_doc("LMS Quiz", existing)

		quiz = frappe.new_doc("LMS Quiz")
		quiz.update(
			{
				"title": title,
				"passing_percentage": 70,
				"total_marks": 15,
			}
		)

		for question in questions:
			quiz.append(
				"questions",
				{
					"question": question.name,
					"marks": 5,
				},
			)
		quiz.save()
		return quiz

	@classmethod
	def _create_assignment(cls, title="Utility Assignment"):
		existing = frappe.db.exists("LMS Assignment", {"title": title})
		if existing:
			return frappe.get_doc("LMS Assignment", existing)

		assignment = frappe.new_doc("LMS Assignment")
		assignment.update(
			{
				"title": title,
				"question": "This is a utility assignment to test the assignment creation helper method.",
				"type": "Text",
				"grade_assignment": 1,
			}
		)
		assignment.save()
		return assignment

	@classmethod
	def _setup_course_flow(cls):
		cls.student1 = cls._create_user("student1@example.com", "Ashley", "Smith", ["LMS Student"])
		cls.student2 = cls._create_user("student2@example.com", "John", "Doe", ["LMS Student"])
		cls.admin = cls._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator", "Batch Evaluator"]
		)
		cls.course = cls._create_course()
		cls._setup_quiz()
		cls._setup_assignment()
		cls._setup_programming_exercise()
		cls._setup_chapters()

		cls._create_enrollment(cls.student1.email, cls.course.name)
		cls._add_student_progress(cls.student1.email, cls.course.name)
		cls._create_enrollment(cls.student2.email, cls.course.name)
		cls._add_student_progress(cls.student2.email, cls.course.name)

		cls._add_rating(cls.course.name, cls.student1.email, 0.8, "Good course")
		cls._add_rating(cls.course.name, cls.student2.email, 1, "Excellent course")

		cls._create_certificate(cls.course.name, cls.student1.email)

	@classmethod
	def _setup_quiz(cls):
		cls.questions = cls._create_quiz_questions()
		cls.quiz = cls._create_quiz(cls.questions)

	@classmethod
	def _setup_assignment(cls):
		cls.assignment = cls._create_assignment()

	@classmethod
	def _setup_programming_exercise(cls):
		cls.programming_exercise = cls._create_programming_exercise()

	@classmethod
	def _setup_chapters(cls):
		chapters = []
		for i in range(1, 4):
			chapter = cls._create_chapter(f"Chapter {i}", cls.course.name)
			chapters.append(chapter)
		cls.course.reload()
		for chapter in chapters:
			if not any(c.chapter == chapter.name for c in cls.course.chapters):
				cls.course.append("chapters", {"chapter": chapter.name})
		cls.course.save()
		cls._setup_lessons()

	@classmethod
	def _setup_lessons(cls):
		for index, chapter_ref in enumerate(cls.course.chapters):
			chapter_doc = frappe.get_doc("Course Chapter", chapter_ref.chapter)
			for j in range(1, 5):
				content = None
				if j == 2 and index == 2:
					content = cls._get_quiz_lesson_content()
				if j == 3 and index == 2:
					content = cls._get_assignment_lesson_content()
				if j == 4 and index == 2:
					content = cls._get_exercise_lesson_content()
				lesson_title = f"Lesson {j} of {chapter_ref.chapter}"
				lesson = cls._create_lesson(lesson_title, chapter_ref.chapter, cls.course.name, content)

				if not any(l.lesson == lesson.name for l in chapter_doc.lessons):
					chapter_doc.append("lessons", {"lesson": lesson.name})

			chapter_doc.save()

	@classmethod
	def _get_quiz_lesson_content(cls):
		return f"""{{
			"time": 1765194986690,
			"blocks": [
				{{
					"id": "dkLzbW14ds",
					"type": "quiz",
					"data": {{ "quiz": "{cls.quiz.name}" }}
				}}
			],
			"version": "2.29.0"
		}}"""

	@classmethod
	def _get_assignment_lesson_content(cls):
		return f"""{{
			"time": 1765194986690,
			"blocks": [
				{{
					"id": "dkLzbW14ds",
					"type": "assignment",
					"data": {{ "assignment": "{cls.assignment.name}" }}
				}}
			],
			"version": "2.29.0"
		}}"""

	@classmethod
	def _get_exercise_lesson_content(cls):
		return f"""{{
			"time": 1765194986690,
			"blocks": [
				{{
					"id": "dkLzbW14ds",
					"type": "program",
					"data": {{ "exercise": "{cls.programming_exercise.name}" }}
				}}
			],
			"version": "2.29.0"
		}}"""

	@classmethod
	def _setup_batch_flow(cls):
		cls.evaluator = cls._create_evaluator()
		cls.batch = cls._create_batch(cls.course.name)
		cls._create_batch_enrollment(cls.student1.email, cls.batch.name)
		cls._create_batch_enrollment(cls.student2.email, cls.batch.name)

	@classmethod
	def _add_student_progress(cls, member, course):
		cls._create_quiz_submission(member)
		cls._create_assignment_submission(member)
		cls._create_programming_exercise_submission(member)
		lessons = frappe.db.get_all(
			"Course Lesson", {"course": course}, pluck="name", limit=2, order_by="creation desc"
		)
		for lesson in lessons:
			cls._create_lesson_progress(member, course, lesson)

	@classmethod
	def _create_lesson_progress(cls, member, course, lesson):
		existing = frappe.db.exists(
			"LMS Course Progress", {"member": member, "course": course, "lesson": lesson}
		)
		if existing:
			return frappe.get_doc("LMS Course Progress", existing)

		progress = frappe.new_doc("LMS Course Progress")
		progress.update({"member": member, "course": course, "lesson": lesson, "status": "Complete"})
		progress.insert()
		return progress

	@classmethod
	def _create_quiz_submission(cls, member):
		existing = frappe.db.exists("LMS Quiz Submission", {"quiz": cls.quiz.name, "member": member})
		if existing:
			return frappe.get_doc("LMS Quiz Submission", existing)

		original_user = frappe.session.user
		frappe.session.user = member
		results = []
		for index, question in enumerate(cls.questions):
			results.append(
				{
					"question_name": question.name,
					"answer": [question.option_1 if index % 2 == 0 else question.option_2],
				}
			)
		submit_quiz(cls.quiz.name, json.dumps(results))
		frappe.session.user = original_user

	@classmethod
	def _create_assignment_submission(cls, member):
		existing = frappe.db.exists(
			"LMS Assignment Submission", {"assignment": cls.assignment.name, "member": member}
		)
		if existing:
			return frappe.get_doc("LMS Assignment Submission", existing)

		submission = frappe.new_doc("LMS Assignment Submission")
		submission.update(
			{
				"assignment": cls.assignment.name,
				"member": member,
				"answer": "This is the submission content for the utility assignment.",
				"status": "Pass",
			}
		)

		submission.insert()
		return submission

	@classmethod
	def _create_programming_exercise(cls, title="Utility Programming Exercise"):
		existing = frappe.db.exists("LMS Programming Exercise", {"title": title})
		if existing:
			return frappe.get_doc("LMS Programming Exercise", existing)

		programming_exercise = frappe.new_doc("LMS Programming Exercise")
		programming_exercise.update(
			{
				"title": title,
				"language": "Python",
				"problem_statement": "Write a function to return the sum of two numbers.",
				"test_cases": [
					{"input": "2", "expected_output": "3"},
					{"input": "11", "expected_output": "12"},
				],
			}
		)
		programming_exercise.save()
		return programming_exercise

	@classmethod
	def _create_programming_exercise_submission(cls, member):
		existing = frappe.db.exists(
			"LMS Programming Exercise Submission",
			{"exercise": cls.programming_exercise.name, "member": member},
		)
		if existing:
			return frappe.get_doc("LMS Programming Exercise Submission", existing)

		submission = frappe.new_doc("LMS Programming Exercise Submission")
		submission.update(
			{
				"exercise": cls.programming_exercise.name,
				"member": member,
				"code": "print(inputs[0] + 1)",
				"status": "Passed",
			}
		)

		submission.insert()
		return submission


class MemberOwnershipTestMixin:
	"""Shared member-ownership rules for a doctype where a student may only act
	on their own `member` row unless privileged (Moderator etc.). Concrete
	classes provide `_new_doc(member=None, variant=0)`; `variant` lets a
	subclass avoid colliding with itself across the rows below when its
	fixtures dedupe on some other field (e.g. a booking slot)."""

	def test_student_cannot_act_for_another_member(self):
		frappe.set_user(self.student_a.name)
		doc = self._new_doc(member=self.student_b.name, variant=1)
		with self.assertRaises(frappe.PermissionError):
			doc.insert()

	def test_student_member_defaults_to_or_matches_session_user(self):
		frappe.set_user(self.student_a.name)
		cases = [
			("defaults_when_unset", None, 2),
			("explicit_self", self.student_a.name, 3),
		]
		for case, member, variant in cases:
			with self.subTest(case=case):
				doc = self._new_doc(member=member, variant=variant)
				doc.insert()
				self.assertEqual(doc.member, self.student_a.name)
				# Both rows target the same member on the same underlying record
				# (course/assignment); a duplicate-request/duplicate-submission
				# guard on that pair would otherwise reject the second row, which
				# never happened when these were two separate, savepoint-isolated
				# test methods.
				frappe.delete_doc(doc.doctype, doc.name, ignore_permissions=True)

	def test_privileged_user_can_act_on_behalf_of_member(self):
		frappe.set_user(self.moderator.name)
		doc = self._new_doc(member=self.student_b.name, variant=4)
		doc.insert()
		self.assertEqual(doc.member, self.student_b.name)
