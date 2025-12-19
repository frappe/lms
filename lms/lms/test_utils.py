import frappe
from frappe.tests import UnitTestCase
from frappe.utils import add_days, nowdate

from lms.lms.doctype.lms_certificate.lms_certificate import get_default_certificate_template, is_certified

from .utils import (
	get_average_rating,
	get_chapters,
	get_evaluator,
	get_instructors,
	get_lesson_index,
	get_lesson_url,
	get_lessons,
	get_membership,
	get_reviews,
	get_tags,
	has_course_instructor_role,
	has_evaluator_role,
	has_moderator_role,
	has_student_role,
	is_instructor,
	slugify,
)


class TestUtils(UnitTestCase):
	def setUp(self):
		self.student1 = self.create_user("student1@example.com", "Ashley", "Smith", ["LMS Student"])
		self.student2 = self.create_user("student2@example.com", "John", "Doe", ["LMS Student"])
		self.admin = self.create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator", "Batch Evaluator"]
		)

		self.course = self.create_a_course()
		self.add_chapters()
		self.add_lessons()

		self.add_enrollment(self.course.name, self.student1.email)
		self.add_enrollment(self.course.name, self.student2.email)

		self.add_rating(self.course.name, self.student1.email, 0.8, "Good course")
		self.add_rating(self.course.name, self.student2.email, 1, "Excellent course")

		self.create_certificate(self.course.name, self.student1.email)

		self.evaluator = self.create_evaluator()
		self.batch = self.create_a_batch()

	def create_a_course(self):
		existing_course = frappe.db.exists("LMS Course", {"title": "Utility Course"})
		if existing_course:
			return frappe.get_doc("LMS Course", existing_course)

		course = frappe.new_doc("LMS Course")
		course.title = "Utility Course"
		course.short_introduction = "A course to test utilities of Frappe Learning"
		course.description = "This is a detailed description of the Utility Course."
		course.tags = "Frappe,Learning,Utility"
		course.published = 1
		course.append("instructors", {"instructor": "frappe@example.com"})
		course.save()
		return course

	def add_chapters(self):
		chapters = []
		for i in range(1, 4):
			chapter = frappe.new_doc("Course Chapter")
			chapter.course = self.course.name
			chapter.title = f"Chapter {i}"
			chapter.save()
			chapters.append(chapter)

		self.course.reload()
		for chapter in chapters:
			self.course.append("chapters", {"chapter": chapter.name})
		self.course.save()

	def add_lessons(self):
		for chapter in self.course.chapters:
			chapterDoc = frappe.get_doc("Course Chapter", chapter.chapter)
			lessons = []
			for j in range(1, 3):
				lesson = frappe.new_doc("Course Lesson")
				lesson.course = self.course.name
				lesson.chapter = chapter.chapter
				lesson.title = f"Lesson {j} of {chapter.chapter}"
				content = '{"time":1765194986690,"blocks":[{"id":"dkLzbW14ds","type":"markdown","data":{"text":"This is a simple content for the current lesson."}},{"id":"KBwuWPc8rV","type":"markdown","data":{"text":""}}],"version":"2.29.0"}'
				lesson.content = content
				lesson.save()
				lessons.append(lesson)

			for lesson in lessons:
				chapterDoc.append("lessons", {"lesson": lesson.name})
			chapterDoc.save()

	def create_evaluator(self):
		if frappe.db.exists("Course Evaluator", "frappe@example.com"):
			return frappe.get_doc("Course Evaluator", "frappe@example.com")

		evaluator = frappe.new_doc("Course Evaluator")
		evaluator.evaluator = "frappe@example.com"
		evaluator.append("schedule", {"day": "Monday", "start_time": "10:00", "end_time": "12:00"})
		evaluator.append("schedule", {"day": "Wednesday", "start_time": "14:00", "end_time": "16:00"})
		evaluator.unavailable_from = add_days(nowdate(), 5)
		evaluator.unavailable_to = add_days(nowdate(), 12)
		evaluator.save()
		return evaluator

	def create_a_batch(self):
		existing_batch = frappe.db.exists("LMS Batch", {"title": "Utility Training"})
		if existing_batch:
			return frappe.get_doc("LMS Batch", existing_batch)

		batch = frappe.new_doc("LMS Batch")
		batch.title = "Utility Training"
		batch.start_date = nowdate()
		batch.end_date = add_days(batch.start_date, 10)
		batch.start_time = "09:00:00"
		batch.end_time = "11:00:00"
		batch.timezone = "Asia/Kolkata"
		batch.description = "Batch for Utility Course Training"
		batch.batch_details = "This batch is created to test utility functions."
		batch.evaluation_end_date = add_days(nowdate(), 120)
		batch.append("instructors", {"instructor": "frappe@example.com"})
		batch.append("courses", {"course": self.course.name, "evaluator": "frappe@example.com"})
		batch.save()
		return batch

	def create_user(self, email, first_name, last_name, roles):
		if frappe.db.exists("User", email):
			return frappe.get_doc("User", email)
		else:
			user = frappe.new_doc("User")
			user.email = email
			user.first_name = first_name
			user.last_name = last_name
			user.user_type = "Website User"
			for role in roles:
				user.append("roles", {"role": role})
			user.save()
			return user

	def create_certificate(self, course_name, member):
		certificate = frappe.new_doc("LMS Certificate")
		certificate.course = course_name
		certificate.member = member
		certificate.issue_date = frappe.utils.nowdate()
		certificate.template = get_default_certificate_template()
		certificate.save()
		return certificate

	def test_simple_slugs(self):
		self.assertEqual(slugify("hello-world"), "hello-world")
		self.assertEqual(slugify("Hello World"), "hello-world")
		self.assertEqual(slugify("Hello, World!"), "hello-world")

	def test_duplicates_slugs(self):
		self.assertEqual(slugify("Hello World", ["hello-world"]), "hello-world-2")
		self.assertEqual(slugify("Hello World", ["hello-world", "hello-world-2"]), "hello-world-3")

	def add_enrollment(self, course, member):
		enrollment = frappe.new_doc("LMS Enrollment")
		enrollment.course = course
		enrollment.member = member
		enrollment.save()

	def test_get_membership(self):
		membership = get_membership(self.course.name, self.student1.email)
		self.assertIsNotNone(membership)
		self.assertEqual(membership.course, self.course.name)
		self.assertEqual(membership.member, self.student1.email)

	def test_get_chapters(self):
		chapters = get_chapters(self.course.name)
		self.assertEqual(len(chapters), len(self.course.chapters))

		for i, chapter in enumerate(chapters, start=1):
			self.assertEqual(chapter.title, f"Chapter {i}")

	def test_get_lessons(self):
		lessons = get_lessons(self.course.name)
		all_lessons = frappe.db.count("Course Lesson", {"course": self.course.name})
		self.assertEqual(len(lessons), all_lessons)

		for chapter in self.course.chapters:
			chapter_lessons = [lesson for lesson in lessons if lesson.chapter == chapter.chapter]
			self.assertEqual(len(chapter_lessons), 2)
			for j, lesson in enumerate(chapter_lessons, start=1):
				self.assertEqual(lesson.title, f"Lesson {j} of {chapter.chapter}")
				self.assertEqual(lesson.number, f"{chapter.idx}-{j}")

	def test_get_tags(self):
		tags = get_tags(self.course.name)
		expected_tags = ["Frappe", "Learning", "Utility"]
		self.assertEqual(set(tags), set(expected_tags))

	def test_get_instructors(self):
		instructors = get_instructors("LMS Course", self.course.name)
		self.assertEqual(len(instructors), len(self.course.instructors))
		self.assertEqual(instructors[0].name, "frappe@example.com")

	def test_get_average_rating(self):
		average_rating = get_average_rating(self.course.name)
		self.assertEqual(average_rating, 4.5)

	def add_rating(self, course_name, member, rating, review):
		frappe.session.user = member
		review = frappe.new_doc("LMS Course Review")
		review.course = course_name
		review.rating = rating
		review.review = review
		review.save()
		frappe.session.user = "Administrator"

	def test_get_reviews(self):
		reviews = get_reviews(self.course.name)
		self.assertEqual(len(reviews), 2)

		for review in reviews:
			if review.rating == 0.8:
				self.assertEqual(review.member, self.student1.email)
				self.assertEqual(review.review, "Good course")
			elif review.rating == 1:
				self.assertEqual(review.member, self.student2.email)
				self.assertEqual(review.review, "Excellent course")

	def test_get_lesson_index(self):
		lessons = get_lessons(self.course.name)
		for lesson in lessons:
			self.assertEqual(get_lesson_index(lesson.name), lesson.number)

	def test_get_lesson_url(self):
		lessons = get_lessons(self.course.name)
		for lesson in lessons:
			expected_url = f"/lms/courses/{self.course.name}/learn/{lesson.number}"
			self.assertEqual(get_lesson_url(self.course.name, lesson.number), expected_url)

	def test_is_instructor(self):
		frappe.session.user = "frappe@example.com"
		self.assertTrue(is_instructor(self.course.name))
		frappe.session.user = "Administrator"
		self.assertFalse(is_instructor(self.course.name))

	def test_has_course_instructor_role(self):
		self.assertIsNotNone(has_course_instructor_role("frappe@example.com"))
		self.assertIsNone(has_course_instructor_role("student1@example.com"))

	def test_has_moderator_role(self):
		self.assertIsNotNone(has_moderator_role("frappe@example.com"))
		self.assertIsNone(has_moderator_role("student2@example.com"))

	def test_has_evaluator_role(self):
		self.assertIsNotNone(has_evaluator_role("frappe@example.com"))
		self.assertIsNone(has_evaluator_role("student2@example.com"))

	def test_has_student_role(self):
		self.assertIsNotNone(has_student_role("student1@example.com"))
		self.assertIsNotNone(has_student_role("student2@example.com"))

	def test_is_certified(self):
		frappe.session.user = self.student1.email
		self.assertIsNotNone(is_certified(self.course.name))
		frappe.session.user = self.student2.email
		self.assertIsNone(is_certified(self.course.name))
		frappe.session.user = "Administrator"

	def test_rating_validation(self):
		student3 = self.create_user("student3@example.com", "Emily", "Cooper", ["LMS Student"])
		with self.assertRaises(frappe.exceptions.ValidationError):
			self.add_rating(self.course.name, student3.email, -0.5, "Bad course")
		frappe.session.user = "Administrator"
		frappe.delete_doc("User", student3.email)

	def test_get_evaluator(self):
		evaluator_email = get_evaluator(self.course.name, self.batch.name)
		self.assertEqual(evaluator_email, self.evaluator.evaluator)

	def tearDown(self):
		if frappe.db.exists("LMS Batch", self.batch.name):
			frappe.delete_doc("LMS Batch", self.batch.name)

		if frappe.db.exists("LMS Course", self.course.name):
			frappe.db.delete("LMS Certificate", {"course": self.course.name})
			frappe.db.delete("LMS Enrollment", {"course": self.course.name})
			frappe.db.delete("LMS Course Review", {"course": self.course.name})
			frappe.db.delete("Course Lesson", {"course": self.course.name})
			frappe.db.delete("Course Chapter", {"course": self.course.name})
			frappe.db.delete("Course Instructor", {"parent": self.course.name})
			frappe.delete_doc("LMS Course", self.course.name)

		frappe.delete_doc("Course Evaluator", self.evaluator.name)
		frappe.delete_doc("User", "student1@example.com")
		frappe.delete_doc("User", "student2@example.com")
		frappe.delete_doc("User", "frappe@example.com")
