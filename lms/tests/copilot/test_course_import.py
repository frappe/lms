import html
import io
import zipfile
from unittest.mock import patch

import frappe

from lms.copilot import course_import, proposals, tools
from lms.tests.copilot.utils import CopilotTestCase

SYLLABUS = """# Giáo trình Python cơ bản

Giới thiệu khóa học cho người mới.

## Biến và kiểu dữ liệu

Biến lưu giá trị. Kiểu int, float, str, bool.

## Vòng lặp for

Dùng for để duyệt danh sách: for x in ds: print(x)

## Bài tập: tính tổng chi tiêu

Viết hàm tinh_tong nhận danh sách khoản chi và trả về tổng.
Tiêu chí chấm: đúng kết quả, đặt tên rõ ràng.
"""


def _docx(paragraphs):
	body = "".join(
		f'<w:p><w:pPr><w:pStyle w:val="{style}"/></w:pPr><w:r><w:t>{text}</w:t></w:r></w:p>'
		if style
		else f"<w:p><w:r><w:t>{text}</w:t></w:r></w:p>"
		for style, text in paragraphs
	)
	xml = (
		'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
		f"<w:body>{body}</w:body></w:document>"
	)
	buffer = io.BytesIO()
	with zipfile.ZipFile(buffer, "w") as archive:
		archive.writestr("word/document.xml", xml)
	return buffer.getvalue()


def _pptx(slides):
	buffer = io.BytesIO()
	with zipfile.ZipFile(buffer, "w") as archive:
		for number, lines in enumerate(slides, 1):
			paragraphs = "".join(f"<a:p><a:r><a:t>{line}</a:t></a:r></a:p>" for line in lines)
			archive.writestr(
				f"ppt/slides/slide{number}.xml",
				'<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
				'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
				f"<p:cSld><p:spTree><p:sp><p:txBody>{paragraphs}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>",
			)
	return buffer.getvalue()


class TestExtraction(CopilotTestCase):
	def test_markdown_is_split_at_headings(self):
		pages = course_import.extract_text(SYLLABUS)
		self.assertEqual([page["page"] for page in pages], [1, 2, 3, 4])
		self.assertIn("Vòng lặp for", pages[2]["text"])

	def test_docx_sections_start_at_headings(self):
		pages = course_import.extract_docx(
			_docx([("Heading1", "Chương 1"), (None, "Biến"), ("Heading1", "Chương 2"), (None, "Vòng lặp")])
		)
		self.assertEqual(len(pages), 2)
		self.assertTrue(pages[1]["text"].startswith("# Chương 2"))

	def test_pptx_has_one_page_per_slide_in_order(self):
		content = _pptx([["Slide một"], ["Slide hai", "ý phụ"]] + [[f"Slide {n}"] for n in range(3, 11)])
		pages = course_import.extract_pptx(content)
		self.assertEqual(len(pages), 10)
		self.assertEqual(pages[1]["text"], "Slide hai\ný phụ")
		self.assertEqual(pages[9]["text"], "Slide 10")


class TestCourseImport(CopilotTestCase):
	def setUp(self):
		super().setUp()
		self.as_user(self.instructor)
		self.file = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": f"giao-trinh-{self.suffix}.md",
				"content": SYLLABUS,
				"is_private": 1,
			}
		).insert()
		self.created = []

	def tearDown(self):
		frappe.set_user("Administrator")
		for course in self.created:
			for assignment in frappe.get_all("LMS Assignment", filters={"course": course}, pluck="name"):
				for rubric in frappe.get_all("Copilot Rubric", filters={"assignment": assignment}, pluck="name"):
					frappe.delete_doc("Copilot Rubric", rubric, force=True, ignore_permissions=True)
				frappe.delete_doc("LMS Assignment", assignment, force=True, ignore_permissions=True)
			for doctype in ("Course Lesson", "Course Chapter"):
				for name in frappe.get_all(doctype, filters={"course": course}, pluck="name"):
					frappe.delete_doc(doctype, name, force=True, ignore_permissions=True)
			frappe.delete_doc("LMS Course", course, force=True, ignore_permissions=True)
		frappe.delete_doc("File", self.file.name, force=True, ignore_permissions=True)
		super().tearDown()

	def _import(self):
		self.as_user(self.instructor)
		with patch("lms.copilot.gateway.enqueue_course_import", return_value=True) as enqueue:
			result = course_import.create_import(
				"Python cơ bản", [self.file.file_url], "Thêm một bài về xử lý ngoại lệ."
			)
		enqueue.assert_called_once_with(result["name"])
		return result

	def _draft(self, name):
		return {
			"course_import": name,
			"short_introduction": "Khóa Python cho người mới.",
			"description": "Dành cho người chưa biết lập trình.",
			"chapters": [
				{
					"title": "Nền tảng",
					"lessons": [
						{"title": "Biến", "markdown": "## Biến\nBiến lưu giá trị.", "sources": [{"source": "S1", "pages": [2]}]},
						{"title": "Vòng lặp", "markdown": "## for\nDuyệt danh sách.", "sources": [{"source": "S1", "pages": [3, 99]}]},
					],
				},
				{
					"title": "Nâng cao",
					"lessons": [
						{"title": "Ngoại lệ", "markdown": "## try/except", "sources": [{"source": "S7", "pages": [1]}]},
					],
				},
			],
			"assignments": [
				{
					"title": "Tính tổng chi tiêu",
					"question": "Viết hàm `tinh_tong`.",
					"after_lesson": "2.1",
					"sources": [{"source": "S1", "pages": [4]}],
					"rubric": {
						"criteria": [
							{"criterion": "Đúng kết quả", "max_level": 3, "taught_in_lesson": "1.2"},
							{"criterion": "Đặt tên rõ ràng", "taught_in_lesson": "2.1"},
						]
					},
				}
			],
		}

	def _propose(self):
		imported = self._import()
		self.as_user(self.engine)
		sources = tools.call("get_import_sources", {"course_import": imported["name"]})
		self.assertEqual(sources["sources"][0]["source"], "S1")
		self.assertEqual(len(sources["sources"][0]["pages"]), 4)
		result = tools.call("propose_course_draft", self._draft(imported["name"]))
		return imported["name"], result["proposal"]

	def test_upload_extracts_pages_and_queues(self):
		imported = self._import()
		self.assertEqual(imported["status"], "Queued")
		self.assertEqual(imported["sources"][0]["pages"], 4)
		self.assertEqual(imported["sources"][0]["unit"], "section")

	def test_draft_creates_nothing_and_flags_missing_material(self):
		courses_before = frappe.db.count("LMS Course")
		name, proposal = self._propose()

		self.assertEqual(frappe.db.count("LMS Course"), courses_before)
		self.assertEqual(frappe.db.get_value("Copilot Course Import", name, ["status", "proposal"]), ("Ready", proposal))
		doc = frappe.get_doc("Copilot Proposal", proposal)
		self.assertEqual(doc.proposal_type, "Course Draft")
		params = frappe.parse_json(doc.params)
		lessons = [lesson for chapter in params["chapters"] for lesson in chapter["lessons"]]
		# Page 99 does not exist and S7 is not a source: citations are dropped, never trusted.
		self.assertEqual(lessons[1]["sources"], [{"source": "S1", "page": 3}])
		self.assertEqual([lesson["missing_material"] for lesson in lessons], [False, False, True])
		self.assertEqual(frappe.parse_json(doc.preview)["missing"], 1)

	def test_plain_approval_is_blocked_while_lessons_lack_material(self):
		_name, proposal = self._propose()
		self.as_user(self.instructor)
		with self.assertRaises(frappe.ValidationError):
			proposals.approve(proposal)
		self.assertEqual(frappe.db.get_value("Copilot Proposal", proposal, "status"), "Pending")

	def test_approval_keeps_missing_lessons_marked(self):
		name, proposal = self._propose()
		self.as_user(self.instructor)
		result = proposals.approve(proposal, params={"missing_lessons": "keep"})

		self.assertEqual(result["status"], "Applied", result.get("error"))
		course = result["result"]["course"]
		self.created.append(course)
		self.assertEqual(frappe.db.get_value("LMS Course", course, "published"), 0)
		self.assertEqual(frappe.db.get_value("Copilot Course Import", name, "course"), course)
		self.assertEqual(result["result"]["lessons"], 3)
		instructors = frappe.get_all("Course Instructor", filters={"parent": course}, pluck="instructor")
		self.assertEqual(instructors, [self.instructor.email])

		missing = frappe.db.get_value("Course Lesson", {"course": course, "title": "Ngoại lệ"}, ["content", "instructor_notes"], as_dict=True)
		# LMS stores markdown HTML-escaped (sanitize_editorjs); the SPA decodes it before rendering.
		first_block = html.unescape(frappe.parse_json(missing.content)["blocks"][0]["data"]["text"])
		self.assertTrue(first_block.startswith("> ⚠️"))
		self.assertIn(
			frappe._("Missing material: this lesson was not drafted from your documents."), missing.instructor_notes
		)
		sourced = frappe.db.get_value("Course Lesson", {"course": course, "title": "Vòng lặp"}, "instructor_notes")
		self.assertIn(self.file.file_name, sourced)

		assignment = result["result"]["assignments"][0]
		host = frappe.db.get_value("Course Lesson", {"course": course, "title": "Ngoại lệ"}, "content")
		self.assertIn(assignment, host)
		rubric = frappe.get_doc("Copilot Rubric", {"assignment": assignment})
		taught = {row.criterion: row.taught_in_lesson for row in rubric.criteria}
		self.assertEqual(
			frappe.db.get_value("Course Lesson", taught["Đúng kết quả"], "title"), "Vòng lặp"
		)

	def test_dropping_missing_lessons_moves_their_assignment(self):
		_name, proposal = self._propose()
		self.as_user(self.instructor)
		result = proposals.approve(proposal, params={"missing_lessons": "drop"})

		self.assertEqual(result["status"], "Applied", result.get("error"))
		course = result["result"]["course"]
		self.created.append(course)
		self.assertEqual(result["result"]["lessons"], 2)
		self.assertEqual(result["result"]["chapters"], 1)
		host = frappe.db.get_value("Course Lesson", {"course": course, "title": "Vòng lặp"}, "content")
		self.assertIn(result["result"]["assignments"][0], host)

	def test_other_teachers_cannot_read_or_approve(self):
		name, proposal = self._propose()
		self.as_user(self.outsider)
		with self.assertRaises(frappe.PermissionError):
			course_import.get_import(name)
		with self.assertRaises(frappe.PermissionError):
			proposals.approve(proposal, params={"missing_lessons": "keep"})

	def test_engine_cannot_approve_its_own_draft(self):
		_name, proposal = self._propose()
		with self.assertRaises(frappe.PermissionError):
			proposals.approve(proposal, params={"missing_lessons": "keep"})

	def test_teachers_upload_markdown_privately_but_not_other_types(self):
		self.as_user(self.instructor)
		result = course_import.upload_source(f"bai-tap-{self.suffix}.md", SYLLABUS.encode())
		file = frappe.get_doc("File", {"file_url": result["file_url"]})
		self.assertEqual((file.is_private, file.owner), (1, self.instructor.email))
		frappe.delete_doc("File", file.name, force=True, ignore_permissions=True)
		with self.assertRaises(frappe.ValidationError):
			course_import.upload_source("script.exe", b"MZ")
		self.as_user(self.learner)
		with self.assertRaises(frappe.PermissionError):
			course_import.upload_source("notes.md", b"# hi")

	def test_learner_cannot_import(self):
		self.as_user(self.learner)
		with self.assertRaises(frappe.PermissionError):
			course_import.create_import("X", [self.file.file_url])
