from unittest.mock import patch

import frappe

from lms.lms.ai import goals
from lms.lms.test_helpers import BaseTestUtils


class TestPublishAudience(BaseTestUtils):
	"""A new skill is for everyone who learns here unless the admin narrows it, and publishing
	to a crowd does not make the admin wait for every row."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.learner = self._create_user("audience.one@example.com", "Audience", "One", roles=["LMS Student"])

	def _skill(self, title: str, **values) -> str:
		name = goals.create_goal(title, "Know the code of conduct")
		goal = frappe.get_doc("LMS Goal", name)
		goal.update(values)
		goal.append("activities", {"activity_type": "Lesson", "title": "The code", "content": "{}"})
		goal.save()
		return name

	def test_a_new_skill_is_open_to_everyone(self):
		goal = frappe.get_doc("LMS Goal", goals.create_goal("Audience default", "Know the code"))
		self.assertTrue(goal.assign_everyone)

	def test_open_to_everyone_shows_in_the_list_without_enrolling_anyone(self):
		from lms.lms.ai.api import learner_skills

		name = self._skill("Audience open", assign_everyone=1)
		self.assertEqual(goals.publish(name), 0)
		self.assertEqual(frappe.db.get_value("LMS Goal", name, "status"), "Published")
		self.assertFalse(frappe.db.exists("LMS Goal Assignment", {"goal": name, "is_preview": 0}))

		frappe.set_user(self.learner.name)
		rows = {row["name"]: row for row in learner_skills()}
		self.assertIn(name, rows)
		self.assertFalse(rows[name]["enrolled"])

	def test_publishing_sends_it_once_and_a_second_publish_sends_nothing(self):
		name = self._skill("Audience publish", assign_everyone=0, audience=[{"user": self.learner.name}])
		self.assertEqual(goals.publish(name), 1)
		self.assertTrue(frappe.db.exists("LMS Goal Assignment", {"goal": name, "member": self.learner.name}))
		self.assertEqual(frappe.db.get_value("LMS Goal", name, "status"), "Published")
		self.assertEqual(goals.publish(name), 0)

	def test_a_large_audience_goes_to_one_background_job(self):
		name = self._skill("Audience large", assign_everyone=0, audience=[{"user": self.learner.name}])
		with patch.object(goals, "FAN_OUT_INLINE", 0), patch.object(frappe, "enqueue") as enqueue:
			sent = goals.publish(name)
		enqueue.assert_called_once()
		kwargs = enqueue.call_args.kwargs
		self.assertEqual(sent, len(kwargs["members"]))
		self.assertEqual(kwargs["job_id"], f"lms-goal-publish-{name}")
		self.assertTrue(kwargs["deduplicate"])
		self.assertTrue(kwargs["in_job"])
		self.assertEqual(frappe.db.get_value("LMS Goal", name, "status"), "Published")
		self.assertFalse(frappe.db.exists("LMS Goal Assignment", {"goal": name, "is_preview": 0}))

	def test_the_job_skips_a_person_it_cannot_send_to_and_keeps_going(self):
		name = self._skill("Audience resilient", assign_everyone=0)
		other = self._create_user("audience.two@example.com", "Audience", "Two", roles=["LMS Student"])
		goal = frappe.get_doc("LMS Goal", name)

		def notify(goal_doc, member):
			if member == self.learner.name:
				raise ValueError("bad address")

		with (
			patch.object(goals, "_notify", notify),
			patch.object(frappe.db, "commit"),
			patch.object(frappe.db, "rollback"),
		):
			goals._send_to(goal.name, [self.learner.name, other.name], in_job=True)
		self.assertTrue(frappe.db.exists("LMS Goal Assignment", {"goal": name, "member": other.name}))
