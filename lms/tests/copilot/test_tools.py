import frappe

from lms.copilot import conversations, insights, tools
from lms.copilot.setup import AI_ENGINE_ROLE, after_install
from lms.tests.copilot.utils import CopilotTestCase

TEACHER_ONLY = {
	"get_learner_progress",
	"propose_lesson_quiz",
	"propose_lesson_change",
	"propose_feedback",
	"propose_rubric",
}


class TestToolAccess(CopilotTestCase):
	def test_learner_agent_never_sees_teacher_tools(self):
		self.as_user(self.learner)
		names = {tool["name"] for tool in tools.catalog()}
		self.assertIn("search_course_content", names)
		self.assertIn("escalate_to_teacher", names)
		self.assertFalse(names & TEACHER_ONLY)

		self.as_user(self.instructor)
		self.assertTrue(TEACHER_ONLY <= {tool["name"] for tool in tools.catalog()})

	def test_denied_call_is_logged(self):
		self.as_user(self.learner)
		with self.assertRaises(frappe.PermissionError):
			tools.call("propose_lesson_quiz", {"lesson": self.lesson.name, "quiz": self.quiz_payload()})
		frappe.set_user("Administrator")
		self.assertTrue(
			frappe.db.exists(
				"Copilot Tool Log",
				{"tool": "propose_lesson_quiz", "user": self.learner.email, "status": "Denied"},
			)
		)

	def test_unknown_arguments_are_rejected(self):
		self.as_user(self.instructor)
		with self.assertRaises(frappe.ValidationError):
			tools.call("get_course_outline", {"course": self.course.name, "ignore_permissions": True})

	def test_successful_call_logs_model_and_tokens(self):
		self.as_user(self.learner)
		tools.call(
			"get_course_outline",
			{"course": self.course.name},
			model="small-model",
			tokens_in=120,
			tokens_out=40,
		)
		log = frappe.get_last_doc(
			"Copilot Tool Log", filters={"tool": "get_course_outline", "user": self.learner.email}
		)
		self.assertEqual(
			(log.status, log.model, log.tokens_in, log.tokens_out), ("Success", "small-model", 120, 40)
		)

	def test_install_grants_the_engine_role_no_permissions(self):
		"""Custom DocPerm rows replace a DocType's standard permissions; the app must add none."""
		before = frappe.db.count("Custom DocPerm", {"role": AI_ENGINE_ROLE})
		after_install()
		self.assertTrue(frappe.db.exists("Role", AI_ENGINE_ROLE))
		self.assertEqual(frappe.db.count("Custom DocPerm", {"role": AI_ENGINE_ROLE}), before)


class TestReadTools(CopilotTestCase):
	def test_learner_must_be_enrolled(self):
		self.as_user(self.stranger)
		with self.assertRaises(frappe.PermissionError):
			tools.call("get_lesson_content", {"lesson": self.lesson.name})

	def test_lesson_content_is_split_into_citable_blocks(self):
		self.as_user(self.learner)
		lesson = tools.call("get_lesson_content", {"lesson": self.lesson.name})
		self.assertEqual([section["block_id"] for section in lesson["sections"]], ["h1", "p1", "m1"])
		self.assertEqual(lesson["sections"][1]["heading"], "Mảng dependency")
		self.assertNotIn("<b>", lesson["sections"][1]["text"])
		self.assertNotIn("instructor_notes", lesson)

	def test_search_matches_without_diacritics_and_cites_the_block(self):
		self.as_user(self.learner)
		results = tools.call(
			"search_course_content", {"course": self.course.name, "query": "mang dependency render"}
		)["results"]
		self.assertEqual(results[0]["block_id"], "p1")
		self.assertEqual(results[0]["lesson"], self.lesson.name)
		self.assertIn("Mảng dependency", results[0]["citation"])

	def test_outline_follows_chapter_order(self):
		self.as_user(self.learner)
		outline = tools.call("get_course_outline", {"course": self.course.name})
		self.assertEqual(outline["chapters"][0]["lessons"][0]["lesson"], self.lesson.name)

	def test_progress_uses_pseudonyms(self):
		self.as_user(self.instructor)
		progress = tools.call("get_learner_progress", {"course": self.course.name})
		self.assertNotIn(self.learner.email, frappe.as_json(progress))
		self.assertTrue(progress["learners"][0]["learner"].startswith("L-"))


class TestConversations(CopilotTestCase):
	def test_turns_are_logged_and_rated_by_their_owner(self):
		self.as_user(self.learner)
		turn = tools.call(
			"log_conversation_turn",
			{
				"course": self.course.name,
				"lesson": self.lesson.name,
				"question": "Sao app gọi API liên tục?",
				"answer": "Xem lại mảng dependency.",
				"citations": [{"lesson": self.lesson.name, "block_id": "p1", "label": "Mảng dependency"}],
			},
		)
		rating = conversations.rate_answer(turn["conversation"], turn["message_index"], False)
		self.assertEqual(rating["helpful"], "Not Helpful")

		self.as_user(self.stranger)
		with self.assertRaises(frappe.PermissionError):
			conversations.rate_answer(turn["conversation"], turn["message_index"], True)

		self.as_user(self.instructor)
		signals = insights.gather_weekly_signals(self.course.name)
		self.assertEqual(signals["stats"]["questions"], 1)
		self.assertEqual(len(signals["not_helpful_answers"]), 1)
		self.assertNotIn(self.learner.email, frappe.as_json(signals))

		saved = insights.save_weekly_insight(
			self.course.name,
			[
				{
					"title": "useEffect thiếu dependency",
					"lesson": self.lesson.name,
					"learners": 1,
					"count": 1,
					"summary": "Gọi API lặp.",
				}
			],
		)
		self.assertEqual(insights.get_weekly_insight(self.course.name)["name"], saved["name"])
