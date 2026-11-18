# Copyright (c) 2026, Frappe and Contributors
# See license.txt

"""Discussion text is sanitised by LMS, not left to frappe (ticket 68647).

Released frappe returns JSON-shaped strings from sanitize_html untouched, so a reply
like `{"a":"<img onerror=...>"}` was stored raw and mailed out in notifications.
"""

from unittest.mock import patch

import frappe

from lms.lms.test_helpers import BaseTestUtils, released_frappe_sanitizer, released_sanitize_html
from lms.lms.utils import create_notification_log, notify_mentions_on_portal

JSON_SHAPED_XSS = '{"a":"<img src=x onerror=alert(1)>"}'


class TestDiscussionTextSanitised(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.moderator = cls._create_user(f"dts-mod-{hash}@example.com", "Mo", "Derator", ["Moderator"]).name
		cls.instructor = cls._create_user(
			f"dts-instr-{hash}@example.com", "In", "Str", ["Course Creator"]
		).name
		course = cls._create_course(title=f"DTS Course {hash}", instructor=cls.instructor).name
		chapter = cls._create_chapter(f"DTS Chapter {hash}", course).name
		cls.lesson = cls._create_lesson(f"DTS Lesson {hash}", chapter, course).name

	def _topic(self, title="A question"):
		return frappe.get_doc(
			{
				"doctype": "Discussion Topic",
				"title": title,
				"reference_doctype": "Course Lesson",
				"reference_docname": self.lesson,
			}
		).insert()

	def _stored_reply(self, reply):
		frappe.set_user(self.moderator)
		with released_frappe_sanitizer():
			topic = self._topic()
			doc = frappe.get_doc(
				{"doctype": "Discussion Reply", "topic": topic.name, "reply": reply}
			).insert()
		return frappe.db.get_value("Discussion Reply", doc.name, "reply")

	def _stored_title(self, title):
		frappe.set_user(self.moderator)
		with released_frappe_sanitizer():
			topic = self._topic(title)
		return frappe.db.get_value("Discussion Topic", topic.name, "title")

	def test_the_payload_passes_released_frappe_unsanitised(self):
		self.assertEqual(released_sanitize_html(JSON_SHAPED_XSS), JSON_SHAPED_XSS)

	def test_a_json_shaped_reply_is_sanitised(self):
		stored = self._stored_reply(JSON_SHAPED_XSS)
		self.assertNotIn("onerror", stored)
		self.assertIn("<img", stored)

	def test_a_plain_reply_is_stored_as_written(self):
		self.assertEqual(self._stored_reply("<p>Tom &amp; Jerry</p>"), "<p>Tom &amp; Jerry</p>")

	def test_a_topic_title_is_stored_as_typed(self):
		"""Titles are plain text shown verbatim; they are escaped where they meet HTML."""
		# LMS leaves the title alone; what frappe's own Data-field sanitiser does to
		# markup differs by frappe version and is not pinned here.
		self.assertEqual(self._stored_title("Tom & Jerry: 5 > 3"), "Tom & Jerry: 5 > 3")

	def _subjects(self, notify, title):
		frappe.set_user(self.moderator)
		with released_frappe_sanitizer():
			topic = self._topic(title)
		topic_row = frappe._dict(
			title=topic.title,
			owner=topic.owner,
			reference_doctype=topic.reference_doctype,
			reference_docname=topic.reference_docname,
		)
		reply = frappe._dict(owner=self.instructor, reply="<p>hi</p>")
		with (
			patch("lms.lms.utils.make_notification_logs") as make_logs,
			patch("lms.lms.utils.get_mention_recipients", return_value=[self.moderator]),
		):
			notify(reply, topic_row)
		return [call.args[0].subject for call in make_logs.call_args_list]

	def test_the_reply_notification_escapes_the_topic_title(self):
		subjects = self._subjects(create_notification_log, JSON_SHAPED_XSS)
		self.assertTrue(subjects)
		for subject in subjects:
			self.assertNotIn("<img", subject)
			self.assertIn("&lt;img", subject)

	def test_the_mention_notification_escapes_the_topic_title(self):
		subjects = self._subjects(notify_mentions_on_portal, JSON_SHAPED_XSS)
		self.assertTrue(subjects)
		for subject in subjects:
			self.assertNotIn("<img", subject)
			self.assertIn("&lt;img", subject)
