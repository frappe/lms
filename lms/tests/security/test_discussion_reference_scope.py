# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""Only lessons and batches carry discussions. A topic or reply filed under any
other record is closed to everyone, staff included."""

import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import can_access_topic, get_discussion_topics


class TestDiscussionReferenceScope(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.moderator = cls._create_user(f"drs-mod-{hash}@example.com", "Mo", "Derator", ["Moderator"]).name
		cls.student = cls._create_user(f"drs-stud-{hash}@example.com", "St", "Udent", ["LMS Student"]).name
		instructor = cls._create_user(f"drs-instr-{hash}@example.com", "In", "Str", ["Course Creator"]).name
		cls.course = cls._create_course(title=f"Reference Course {hash}", instructor=instructor).name
		chapter = cls._create_chapter(f"Chapter {hash}", cls.course).name
		cls.lesson = cls._create_lesson(f"Lesson {hash}", chapter, cls.course).name
		cls._create_enrollment(cls.student, cls.course)
		cls.course_topic = cls._topic("LMS Course", cls.course)
		cls.lesson_topic = cls._topic("Course Lesson", cls.lesson)

	@classmethod
	def _topic(cls, doctype, docname):
		return (
			frappe.get_doc(
				{
					"doctype": "Discussion Topic",
					"title": docname,
					"reference_doctype": doctype,
					"reference_docname": docname,
				}
			)
			.insert()
			.name
		)

	def _reply(self, topic):
		return frappe.get_doc({"doctype": "Discussion Reply", "topic": topic, "reply": "A reply"}).insert()

	def test_a_topic_under_any_other_record_is_closed(self):
		for user in (self.moderator, self.student):
			with self.subTest(user=user):
				frappe.set_user(user)
				self.assertFalse(can_access_topic("LMS Course", self.course))
				with self.assertRaises(frappe.ValidationError):
					get_discussion_topics("LMS Course", self.course)

	def test_a_reply_under_any_other_record_is_refused(self):
		for user in (self.moderator, self.student):
			with self.subTest(user=user):
				frappe.set_user(user)
				with self.assertRaises(frappe.PermissionError):
					self._reply(self.course_topic)

	def test_a_reply_under_a_lesson_still_posts(self):
		frappe.set_user(self.student)
		self.assertTrue(can_access_topic("Course Lesson", self.lesson))
		self.assertEqual(self._reply(self.lesson_topic).topic, self.lesson_topic)
