import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_discussion_replies, get_discussion_topics


class TestDiscussionReadPermission(BaseTestUtils):
	"""The discussion endpoints read with frappe.get_all, so a role whose read on
	Discussion Topic / Discussion Reply was removed must be refused here too, not
	only hidden in the UI (#2538)."""

	def setUp(self):
		super().setUp()
		instructor = self._create_user(
			f"discperm-instructor-{frappe.generate_hash(length=6)}@example.com",
			"Disc",
			"Instructor",
			["Course Creator"],
		)
		course = self._create_course(
			title=f"Discussion Perm {frappe.generate_hash(length=6)}", instructor=instructor.name
		)
		chapter = self._create_chapter("Discussion Perm Chapter", course.name)
		self.lesson = self._create_lesson("Discussion Perm Lesson", chapter.name, course.name)
		self.student = self._create_user(
			f"discperm-{frappe.generate_hash(length=6)}@example.com",
			"Disc",
			"Perm",
			["LMS Student"],
		)
		self._create_enrollment(self.student.name, course.name)

	def _create_topic(self):
		return (
			frappe.get_doc(
				{
					"doctype": "Discussion Topic",
					"title": "Question",
					"reference_doctype": "Course Lesson",
					"reference_docname": self.lesson.name,
				}
			)
			.insert()
			.name
		)

	def _drop_student_role(self):
		frappe.get_doc("User", self.student.name).remove_roles("LMS Student")

	def test_enrolled_student_reads_topics_and_replies(self):
		"""Control: an enrolled student still reads both (lms#2538)."""
		frappe.set_user(self.student.name)
		self.assertEqual(get_discussion_topics("Course Lesson", self.lesson.name), [])
		frappe.set_user("Administrator")
		topic = self._create_topic()
		frappe.set_user(self.student.name)
		self.assertEqual(get_discussion_replies(topic), [])

	def test_enrolled_user_without_topic_read_is_refused(self):
		"""get_discussion_topics ignored a revoked Discussion Topic read. Added for lms#2538."""
		self._drop_student_role()
		frappe.set_user(self.student.name)
		self.assertFalse(frappe.has_permission("Discussion Topic", "read"))
		with self.assertRaises(frappe.PermissionError):
			get_discussion_topics("Course Lesson", self.lesson.name)

	def test_enrolled_user_without_reply_read_is_refused(self):
		"""get_discussion_replies ignored a revoked Discussion Reply read. Added for lms#2538."""
		topic = self._create_topic()
		self._drop_student_role()
		frappe.set_user(self.student.name)
		with self.assertRaises(frappe.PermissionError):
			get_discussion_replies(topic)
