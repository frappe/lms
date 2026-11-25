import frappe

from lms.lms.doctype.course_lesson.course_lesson import save_progress
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.user import on_login


class TestLoginUserCase(BaseTestUtils):
	"""Frappe v15/v16's email-link login keeps the email as typed, so a session can carry
	`Learner@…` for the stored user `learner@…`."""

	def setUp(self):
		super().setUp()
		self._create_user("frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"])
		suffix = frappe.generate_hash(length=8)
		self.student = self._create_user(f"case-{suffix}@example.com", "Case", "Student", ["LMS Student"])
		self.course = self._create_course(title=f"Case Course {suffix}")
		chapter = self._create_chapter(f"Case Chapter {suffix}", self.course.name)
		self._create_chapter_reference(self.course.name, chapter.name)
		self.lesson = self._create_lesson(f"Case Lesson {suffix}", chapter.name, self.course.name)
		self._create_lesson_reference(chapter.name, self.lesson.name)
		self._create_enrollment(self.student.name, self.course.name)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def test_login_uses_the_stored_user_name(self):
		login_manager = frappe._dict(user=self.student.name.capitalize())

		on_login(login_manager)

		self.assertEqual(login_manager.user, self.student.name)

	def test_progress_saves_after_logging_in_with_a_capitalised_email(self):
		login_manager = frappe._dict(user=self.student.name.capitalize())
		on_login(login_manager)
		frappe.set_user(login_manager.user)

		save_progress(self.lesson.name, self.course.name)

		self.assertTrue(
			frappe.db.exists("LMS Course Progress", {"member": self.student.name, "lesson": self.lesson.name})
		)
