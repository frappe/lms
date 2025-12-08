import unittest

import frappe

from .utils import (
	get_average_rating,
	get_chapters,
	get_instructors,
	get_lesson_index,
	get_lessons,
	get_membership,
	get_reviews,
	get_tags,
	slugify,
)


class TestUtils(unittest.TestCase):
	def setUp(self):
		self.student1 = self.create_user("student1@example.com", "Ashley", "Smith", "LMS Student")
		self.student2 = self.create_user("student2@example.com", "John", "Doe", "LMS Student")
		self.admin = self.create_user("frappe@example.com", "Frappe", "Admin", "Moderator")

		self.create_a_course()
		self.add_chapters()
		self.add_lessons()

		self.add_enrollment(self.course.name, self.student1.email)
		self.add_enrollment(self.course.name, self.student2.email)

		self.add_rating(self.course.name, self.student1.email, 0.8, "Good course")
		self.add_rating(self.course.name, self.student2.email, 1, "Excellent course")

	def create_a_course(self):
		course = frappe.new_doc("LMS Course")
		course.title = "Utility Course"
		course.short_introduction = "A course to test utilities of Frappe Learning"
		course.description = "This is a detailed description of the Utility Course."
		course.tags = "Frappe,Learning,Utility"
		course.published = 1
		course.append("instructors", {"instructor": "frappe@example.com"})
		course.save()
		self.course = course

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

	def create_user(self, email, first_name, last_name, role):
		if not frappe.db.exists("User", email):
			student = frappe.new_doc("User")
			student.email = email
			student.first_name = first_name
			student.last_name = last_name
			student.user_type = "Website User"
			student.append("roles", {"role": role})
			student.save()
			return student
		else:
			return frappe.get_doc("User", email)

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

	def tearDown(self):
		if frappe.db.exists("LMS Course", self.course.name):
			frappe.db.delete("LMS Enrollment", {"course": self.course.name})
			frappe.db.delete("LMS Course Review", {"course": self.course.name})
			frappe.db.delete("Course Lesson", {"course": self.course.name})
			frappe.db.delete("Course Chapter", {"course": self.course.name})
			frappe.delete_doc("LMS Course", self.course.name)

		frappe.delete_doc("User", "student1@example.com")
		frappe.delete_doc("User", "student2@example.com")
		frappe.delete_doc("User", "frappe@example.com")
