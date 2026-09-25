import frappe

from lms.copilot import proposals, read_tools, tools
from lms.tests.copilot.utils import CopilotTestCase


class TestRubricProposal(CopilotTestCase):
	def setUp(self):
		super().setUp()
		self.assignment = self._track(
			frappe.get_doc(
				{
					"doctype": "LMS Assignment",
					"title": f"Chi tiêu {self.suffix}",
					"question": "<p>Ứng dụng quản lý chi tiêu dòng lệnh</p>",
					"type": "URL",
					"course": self.course.name,
					"grade_assignment": 1,
				}
			).insert(ignore_permissions=True)
		)

	def criteria(self, *names):
		names = names or ("Chạy đúng chức năng chính", "Xử lý lỗi đầu vào")
		return [
			{
				"criterion": name,
				"description": f"Mô tả {name}",
				"max_level": 3,
				"points": 2,
				"levels": "1: chưa đạt\n2: đạt một phần\n3: đạt",
				"taught_in_lesson": self.lesson.name,
				"pass_example": "Nhập 'abc' thì báo lỗi và hỏi lại",
				"fail_example": "Chương trình dừng với ValueError",
			}
			for name in names
		]

	def propose(self, user=None, **extra):
		self.as_user(user or self.instructor)
		return tools.call(
			"propose_rubric", {"assignment": self.assignment.name, "criteria": self.criteria(), **extra}
		)

	def rubric_names(self):
		return frappe.get_all("Copilot Rubric", filters={"assignment": self.assignment.name}, pluck="name")

	def test_proposal_drafts_without_creating_a_rubric(self):
		result = self.propose()

		self.assertEqual(result["status"], "Pending")
		self.assertEqual(self.rubric_names(), [])
		doc = frappe.get_doc("Copilot Proposal", result["proposal"])
		self.assertEqual(doc.proposal_type, "Rubric")
		self.assertEqual(doc.reference_doctype, "LMS Assignment")
		self.assertTrue(doc.source_hash)
		lines = frappe.parse_json(doc.preview)["lines"]
		self.assertTrue(any("Xử lý lỗi đầu vào" in line["text"] for line in lines if line["op"] == "add"))

	def test_approval_creates_rubric_with_all_fields(self):
		proposal = self.propose()["proposal"]

		result = proposals.approve(proposal)

		self.assertEqual(result["status"], "Applied", result.get("error"))
		rubric = frappe.get_doc("Copilot Rubric", result["result"]["rubric"])
		self.assertEqual(rubric.assignment, self.assignment.name)
		self.assertEqual(rubric.course, self.course.name)
		self.assertEqual(len(rubric.criteria), 2)
		row = rubric.criteria[1]
		self.assertEqual(row.taught_in_lesson, self.lesson.name)
		self.assertEqual(row.points, 2)
		self.assertIn("2: đạt một phần", row.levels)
		served = read_tools.serialise_rubric(rubric, for_learner=True)
		self.assertNotIn("pass_example", served["criteria"][0])
		self.assertEqual(served["criteria"][0]["taught_in_lesson"], self.lesson.name)

	def test_approval_replaces_the_existing_rubric(self):
		first = proposals.approve(self.propose()["proposal"])["result"]["rubric"]
		self.as_user(self.instructor)
		proposal = tools.call(
			"propose_rubric",
			{"assignment": self.assignment.name, "criteria": self.criteria("Đặt tên & trình bày")},
		)["proposal"]

		result = proposals.approve(proposal)

		self.assertEqual(result["status"], "Applied", result.get("error"))
		self.assertEqual(self.rubric_names(), [first])
		rubric = frappe.get_doc("Copilot Rubric", first)
		self.assertEqual([row.criterion for row in rubric.criteria], ["Đặt tên & trình bày"])

	def test_rubric_changed_after_proposal_expires_it(self):
		proposal = self.propose()["proposal"]
		frappe.set_user("Administrator")
		frappe.get_doc(
			{
				"doctype": "Copilot Rubric",
				"title": "Rubric tay",
				"assignment": self.assignment.name,
				"criteria": [{"criterion": "Giáo viên tự viết", "max_level": 3}],
			}
		).insert(ignore_permissions=True)

		self.as_user(self.instructor)
		result = proposals.approve(proposal)

		self.assertEqual(result["status"], "Expired")
		rubric = read_tools.rubric_for_assignment(self.assignment.name)
		self.assertEqual([row.criterion for row in rubric.criteria], ["Giáo viên tự viết"])

	def test_engine_drafts_but_only_course_teachers_approve(self):
		proposal = self.propose(self.engine)["proposal"]
		self.assertEqual(frappe.db.get_value("Copilot Proposal", proposal, "requested_via"), "AI Engine")

		with self.assertRaises(frappe.PermissionError):
			proposals.approve(proposal)
		self.as_user(self.outsider)
		with self.assertRaises(frappe.PermissionError):
			proposals.approve(proposal)
		self.assertEqual(self.rubric_names(), [])

	def test_outsiders_and_learners_cannot_propose(self):
		with self.assertRaises(frappe.PermissionError):
			self.propose(self.outsider)
		with self.assertRaises(frappe.PermissionError):
			self.propose(self.learner)

	def test_invalid_criteria_are_rejected(self):
		self.as_user(self.instructor)
		for criteria in (
			[],
			self.criteria("Trùng", "Trùng"),
			[{"criterion": "Mức", "max_level": 0}],
			[{"criterion": "Điểm", "points": -1}],
		):
			with self.assertRaises(frappe.ValidationError):
				tools.call("propose_rubric", {"assignment": self.assignment.name, "criteria": criteria})

		frappe.set_user("Administrator")
		other_course = self._create_course(title=f"Other {self.suffix}", instructor=self.instructor.email)
		other_chapter = self._create_chapter(f"Other {self.suffix}", other_course.name)
		other_lesson = self._create_lesson(f"Other {self.suffix}", other_chapter.name, other_course.name)
		self.as_user(self.instructor)
		with self.assertRaises(frappe.ValidationError):
			tools.call(
				"propose_rubric",
				{
					"assignment": self.assignment.name,
					"criteria": [{"criterion": "Bài khác", "taught_in_lesson": other_lesson.name}],
				},
			)

	def test_reviewer_edits_cannot_retarget_the_assignment(self):
		proposal = self.propose()["proposal"]
		frappe.set_user("Administrator")
		other = self._track(
			frappe.get_doc(
				{
					"doctype": "LMS Assignment",
					"title": f"Khác {self.suffix}",
					"question": "<p>x</p>",
					"type": "URL",
					"course": self.course.name,
				}
			).insert(ignore_permissions=True)
		)
		self.as_user(self.instructor)

		result = proposals.approve(
			proposal,
			params={"assignment": other.name, "criteria": self.criteria("Tách hàm, cấu trúc code")},
		)

		self.assertEqual(result["status"], "Applied", result.get("error"))
		self.assertEqual(frappe.get_all("Copilot Rubric", filters={"assignment": other.name}), [])
		rubric = read_tools.rubric_for_assignment(self.assignment.name)
		self.assertEqual([row.criterion for row in rubric.criteria], ["Tách hàm, cấu trúc code"])
