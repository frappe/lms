import frappe

from lms.lms.ai import goals
from lms.lms.api import fetch_activity_dates, get_streak_info
from lms.lms.test_helpers import BaseTestUtils


class TestStreakCountsSkills(BaseTestUtils):
	"""A day spent in a skill with Lumi keeps the streak alive like a course lesson does."""

	def test_finishing_a_skill_part_today_starts_the_streak(self):
		frappe.set_user("Administrator")
		learner = self._create_user("streak.skill@example.com", "Streak", "Skill", roles=["LMS Student"])
		goal = goals.create_goal("Streak skill", "Leave the building calmly")
		assignment = frappe.get_doc(
			{"doctype": "LMS Goal Assignment", "goal": goal, "member": learner.name}
		).insert()

		frappe.set_user(learner.name)
		self.assertEqual(get_streak_info()["current_streak"], 0)

		frappe.get_doc(
			{
				"doctype": "LMS Goal Evidence",
				"assignment": assignment.name,
				"goal": goal,
				"member": learner.name,
				"activity_index": 0,
				"activity_type": "Lesson",
				"activity_title": "What to do when the alarm sounds",
				"status": "Graded",
				"passed": 1,
			}
		).insert(ignore_permissions=True)

		today = frappe.utils.getdate()
		self.assertIn(today, [frappe.utils.getdate(d) for d in fetch_activity_dates(learner.name)])
		# Streaks skip weekends, so the count itself is only checkable on a weekday.
		if today.weekday() < 5:
			self.assertEqual(get_streak_info()["current_streak"], 1)

	def test_a_preview_of_a_draft_is_not_learning(self):
		frappe.set_user("Administrator")
		admin = self._create_user("streak.admin@example.com", "Streak", "Admin", roles=["Moderator"])
		goal = goals.create_goal("Preview skill", "Leave calmly")
		assignment = frappe.get_doc(
			{"doctype": "LMS Goal Assignment", "goal": goal, "member": admin.name, "is_preview": 1}
		).insert()
		frappe.get_doc(
			{
				"doctype": "LMS Goal Evidence",
				"assignment": assignment.name,
				"goal": goal,
				"member": admin.name,
				"activity_index": 0,
				"activity_type": "Lesson",
				"activity_title": "Preview lesson",
				"status": "Graded",
				"passed": 1,
			}
		).insert(ignore_permissions=True)
		today = frappe.utils.getdate()
		self.assertNotIn(today, [frappe.utils.getdate(d) for d in fetch_activity_dates(admin.name)])
