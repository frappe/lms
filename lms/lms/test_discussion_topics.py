# Copyright (c) 2026, Frappe and Contributors
# See license.txt

import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_discussion_topics


class TestDiscussionTopics(BaseTestUtils):
	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6)
		# A Moderator may read any batch's discussions, so the batch itself
		# need not exist for this.
		self.user = self._create_user(f"topics-mod-{hash}@example.com", "Mo", "Mod", ["Moderator"]).name
		self.batch = f"batch-{hash}"

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _insert(self, doctype, **fields):
		doc = frappe.get_doc({"doctype": doctype, **fields})
		doc.name = frappe.generate_hash(length=10)
		doc.db_insert()
		return doc.name

	def test_counts_the_answers_under_each_question(self):
		answered = self._insert(
			"Discussion Topic", title="Answered", reference_doctype="LMS Batch", reference_docname=self.batch
		)
		unanswered = self._insert(
			"Discussion Topic",
			title="Unanswered",
			reference_doctype="LMS Batch",
			reference_docname=self.batch,
		)
		# The first reply is the question itself; the rest are answers.
		for text in ("The question", "First answer", "Second answer"):
			self._insert("Discussion Reply", topic=answered, reply=text)
		self._insert("Discussion Reply", topic=unanswered, reply="The question")

		frappe.set_user(self.user)
		topics = {topic.name: topic for topic in get_discussion_topics("LMS Batch", self.batch)}

		self.assertEqual(topics[answered].reply_count, 2)
		self.assertEqual(topics[unanswered].reply_count, 0)
