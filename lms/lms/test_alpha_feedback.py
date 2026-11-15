import frappe

from lms.lms.ai import goals
from lms.lms.ai.api import session_state, submit_alpha_feedback
from lms.lms.test_helpers import BaseTestUtils


class TestAlphaFeedback(BaseTestUtils):
	"""What a tester tells the team at the end of a skill: their own, once, readable by the team."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.learner = self._create_user(
			"alpha.learner@example.com", "Alpha", "Learner", roles=["LMS Student"]
		)
		self.other = self._create_user("alpha.other@example.com", "Alpha", "Other", roles=["LMS Student"])
		self.moderator = self._create_user(
			"alpha.moderator@example.com", "Alpha", "Moderator", roles=["Moderator"]
		)
		goal = goals.create_goal("Alpha feedback skill", "Say what you think of learning this way")
		frappe.db.set_value("LMS Goal", goal, "status", "Published")
		self.assignment = frappe.get_doc(
			{"doctype": "LMS Goal Assignment", "goal": goal, "member": self.learner.name}
		).insert()
		self.assignment.db_set("status", "Ready")

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def test_a_learner_sends_answers_once_and_can_change_them(self):
		frappe.set_user(self.learner.name)
		self.assertFalse(session_state(self.assignment.name)["feedback_given"])

		submit_alpha_feedback(
			self.assignment.name,
			{"future": "Yes, this is it", "teaching": 5, "words": "Keep the role-play."},
		)
		submit_alpha_feedback(self.assignment.name, {"future": "Right idea, rough edges", "voices": 3})

		rows = frappe.get_all(
			"LMS Alpha Feedback",
			{"assignment": self.assignment.name},
			["member", "goal", "future", "teaching", "voices", "words"],
		)
		self.assertEqual(len(rows), 1)
		row = rows[0]
		self.assertEqual(row.member, self.learner.name)
		self.assertEqual(row.goal, self.assignment.goal)
		self.assertEqual(row.future, "Right idea, rough edges")
		self.assertEqual((row.teaching, row.voices), (5, 3))
		self.assertEqual(row.words, "Keep the role-play.")
		self.assertTrue(session_state(self.assignment.name)["feedback_given"])

	def test_someone_else_cannot_answer_for_the_learner(self):
		frappe.set_user(self.other.name)
		self.assertRaises(
			frappe.PermissionError, submit_alpha_feedback, self.assignment.name, {"future": "Not sure yet"}
		)
		self.assertFalse(frappe.db.exists("LMS Alpha Feedback", {"assignment": self.assignment.name}))

	def test_an_unfinished_skill_takes_no_feedback(self):
		self.assignment.db_set("status", "In Progress")
		frappe.set_user(self.learner.name)
		self.assertRaises(
			frappe.ValidationError, submit_alpha_feedback, self.assignment.name, {"future": "Yes, this is it"}
		)
		self.assertFalse(session_state(self.assignment.name)["feedback_given"])

	def test_fields_the_doctype_does_not_have_are_ignored(self):
		frappe.set_user(self.learner.name)
		submit_alpha_feedback(self.assignment.name, {"compared": "Better", "member": self.other.name, "extra": 1})
		row = frappe.db.get_value(
			"LMS Alpha Feedback", {"assignment": self.assignment.name}, ["member", "compared"], as_dict=True
		)
		self.assertEqual((row.member, row.compared), (self.learner.name, "Better"))

	def test_a_score_outside_one_to_five_is_refused(self):
		frappe.set_user(self.learner.name)
		self.assertRaises(
			frappe.ValidationError, submit_alpha_feedback, self.assignment.name, {"roleplay": 9}
		)

	def test_the_team_reads_it_and_the_learner_does_not(self):
		frappe.set_user(self.learner.name)
		submit_alpha_feedback(self.assignment.name, {"compared": "Better"})
		name = frappe.db.get_value("LMS Alpha Feedback", {"assignment": self.assignment.name})

		self.assertFalse(frappe.has_permission("LMS Alpha Feedback", "read", name))
		frappe.set_user(self.moderator.name)
		self.assertTrue(frappe.has_permission("LMS Alpha Feedback", "read", name))
