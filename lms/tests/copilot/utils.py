import frappe
from lms.lms.test_helpers import BaseTestUtils

from lms.copilot.setup import AI_ENGINE_ROLE, ensure_roles


class CopilotTestCase(BaseTestUtils):
	"""A course with one instructor, one outsider teacher, one learner and the engine."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		ensure_roles()
		suffix = frappe.generate_hash(length=8)
		self.suffix = suffix
		self.instructor = self._create_user(
			f"copilot-instructor-{suffix}@example.com", "Ins", "Tructor", ["Course Creator"]
		)
		self.outsider = self._create_user(
			f"copilot-outsider-{suffix}@example.com", "Out", "Sider", ["Course Creator"]
		)
		self.learner = self._create_user(
			f"copilot-learner-{suffix}@example.com", "Lea", "Rner", ["LMS Student"]
		)
		self.stranger = self._create_user(
			f"copilot-stranger-{suffix}@example.com", "Str", "Anger", ["LMS Student"]
		)
		self.engine = self._create_user(
			f"copilot-engine-{suffix}@example.com", "AI", "Engine", [AI_ENGINE_ROLE], user_type="System User"
		)
		self.course = self._create_course(title=f"Copilot Course {suffix}", instructor=self.instructor.email)
		self.chapter = self._create_chapter(f"Hooks {suffix}", self.course.name)
		content = frappe.as_json(
			{
				"blocks": [
					{"id": "h1", "type": "header", "data": {"text": "Mảng dependency", "level": 2}},
					{
						"id": "p1",
						"type": "paragraph",
						"data": {
							"text": "Khi không có mảng dependency, <b>useEffect</b> chạy sau mỗi lần render."
						},
					},
					{"id": "m1", "type": "markdown", "data": {"text": "Dọn dẹp effect bằng hàm return."}},
				],
				"version": "2.29.0",
			}
		)
		self.lesson = self._create_lesson(
			f"useEffect {suffix}", self.chapter.name, self.course.name, content=content
		)
		self._track(
			frappe.get_doc(
				{
					"doctype": "Lesson Reference",
					"lesson": self.lesson.name,
					"parent": self.chapter.name,
					"parenttype": "Course Chapter",
					"parentfield": "lessons",
					"idx": 1,
				}
			).insert(ignore_permissions=True)
		)
		self._track(
			frappe.get_doc(
				{
					"doctype": "Chapter Reference",
					"chapter": self.chapter.name,
					"parent": self.course.name,
					"parenttype": "LMS Course",
					"parentfield": "chapters",
					"idx": 1,
				}
			).insert(ignore_permissions=True)
		)
		self.enrollment = self._track(
			frappe.get_doc(
				{"doctype": "LMS Enrollment", "course": self.course.name, "member": self.learner.email}
			).insert(ignore_permissions=True)
		)

	def tearDown(self):
		frappe.set_user("Administrator")
		for doctype in (
			"Copilot Tool Log",
			"Copilot Proposal",
			"Copilot Feedback Draft",
			"Copilot Project Submission",
			"Copilot Rubric",
			"Copilot Conversation",
			"Copilot Weekly Insight",
			"Copilot Course Import",
		):
			for name in frappe.get_all(doctype, filters={"creation": [">=", self.started]}, pluck="name"):
				frappe.delete_doc(doctype, name, force=True, ignore_permissions=True)
		super().tearDown()

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.started = frappe.utils.now_datetime()

	def _track(self, doc):
		self.cleanup_items.append((doc.doctype, doc.name))
		return doc

	def as_user(self, user):
		frappe.set_user(user.email if hasattr(user, "email") else user)

	def lesson_content(self):
		return frappe.db.get_value("Course Lesson", self.lesson.name, "content")

	def lesson_texts(self, lesson=None):
		content = frappe.db.get_value("Course Lesson", lesson or self.lesson.name, "content")
		return [
			block.get("data", {}).get("text")
			for block in frappe.parse_json(content or "{}").get("blocks", [])
		]

	def quiz_payload(self):
		return {
			"title": f"Quiz {frappe.generate_hash(length=6)}",
			"passing_percentage": 75,
			"questions": [
				{
					"text": "Khi nào effect chạy lại?",
					"type": "multiple_choice",
					"marks": 2,
					"options": [
						{"text": "Khi dependency đổi", "is_correct": True},
						{"text": "Không bao giờ", "is_correct": False},
					],
				},
				{"text": "Tên hook cho side effect?", "type": "short_answer", "answers": ["useEffect"]},
			],
		}
