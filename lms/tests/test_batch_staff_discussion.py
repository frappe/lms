from unittest.mock import patch

import frappe

from lms.lms.test_helpers import BaseTestUtils


class TestBatchStaffDiscussion(BaseTestUtils):
	"""A batch's own instructor posts in its discussion without being enrolled in it."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		country_patch = patch("lms.lms.utils.get_country_code", return_value=None)
		country_patch.start()
		cls.addClassCleanup(country_patch.stop)

		hash = frappe.generate_hash(length=6)
		cls.instructor = cls._create_user(
			f"disc-instr-{hash}@example.com", "Ida", "Instr", ["Course Creator"]
		).name
		cls.other_creator = cls._create_user(
			f"disc-ocreator-{hash}@example.com", "Oc", "Creator", ["Course Creator"]
		).name
		evaluator = cls._create_user(f"disc-eval-{hash}@example.com", "Eve", "Eval", ["Batch Evaluator"]).name
		cls._require_no_moderators(cls.instructor, cls.other_creator)
		course = cls._create_course(f"Discussion {hash}", instructor=cls.instructor).name
		cls._create_evaluator(evaluator)
		cls.batch = cls._create_batch(
			course, instructor=cls.instructor, title=f"Discussion Batch {hash}", evaluator=evaluator
		).name
		topic = frappe.get_doc(
			{
				"doctype": "Discussion Topic",
				"title": cls.batch,
				"reference_doctype": "LMS Batch",
				"reference_docname": cls.batch,
			}
		).insert(ignore_permissions=True)
		cls.topic = topic.name

	def _reply_as(self, user):
		frappe.set_user(user)
		try:
			return frappe.get_doc(
				{"doctype": "Discussion Reply", "topic": self.topic, "reply": "<p>Hello class</p>"}
			).insert()
		finally:
			frappe.set_user("Administrator")

	def test_the_batch_instructor_posts_a_reply(self):
		self.assertTrue(self._reply_as(self.instructor).name)

	def test_an_instructor_of_another_batch_is_refused(self):
		with self.assertRaises(frappe.ValidationError):
			self._reply_as(self.other_creator)
