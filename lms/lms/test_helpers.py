import frappe
from frappe.tests import UnitTestCase
from frappe.utils import add_days, nowdate

from lms.lms.doctype.lms_certificate.lms_certificate import get_default_certificate_template


class BaseTestUtils(UnitTestCase):
	"""
	Base class with helper methods for creating test data.
	Subclasses should call super().setUp() and super().tearDown().
	"""

	def setUp(self):
		self.cleanup_items = []

	def tearDown(self):
		for item_type, item_name in reversed(self.cleanup_items):
			if frappe.db.exists(item_type, item_name):
				try:
					frappe.delete_doc(item_type, item_name, force=True)
				except Exception as e:
					print(f"Error deleting {item_type} {item_name}: {e}")

	def _create_user(self, email, first_name, last_name, roles, user_type="Website User"):
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
		self.cleanup_items.append(("User", user.name))
		return user

	def _create_course(self, title="Utility Course", instructor="frappe@example.com"):
		existing = frappe.db.exists("LMS Course", {"title": title})
		if existing:
			return frappe.get_doc("LMS Course", existing)

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
		self.cleanup_items.append(("LMS Course", course.name))
		return course

	def _create_chapter(self, title, course):
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
		self.cleanup_items.append(("Course Chapter", chapter.name))
		return chapter

	def _create_lesson(self, title, chapter, course, content=None):
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
		self.cleanup_items.append(("Course Lesson", lesson.name))
		return lesson

	def _create_lesson_reference(self, chapter, lesson):
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
		self.cleanup_items.append(("Lesson Reference", lesson_ref.name))
		return lesson_ref

	def _create_chapter_reference(self, course, chapter, idx=1):
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
		self.cleanup_items.append(("Chapter Reference", chapter_ref.name))
		return chapter_ref

	def _create_enrollment(self, member, course):
		existing = frappe.db.exists("LMS Enrollment", {"course": course, "member": member})
		if existing:
			return frappe.get_doc("LMS Enrollment", existing)

		enrollment = frappe.new_doc("LMS Enrollment")
		enrollment.update({"member": member, "course": course})
		enrollment.insert()
		self.cleanup_items.append(("LMS Enrollment", enrollment.name))
		return enrollment

	def _create_progress(self, member, course, lesson):
		progress = frappe.new_doc("LMS Course Progress")
		progress.update({"member": member, "course": course, "lesson": lesson})
		progress.insert()
		self.cleanup_items.append(("LMS Course Progress", progress.name))
		return progress

	def _create_evaluator(self, evaluator_email="frappe@example.com"):
		if frappe.db.exists("Course Evaluator", evaluator_email):
			return frappe.get_doc("Course Evaluator", evaluator_email)

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
		self.cleanup_items.append(("Course Evaluator", evaluator.name))
		return evaluator

	def _create_batch(
		self,
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
		self.cleanup_items.append(("LMS Batch", batch.name))
		return batch

	def _create_batch_enrollment(self, member, batch):
		existing = frappe.db.exists("LMS Batch Enrollment", {"batch": batch, "member": member})
		if existing:
			return frappe.get_doc("LMS Batch Enrollment", existing)

		batch_enrollment = frappe.new_doc("LMS Batch Enrollment")
		batch_enrollment.update({"member": member, "batch": batch})
		batch_enrollment.insert()
		self.cleanup_items.append(("LMS Batch Enrollment", batch_enrollment.name))
		return batch_enrollment

	def _add_rating(self, course, member, rating, review_text):
		existing = frappe.db.exists("LMS Course Review", {"course": course, "owner": member})
		if existing:
			return frappe.get_doc("LMS Course Review", existing)

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
		self.cleanup_items.append(("LMS Course Review", review_doc.name))
		frappe.session.user = "Administrator"
		return review_doc

	def _create_certificate(self, course, member):
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
		self.cleanup_items.append(("LMS Certificate", certificate.name))
		return certificate

	def _create_quiz_questions(self):
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
			self.cleanup_items.append(("LMS Quiz Question", question.name))
			questions.append(question)
		return questions

	def _create_quiz(self, title="Utility Quiz"):
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

		for question in self.questions:
			quiz.append(
				"questions",
				{
					"question": question.name,
					"marks": 5,
				},
			)
		quiz.save()
		self.cleanup_items.append(("LMS Quiz", quiz.name))
		return quiz

	def _create_assignment(self, title="Utility Assignment"):
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
		self.cleanup_items.append(("LMS Assignment", assignment.name))
		return assignment

	def _setup_course_flow(self):
		self.student1 = self._create_user("student1@example.com", "Ashley", "Smith", ["LMS Student"])
		self.student2 = self._create_user("student2@example.com", "John", "Doe", ["LMS Student"])
		self.admin = self._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator", "Batch Evaluator"]
		)
		self.course = self._create_course()
		self._setup_quiz()
		self._setup_assignment()
		self._setup_programming_exercise()
		self._setup_chapters()

		self._create_enrollment(self.student1.email, self.course.name)
		self._add_student_progress(self.student1.email, self.course.name)
		self._create_enrollment(self.student2.email, self.course.name)
		self._add_student_progress(self.student2.email, self.course.name)

		self._add_rating(self.course.name, self.student1.email, 0.8, "Good course")
		self._add_rating(self.course.name, self.student2.email, 1, "Excellent course")

		self._create_certificate(self.course.name, self.student1.email)

	def _setup_quiz(self):
		self.questions = self._create_quiz_questions()
		self.quiz = self._create_quiz()

	def _setup_assignment(self):
		self.assignment = self._create_assignment()

	def _setup_programming_exercise(self):
		self.programming_exercise = self._create_programming_exercise()

	def _setup_chapters(self):
		chapters = []
		for i in range(1, 4):
			chapter = self._create_chapter(f"Chapter {i}", self.course.name)
			chapters.append(chapter)
		self.course.reload()
		for chapter in chapters:
			if not any(c.chapter == chapter.name for c in self.course.chapters):
				self.course.append("chapters", {"chapter": chapter.name})
		self.course.save()
		self._setup_lessons()

	def _setup_lessons(self):
		for index, chapter_ref in enumerate(self.course.chapters):
			chapter_doc = frappe.get_doc("Course Chapter", chapter_ref.chapter)
			for j in range(1, 5):
				content = None
				if j == 2 and index == 2:
					content = self._get_quiz_lesson_content()
				if j == 3 and index == 2:
					content = self._get_assignment_lesson_content()
				if j == 4 and index == 2:
					content = self._get_exercise_lesson_content()
				lesson_title = f"Lesson {j} of {chapter_ref.chapter}"
				lesson = self._create_lesson(lesson_title, chapter_ref.chapter, self.course.name, content)

				if not any(l.lesson == lesson.name for l in chapter_doc.lessons):
					chapter_doc.append("lessons", {"lesson": lesson.name})

			chapter_doc.save()

	def _get_quiz_lesson_content(self):
		return f"""{{
			"time": 1765194986690,
			"blocks": [
				{{
					"id": "dkLzbW14ds",
					"type": "quiz",
					"data": {{ "quiz": "{self.quiz.name}" }}
				}}
			],
			"version": "2.29.0"
		}}"""

	def _get_assignment_lesson_content(self):
		return f"""{{
			"time": 1765194986690,
			"blocks": [
				{{
					"id": "dkLzbW14ds",
					"type": "assignment",
					"data": {{ "assignment": "{self.assignment.name}" }}
				}}
			],
			"version": "2.29.0"
		}}"""

	def _get_exercise_lesson_content(self):
		return f"""{{
			"time": 1765194986690,
			"blocks": [
				{{
					"id": "dkLzbW14ds",
					"type": "program",
					"data": {{ "exercise": "{self.programming_exercise.name}" }}
				}}
			],
			"version": "2.29.0"
		}}"""

	def _setup_batch_flow(self):
		self.evaluator = self._create_evaluator()
		self.batch = self._create_batch(self.course.name)
		self._create_batch_enrollment(self.student1.email, self.batch.name)
		self._create_batch_enrollment(self.student2.email, self.batch.name)

	def _add_student_progress(self, member, course):
		self._create_quiz_submission(member)
		self._create_assignment_submission(member)
		self._create_programming_exercise_submission(member)
		lessons = frappe.db.get_all(
			"Course Lesson", {"course": course}, pluck="name", limit=2, order_by="creation desc"
		)
		for lesson in lessons:
			self._create_lesson_progress(member, course, lesson)

	def _create_lesson_progress(self, member, course, lesson):
		existing = frappe.db.exists(
			"LMS Course Progress", {"member": member, "course": course, "lesson": lesson}
		)
		if existing:
			return frappe.get_doc("LMS Course Progress", existing)

		progress = frappe.new_doc("LMS Course Progress")
		progress.update({"member": member, "course": course, "lesson": lesson, "status": "Complete"})
		progress.insert()
		self.cleanup_items.append(("LMS Course Progress", progress.name))
		return progress

	def _create_quiz_submission(self, member):
		existing = frappe.db.exists("LMS Quiz Submission", {"quiz": self.quiz.name, "member": member})
		if existing:
			return frappe.get_doc("LMS Quiz Submission", existing)
		submission = frappe.new_doc("LMS Quiz Submission")
		submission.update(
			{
				"quiz": self.quiz.name,
				"member": member,
				"score_out_of": self.quiz.total_marks,
				"passing_percentage": self.quiz.passing_percentage,
			}
		)

		for question in self.questions:
			submission.append(
				"result",
				{
					"question": question.name,
					"marks": 4,
					"marks_out_of": 5,
				},
			)

		submission.insert()
		self.cleanup_items.append(("LMS Quiz Submission", submission.name))
		return submission

	def _create_assignment_submission(self, member):
		existing = frappe.db.exists(
			"LMS Assignment Submission", {"assignment": self.assignment.name, "member": member}
		)
		if existing:
			return frappe.get_doc("LMS Assignment Submission", existing)

		submission = frappe.new_doc("LMS Assignment Submission")
		submission.update(
			{
				"assignment": self.assignment.name,
				"member": member,
				"answer": "This is the submission content for the utility assignment.",
				"status": "Pass",
			}
		)

		submission.insert()
		self.cleanup_items.append(("LMS Assignment Submission", submission.name))
		return submission

	def _create_programming_exercise(self, title="Utility Programming Exercise"):
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
		self.cleanup_items.append(("LMS Programming Exercise", programming_exercise.name))
		return programming_exercise

	def _create_programming_exercise_submission(self, member):
		existing = frappe.db.exists(
			"LMS Programming Exercise Submission",
			{"exercise": self.programming_exercise.name, "member": member},
		)
		if existing:
			return frappe.get_doc("LMS Programming Exercise Submission", existing)

		submission = frappe.new_doc("LMS Programming Exercise Submission")
		submission.update(
			{
				"exercise": self.programming_exercise.name,
				"member": member,
				"code": "print(inputs[0] + 1)",
				"status": "Passed",
			}
		)

		submission.insert()
		self.cleanup_items.append(("LMS Programming Exercise Submission", submission.name))
		return submission
