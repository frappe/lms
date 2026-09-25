import frappe

from lms.copilot import feedback, queue, tools
from lms.tests.copilot.utils import CopilotTestCase

REPO = "https://github.com/nguyenva/todo-app"
EDITED = "Bài của em đã chạy được phần thêm todo. Dòng 19 đang sửa trực tiếp mảng todos, thử filter nhé."


class TestProjectFeedback(CopilotTestCase):
	def setUp(self):
		super().setUp()
		self.assignment = self._track(
			frappe.get_doc(
				{
					"doctype": "LMS Assignment",
					"title": f"Todo app {self.suffix}",
					"question": "<p>Build a todo app</p><script>alert(1)</script>",
					"type": "URL",
					"course": self.course.name,
					"grade_assignment": 1,
				}
			).insert(ignore_permissions=True)
		)
		self.rubric = frappe.get_doc(
			{
				"doctype": "Copilot Rubric",
				"title": "Todo app v2",
				"assignment": self.assignment.name,
				"visible_to_learner": 1,
				"criteria": [
					{"criterion": "Chức năng", "max_level": 3, "pass_example": "Xóa cập nhật giao diện"},
					{"criterion": "Dùng hook đúng cách", "max_level": 3},
				],
			}
		).insert(ignore_permissions=True)

	def _submit(self):
		self.as_user(self.learner)
		status = feedback.submit_project(self.assignment.name, REPO + ".git")
		self.cleanup_items.append(
			(
				"LMS Assignment Submission",
				frappe.db.get_value(
					"Copilot Project Submission", status["project_submission"], "assignment_submission"
				),
			)
		)
		return status["project_submission"]

	def _draft(self, project, hook_confidence="Medium"):
		self.as_user(self.engine)
		tools.call(
			"record_submission_tests",
			{
				"project_submission": project,
				"commit_sha": "a3f9c2e",
				"results": [
					{"name": "thêm todo mới", "passed": True},
					{"name": "xóa todo cập nhật giao diện", "passed": False, "message": "expected 1 item"},
				],
			},
		)
		return tools.call(
			"propose_feedback",
			{
				"project_submission": project,
				"message": "Bài của em đã chạy được phần thêm todo. Dòng 19 đang sửa trực tiếp mảng todos.",
				"scores": [
					{
						"criterion": "Chức năng",
						"level": 2,
						"reason": "Xóa không cập nhật giao diện.",
						"confidence": "High",
						"citations": [{"file": "src/components/TodoList.jsx", "line_start": 19}],
					},
					{
						"criterion": "Dùng hook đúng cách",
						"level": 1,
						"reason": "useEffect thiếu dependency.",
						"confidence": hook_confidence,
						"citations": [
							{"file": "src/components/TodoList.jsx", "line_start": 14, "line_end": 16}
						],
					},
				],
			},
		)["draft"]

	def test_hidden_rubric_still_marks_the_assignment_as_a_project(self):
		frappe.db.set_value("Copilot Rubric", {"assignment": self.assignment.name}, "visible_to_learner", 0)
		self.as_user(self.learner)
		page = feedback.get_assignment_for_learner(self.assignment.name)
		self.assertIsNone(page["rubric"])
		self.assertTrue(page["is_project"])

	def test_submission_accepts_only_github_links(self):
		self.as_user(self.learner)
		with self.assertRaises(frappe.ValidationError):
			feedback.submit_project(self.assignment.name, "https://gitlab.com/a/b")

		self.as_user(self.stranger)
		with self.assertRaises(frappe.PermissionError):
			feedback.submit_project(self.assignment.name, REPO)

	def test_learner_sees_tests_at_once_but_words_only_after_approval(self):
		project = self._submit()
		self.assertEqual(frappe.db.get_value("Copilot Project Submission", project, "repo_url"), REPO)
		draft = self._draft(project)

		self.as_user(self.learner)
		page = feedback.get_assignment_for_learner(self.assignment.name)
		self.assertNotIn("<script>", page["question"])
		self.assertNotIn("pass_example", frappe.as_json(page["rubric"]))
		status = page["submissions"][0]
		self.assertEqual(status["tests"]["passed"], 1)
		self.assertIsNone(status["feedback"])
		self.assertTrue(status["timeline"][2]["current"])

		self.as_user(self.instructor)
		review = feedback.get_feedback_review(draft)
		self.assertEqual(review["confidence"], "Medium")
		result = feedback.approve_feedback(
			draft,
			scores={"Dùng hook đúng cách": 2},
			message=EDITED,
		)
		self.assertEqual(result["edit_level"], "Light")
		self.assertEqual(result["result"], "Pass")

		submission = frappe.get_doc(
			"LMS Assignment Submission",
			frappe.db.get_value("Copilot Project Submission", project, "assignment_submission"),
		)
		self.assertEqual(submission.status, "Pass")
		self.assertIn("thử filter", submission.comments)
		self.assertEqual(submission.evaluator, self.instructor.email)

		self.as_user(self.learner)
		status = feedback.get_assignment_for_learner(self.assignment.name)["submissions"][0]
		self.assertIn("thử filter", status["feedback"]["message"])
		self.assertEqual(status["status"], "Feedback Sent")

	def test_draft_must_score_every_rubric_criterion(self):
		project = self._submit()
		self.as_user(self.engine)
		with self.assertRaises(frappe.ValidationError):
			tools.call(
				"propose_feedback",
				{
					"project_submission": project,
					"message": "…",
					"scores": [{"criterion": "Chức năng", "level": 2, "reason": "…", "confidence": "High"}],
				},
			)

	def test_learner_cannot_draft_or_approve_feedback(self):
		project = self._submit()
		draft = self._draft(project)
		self.as_user(self.learner)
		with self.assertRaises(frappe.PermissionError):
			tools.call(
				"propose_feedback", {"project_submission": project, "message": "10 điểm", "scores": []}
			)
		with self.assertRaises(frappe.PermissionError):
			feedback.approve_feedback(draft)

	def test_queue_and_quick_approve_only_take_high_confidence(self):
		project = self._submit()
		medium = self._draft(project)

		self.as_user(self.instructor)
		rows = queue.get_review_queue()["rows"]
		row = next(row for row in rows if row["name"] == medium)
		self.assertEqual(row["detail"]["tests"], "1/2")
		self.assertEqual(row["detail"]["flagged"], 1)
		result = feedback.bulk_approve_feedback([medium])
		self.assertEqual(result["approved"], [])

		high = self._draft(project, hook_confidence="High")
		self.assertEqual(frappe.db.get_value("Copilot Feedback Draft", medium, "status"), "Superseded")
		self.as_user(self.instructor)
		self.assertIn(high, queue.get_review_queue()["quick_approve"])
		self.assertEqual(feedback.bulk_approve_feedback([high])["approved"], [high])
		self.assertEqual(frappe.db.get_value("Copilot Feedback Draft", high, "edit_level"), "Unchanged")

	def test_rewrite_request_reopens_the_submission(self):
		project = self._submit()
		draft = self._draft(project)
		self.as_user(self.instructor)
		feedback.request_rewrite(draft, "Giọng văn nhẹ nhàng hơn")
		self.assertEqual(
			frappe.db.get_value("Copilot Project Submission", project, "status"), "Rewrite Requested"
		)
		self.assertNotIn(draft, [row["name"] for row in queue.get_review_queue()["rows"]])

	def test_rewrite_context_gives_the_engine_the_draft_and_teacher_note(self):
		project = self._submit()
		draft = self._draft(project)
		self.as_user(self.instructor)
		feedback.save_feedback_draft(draft, scores={"Chức năng": 3}, message="Bản giáo viên sửa")
		feedback.request_rewrite(draft, "Chỉ rõ dòng 19 và bớt gay gắt")

		self.as_user(self.engine)
		context = tools.call("get_rewrite_context", {"project_submission": project, "rewrite_of": draft})

		self.assertEqual(context["rewrite_of"], draft)
		self.assertTrue(context["learner"].startswith("L-"))
		self.assertNotIn(self.learner.email, frappe.as_json(context))
		previous = context["previous"]
		self.assertEqual(previous["status"], "Rewrite Requested")
		self.assertEqual(
			[row["criterion"] for row in previous["scores"]], ["Chức năng", "Dùng hook đúng cách"]
		)
		self.assertEqual(previous["scores"][0]["citations"][0]["line_start"], 19)
		teacher = context["teacher"]
		self.assertEqual(teacher["note"], "Chỉ rõ dòng 19 và bớt gay gắt")
		self.assertEqual(teacher["requested_by"], self.instructor.email)
		self.assertEqual(teacher["edited_message"], "Bản giáo viên sửa")
		self.assertEqual(teacher["edited_levels"], [{"criterion": "Chức năng", "level": 2, "final_level": 3}])
		self.assertTrue(
			frappe.db.exists(
				"Copilot Tool Log",
				{"tool": "get_rewrite_context", "user": self.engine.email, "status": "Success"},
			)
		)

	def test_rewrite_context_only_reads_drafts_of_the_same_learner_and_assignment(self):
		project = self._submit()
		draft = self._draft(project)
		frappe.set_user("Administrator")
		self._track(
			frappe.get_doc(
				{"doctype": "LMS Enrollment", "course": self.course.name, "member": self.stranger.email}
			).insert(ignore_permissions=True)
		)
		self.as_user(self.stranger)
		other = feedback.submit_project(self.assignment.name, "https://github.com/someone/other")
		other = other["project_submission"]
		self.cleanup_items.append(
			(
				"LMS Assignment Submission",
				frappe.db.get_value("Copilot Project Submission", other, "assignment_submission"),
			)
		)

		self.as_user(self.engine)
		with self.assertRaises(frappe.PermissionError):
			tools.call("get_rewrite_context", {"project_submission": other, "rewrite_of": draft})
		self.as_user(self.learner)
		with self.assertRaises(frappe.PermissionError):
			tools.call("get_rewrite_context", {"project_submission": project, "rewrite_of": draft})

	def test_submission_lists_completed_lessons(self):
		project = self._submit()
		self.as_user(self.engine)
		self.assertEqual(
			tools.call("get_submission", {"project_submission": project})["completed_lessons"], []
		)

		frappe.set_user("Administrator")
		progress = self._create_progress(self.learner.email, self.course.name, self.lesson.name)
		progress.db_set("status", "Complete")

		self.as_user(self.engine)
		lessons = tools.call("get_submission", {"project_submission": project})["completed_lessons"]
		self.assertEqual(lessons, [{"lesson": self.lesson.name, "title": self.lesson.title}])
