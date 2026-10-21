# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""A discussion reply notifies only the mentioned users who take part in that course
or batch and accept mentions, up to a fixed number per reply."""

from unittest.mock import patch

import frappe

from lms.lms import utils
from lms.lms.test_helpers import BaseTestUtils


def mention(user):
	return f'<span class="mention" data-id="{user}">@{user}</span>'


class TestDiscussionMentionScope(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.hash = hash = frappe.generate_hash(length=6)
		cls.author = cls._create_user(f"dms-author-{hash}@example.com", "Dms", "Author", ["Course Creator"])
		cls.poster = cls._create_user(f"dms-poster-{hash}@example.com", "Dms", "Poster", ["LMS Student"])
		cls.peer = cls._create_user(f"dms-peer-{hash}@example.com", "Dms", "Peer", ["LMS Student"])
		cls.muted = cls._create_user(f"dms-muted-{hash}@example.com", "Dms", "Muted", ["LMS Student"])
		cls.outsider = cls._create_user(f"dms-out-{hash}@example.com", "Dms", "Out", ["LMS Student"])
		frappe.db.set_value("User", cls.muted.name, "allowed_in_mentions", 0)

		cls.course = cls._create_course(f"Mention Scope {hash}", instructor=cls.author.name)
		chapter = cls._create_chapter(f"Mention Scope {hash} chapter", cls.course.name)
		cls._create_chapter_reference(cls.course.name, chapter.name)
		cls.lesson = cls._create_lesson(f"Mention Scope {hash} lesson", chapter.name, cls.course.name)
		cls._create_lesson_reference(chapter.name, cls.lesson.name)
		for user in (cls.poster, cls.peer, cls.muted):
			cls._create_enrollment(user.name, cls.course.name)

		topic = frappe.get_doc(
			{
				"doctype": "Discussion Topic",
				"title": cls.lesson.name,
				"reference_doctype": "Course Lesson",
				"reference_docname": cls.lesson.name,
			}
		)
		topic.name = frappe.generate_hash(length=10)
		topic.db_insert()
		cls.topic = topic.name

	def reply_as(self, user, html):
		frappe.set_user(user)
		try:
			return frappe.get_doc(
				{"doctype": "Discussion Reply", "topic": self.topic, "reply": html}
			).insert()
		finally:
			frappe.set_user("Administrator")

	def mentioned(self, users):
		return set(
			frappe.get_all(
				"Notification Log",
				{
					"type": "Mention",
					"document_name": self.lesson.name,
					"for_user": ("in", [user.name for user in users]),
				},
				pluck="for_user",
			)
		)

	def test_only_participants_who_accept_mentions_are_notified(self):
		self.reply_as(
			self.poster.name,
			mention(self.peer.name)
			+ mention(self.muted.name)
			+ mention(self.outsider.name)
			+ mention(self.author.name),
		)

		self.assertEqual(
			self.mentioned([self.peer, self.muted, self.outsider, self.author]),
			{self.peer.name, self.author.name},
		)

	def test_mentions_past_the_cap_are_ignored(self):
		cap = utils.MAX_MENTIONS_PER_REPLY
		crowd = [
			self._create_user(f"dms-crowd{i}-{self.hash}@example.com", "Dms", f"Crowd{i}", ["LMS Student"])
			for i in range(cap + 2)
		]
		for user in crowd:
			self._create_enrollment(user.name, self.course.name)

		self.reply_as(self.poster.name, "".join(mention(user.name) for user in crowd))

		self.assertEqual(self.mentioned(crowd), {user.name for user in crowd[:cap]})

	def test_mention_emails_go_only_to_participants(self):
		reply = frappe._dict(
			owner=self.poster.name, reply=mention(self.peer.name) + mention(self.outsider.name)
		)
		topic = frappe._dict(reference_doctype="Course Lesson", reference_docname=self.lesson.name)
		with (
			patch.object(utils.frappe, "get_cached_value", return_value="Outgoing"),
			patch.dict(utils.frappe.conf, {"mail_login": "lms@example.com"}),
			patch.object(utils.frappe, "sendmail") as sendmail,
		):
			utils.notify_mentions_via_email(reply, topic)

		self.assertEqual([call.kwargs["recipients"] for call in sendmail.call_args_list], [self.peer.email])
