from unittest.mock import patch

import frappe

from lms.copilot import proposals, tools
from lms.copilot.access import learner_ref
from lms.copilot.proposals import LessonQuiz
from lms.tests.copilot.utils import CopilotTestCase


class TestProposals(CopilotTestCase):
	def _propose_quiz(self, user=None):
		self.as_user(user or self.instructor)
		return tools.call("propose_lesson_quiz", {"lesson": self.lesson.name, "quiz": self.quiz_payload()})

	def test_write_tool_only_drafts_until_approved(self):
		quizzes_before = frappe.db.count("LMS Quiz")
		content_before = self.lesson_content()

		result = self._propose_quiz()

		self.assertEqual(result["status"], "Pending")
		self.assertEqual(frappe.db.count("LMS Quiz"), quizzes_before)
		self.assertEqual(self.lesson_content(), content_before)
		proposal = frappe.get_doc("Copilot Proposal", result["proposal"])
		self.assertEqual(proposal.requested_via, "Teacher")
		self.assertTrue(proposal.source_hash)
		self.assertTrue(any(line["op"] == "add" for line in frappe.parse_json(proposal.preview)["lines"]))

	def test_approval_applies_and_verifies_as_reviewer(self):
		proposal = self._propose_quiz()["proposal"]

		result = proposals.approve(proposal)

		self.assertEqual(result["status"], "Applied")
		quiz = result["result"]["quiz"]
		self.cleanup_items.append(("LMS Quiz", quiz))
		self.assertTrue(frappe.db.exists("LMS Quiz", quiz))
		self.assertIn(quiz, self.lesson_content())
		doc = frappe.get_doc("Copilot Proposal", proposal)
		self.assertEqual(doc.reviewed_by, self.instructor.email)
		self.assertTrue(
			frappe.db.exists("Copilot Tool Log", {"proposal": proposal, "is_write": 1, "status": "Success"})
		)

	def test_engine_drafts_but_cannot_approve(self):
		proposal = self._propose_quiz(self.engine)["proposal"]
		self.assertEqual(frappe.db.get_value("Copilot Proposal", proposal, "requested_via"), "AI Engine")

		with self.assertRaises(frappe.PermissionError):
			proposals.approve(proposal)
		self.assertEqual(frappe.db.get_value("Copilot Proposal", proposal, "status"), "Pending")

	def test_teacher_of_another_course_cannot_propose_or_approve(self):
		with self.assertRaises(frappe.PermissionError):
			self._propose_quiz(self.outsider)

		proposal = self._propose_quiz()["proposal"]
		self.as_user(self.outsider)
		with self.assertRaises(frappe.PermissionError):
			proposals.approve(proposal)

	def test_changed_lesson_expires_instead_of_overwriting(self):
		self.as_user(self.instructor)
		proposal = tools.call(
			"propose_lesson_change",
			{"lesson": self.lesson.name, "markdown": "### Ví dụ: quên dependency", "reason": "Báo cáo tuần"},
		)["proposal"]
		frappe.set_user("Administrator")
		lesson = frappe.get_doc("Course Lesson", self.lesson.name)
		content = frappe.parse_json(lesson.content)
		content["blocks"][2]["data"]["text"] = "Someone else edited this."
		lesson.content = frappe.as_json(content)
		lesson.save()

		self.as_user(self.instructor)
		result = proposals.approve(proposal)

		self.assertEqual(result["status"], "Expired")
		self.assertNotIn("### Ví dụ: quên dependency", self.lesson_texts())

	def test_reviewer_edits_are_applied_but_cannot_retarget(self):
		self.as_user(self.instructor)
		proposal = tools.call(
			"propose_lesson_change",
			{"lesson": self.lesson.name, "markdown": "Bản nháp của AI", "after_block": "h1"},
		)["proposal"]
		frappe.set_user("Administrator")
		other = self._create_lesson(f"Other {self.suffix}", self.chapter.name, self.course.name)
		self.as_user(self.instructor)

		result = proposals.approve(
			proposal, params={"lesson": other.name, "mode": "append", "markdown": "Bản giáo viên sửa"}
		)

		self.assertEqual(result["status"], "Applied")
		self.assertIn("Bản giáo viên sửa", self.lesson_texts())
		self.assertNotIn("Bản nháp của AI", self.lesson_texts())
		self.assertNotIn("Bản giáo viên sửa", self.lesson_texts(other.name))

	def test_failed_verification_rolls_back(self):
		quizzes_before = frappe.db.count("LMS Quiz")
		proposal = self._propose_quiz()["proposal"]

		with patch.object(LessonQuiz, "verify", return_value=False):
			result = proposals.approve(proposal)

		self.assertEqual(result["status"], "Failed")
		self.assertEqual(frappe.db.count("LMS Quiz"), quizzes_before)
		self.assertNotIn('"quiz"', self.lesson_content())

	def test_reject_and_closed_proposals_stay_closed(self):
		proposal = self._propose_quiz()["proposal"]
		self.assertEqual(proposals.reject(proposal, note="Không cần")["status"], "Rejected")
		with self.assertRaises(frappe.ValidationError):
			proposals.approve(proposal)

	def test_escalation_reply_notifies_learner(self):
		self.as_user(self.learner)
		proposal = tools.call(
			"escalate_to_teacher",
			{"course": self.course.name, "question": "Em có được nộp muộn vì ốm không ạ?"},
		)["proposal"]

		self.as_user(self.instructor)
		with self.assertRaises(frappe.ValidationError):
			proposals.approve(proposal)
		result = proposals.approve(proposal, params={"reply": "Được, em nộp trước thứ Sáu nhé."})

		self.assertEqual(result["status"], "Applied")
		self.assertTrue(
			frappe.db.exists(
				"Notification Log",
				{"for_user": self.learner.email, "email_content": "Được, em nộp trước thứ Sáu nhé."},
			)
		)

	def test_reminder_uses_pseudonyms_and_rejects_unknown_learners(self):
		self.as_user(self.instructor)
		with self.assertRaises(frappe.ValidationError):
			tools.call(
				"propose_learner_reminder",
				{
					"course": self.course.name,
					"learners": [learner_ref(self.stranger.email)],
					"message": "Nộp bài nhé",
				},
			)
		proposal = tools.call(
			"propose_learner_reminder",
			{
				"course": self.course.name,
				"learners": [learner_ref(self.learner.email)],
				"message": "Nộp bài 3 nhé",
			},
		)["proposal"]
		self.assertNotIn(self.learner.email, frappe.db.get_value("Copilot Proposal", proposal, "params"))

		result = proposals.approve(proposal)

		self.assertEqual(result["result"]["count"], 1)
		self.assertTrue(
			frappe.db.exists(
				"Notification Log", {"for_user": self.learner.email, "email_content": "Nộp bài 3 nhé"}
			)
		)

	def test_every_applied_write_has_an_approver(self):
		"""The pilot metric: writes without approval must be zero."""
		self._propose_quiz()
		proposal = self._propose_quiz()["proposal"]
		proposals.approve(proposal)
		self.cleanup_items.append(
			(
				"LMS Quiz",
				frappe.parse_json(frappe.db.get_value("Copilot Proposal", proposal, "result"))["quiz"],
			)
		)

		applied = frappe.get_all(
			"Copilot Proposal",
			filters={"status": "Applied", "creation": [">=", self.started]},
			fields=["reviewed_by"],
		)
		self.assertTrue(applied)
		self.assertTrue(all(row.reviewed_by for row in applied))
