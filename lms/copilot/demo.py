"""Demo data for the review screens: ``bench --site <site> execute lms.copilot.demo.seed``.

Creates the "Python cơ bản" course from the competition dossier: four short lessons,
the final project "ứng dụng quản lý chi tiêu dòng lệnh" with a five-criterion rubric,
six adult learners whose submissions sit in different review states, a lesson-change
proposal and an escalated question. Every course it creates carries DEMO_TAG and
``lms.copilot.demo.clear`` removes it again, together with the demo learners.

Seeding never calls the AI Gateway: review jobs are not enqueued, test results and
feedback drafts are written directly. The repositories live under a GitHub owner that
does not exist (``copilot-demo-learner``); the Copilot demo notes describe the
planted mistakes so matching public repos can be created later.
"""

from unittest.mock import patch

import frappe

from lms.copilot import feedback, proposals
from lms.copilot.content import terms

DEMO_TAG = "copilot-demo"
COURSE_TITLE = "Python cơ bản (Copilot demo)"
CHAPTER_TITLE = "Chương 1: Nền tảng Python"
ASSIGNMENT_TITLE = "Dự án cuối khóa: ứng dụng quản lý chi tiêu dòng lệnh"
LEARNER_EMAIL = "copilot-demo-{0}@example.com"
REPO_OWNER = "https://github.com/copilot-demo-learner"
EDITOR_VERSION = "2.29.0"


def _header(block_id, text, level=2):
	return {"id": block_id, "type": "header", "data": {"text": text, "level": level}}


def _paragraph(block_id, text):
	return {"id": block_id, "type": "paragraph", "data": {"text": text}}


def _markdown(block_id, text):
	return {"id": block_id, "type": "markdown", "data": {"text": text}}


# Block ids are stable so feedback citations and proposals can point at them.
LESSONS = [
	{
		"key": "variables",
		"title": "Bài 1: Biến và kiểu dữ liệu",
		"blocks": [
			_header("b1-intro", "Biến và kiểu dữ liệu"),
			_paragraph(
				"b1-types",
				"Python có các kiểu cơ bản: <b>int</b> (số nguyên), <b>float</b> (số thực), "
				"<b>str</b> (chuỗi) và <b>bool</b> (đúng/sai). Biến chỉ là cái tên gắn với một giá trị.",
			),
			_header("b1-input-title", "Nhập dữ liệu từ bàn phím", 3),
			_markdown(
				"b1-input",
				"`input()` luôn trả về **chuỗi**. Muốn tính toán, hãy đổi kiểu:\n\n"
				'```python\nso_tien = float(input("Số tiền: "))\n```',
			),
			_header("b1-naming", "Đặt tên biến", 3),
			_markdown(
				"b1-naming-body",
				"Dùng `snake_case`, tên nói rõ ý nghĩa: `tong_chi` thay vì `t`, `danh_muc` thay vì `x`.",
			),
		],
	},
	{
		"key": "functions",
		"title": "Bài 2: Hàm",
		"blocks": [
			_header("b2-def", "Định nghĩa hàm"),
			_markdown(
				"b2-def-body",
				"Hàm gom một việc có tên riêng:\n\n"
				"```python\ndef tinh_tong(khoan_chi):\n    return sum(k['so_tien'] for k in khoan_chi)\n```",
			),
			_header("b2-return", "Tham số và giá trị trả về", 3),
			_paragraph(
				"b2-return-body",
				"Hàm nhận dữ liệu qua tham số và trả kết quả bằng <b>return</b> thay vì in ra ngay, "
				"nhờ vậy có thể dùng lại và kiểm thử.",
			),
			_header("b2-split", "Tách chương trình thành hàm nhỏ", 3),
			_markdown(
				"b2-split-body",
				"Mỗi hàm làm một việc: `nhap_khoan_chi()`, `tinh_tong_theo_danh_muc()`, `luu_file()`. "
				"Hàm `main()` chỉ gọi các hàm này theo thứ tự.",
			),
		],
	},
	{
		"key": "errors",
		"title": "Bài 3: Xử lý lỗi với try/except",
		"blocks": [
			_header("b3-intro", "Khi chương trình gặp lỗi"),
			_paragraph(
				"b3-valueerror",
				'<b>float("abc")</b> gây ra <b>ValueError</b> và chương trình dừng lại nếu không xử lý.',
			),
			_header("b3-try", "Bắt lỗi với try/except", 3),
			_markdown(
				"b3-try-body",
				'```python\ntry:\n    so_tien = float(input("Số tiền: "))\nexcept ValueError:\n'
				'    print("Số tiền phải là số.")\n```',
			),
			_header("b3-loop", "Hỏi lại cho đến khi hợp lệ", 3),
			_paragraph(
				"b3-loop-body",
				"Đặt khối try/except trong vòng lặp <b>while True</b> và chỉ <b>break</b> khi giá trị hợp lệ.",
			),
		],
	},
	{
		"key": "json",
		"title": "Bài 4: Đọc và ghi file JSON",
		"blocks": [
			_header("b4-intro", "Lưu dữ liệu giữa các lần chạy"),
			_markdown(
				"b4-dump",
				"Ghi danh sách ra file bằng `json.dump`:\n\n"
				'```python\nimport json\n\nwith open("chi_tieu.json", "w", encoding="utf-8") as f:\n'
				"    json.dump(khoan_chi, f, ensure_ascii=False, indent=2)\n```",
			),
			_header("b4-load-title", "Đọc lại dữ liệu cũ", 3),
			_markdown(
				"b4-load",
				"Đọc bằng `json.load`. Lần chạy đầu tiên file chưa có, hãy bắt `FileNotFoundError` "
				"và bắt đầu với danh sách rỗng.",
			),
			_header("b4-overwrite", "Cẩn thận ghi đè", 3),
			_paragraph(
				"b4-overwrite-body",
				'Chế độ <b>"w"</b> xóa nội dung cũ. Hãy đọc dữ liệu cũ, thêm khoản mới vào danh sách, '
				"rồi mới ghi lại toàn bộ.",
			),
		],
	},
]

ASSIGNMENT_QUESTION = """<p>Viết chương trình dòng lệnh quản lý chi tiêu cá nhân:</p>
<ul>
<li>Thêm khoản chi gồm số tiền, danh mục và ghi chú.</li>
<li>Xem danh sách khoản chi và tổng chi theo từng danh mục.</li>
<li>Dữ liệu được lưu vào file <code>chi_tieu.json</code> và còn nguyên khi chạy lại chương trình.</li>
<li>Nhập sai (ví dụ số tiền là chữ) thì báo lỗi và cho nhập lại, không được dừng chương trình.</li>
</ul>
<p>Nộp link GitHub công khai, file chạy chính là <code>main.py</code>.</p>"""

# (criterion, lesson key, max_level, points, description, levels, pass example, fail example)
RUBRIC = [
	(
		"Chạy đúng chức năng chính",
		"variables",
		3,
		3,
		"Thêm khoản chi, xem danh sách và tổng theo danh mục cho kết quả đúng.",
		"1: thiếu chức năng hoặc chạy sai\n2: đủ chức năng, còn sai tổng\n3: đủ và đúng",
		"Thêm 3 khoản ăn uống 50k, 30k, 20k thì tổng ăn uống là 100k.",
		"Tổng theo danh mục cộng chuỗi thay vì cộng số.",
	),
	(
		"Xử lý lỗi đầu vào",
		"errors",
		3,
		2,
		"Nhập sai số tiền hoặc lựa chọn menu không làm chương trình dừng.",
		"1: nhập sai là chương trình dừng\n2: bắt lỗi nhưng không cho nhập lại\n3: báo lỗi rõ và hỏi lại",
		"Nhập 'abc' thì in 'Số tiền phải là số' và hỏi lại.",
		"float(input()) không có try/except, nhập 'abc' gây ValueError.",
	),
	(
		"Tách hàm, cấu trúc code",
		"functions",
		3,
		2,
		"Chương trình chia thành các hàm nhỏ, mỗi hàm một việc.",
		(
			"1: toàn bộ code trong một hàm hoặc ở cấp module\n2: có vài hàm nhưng còn hàm quá dài\n"
			"3: mỗi hàm một việc, main() chỉ điều phối"
		),
		"Có nhap_khoan_chi(), tong_theo_danh_muc(), luu_file(); main() dưới 20 dòng.",
		"Một hàm main() 150 dòng chứa cả menu, tính toán và ghi file.",
	),
	(
		"Lưu dữ liệu vào file JSON",
		"json",
		3,
		2,
		"Dữ liệu được lưu vào JSON và đọc lại đúng ở lần chạy sau.",
		(
			"1: không lưu file\n2: có lưu nhưng ghi đè mất dữ liệu cũ hoặc lỗi khi chưa có file\n"
			"3: đọc dữ liệu cũ, thêm mới rồi ghi lại"
		),
		"Chạy lại chương trình vẫn thấy các khoản chi đã nhập hôm trước.",
		"Mỗi lần lưu mở file chế độ 'w' chỉ với khoản chi mới nhất.",
	),
	(
		"Đặt tên và trình bày",
		"variables",
		3,
		1,
		"Tên biến, tên hàm rõ nghĩa; code dễ đọc, có hướng dẫn chạy.",
		"1: tên khó hiểu (a, b, x)\n2: phần lớn rõ nghĩa\n3: tên rõ nghĩa, có README hướng dẫn chạy",
		"tong_chi, danh_muc, README có lệnh python main.py.",
		"Biến t, x, l1; không có README.",
	),
]
CRITERIA = [row[0] for row in RUBRIC]

TESTS = [
	("thêm khoản chi hợp lệ", None),
	("tổng chi theo danh mục đúng", None),
	(
		"nhập số tiền 'abc' không làm chương trình dừng",
		"ValueError: could not convert string to float: 'abc'",
	),
	("dữ liệu còn sau khi chạy lại", "chi_tieu.json chỉ còn 1 khoản chi sau lần chạy thứ hai"),
]

# Adult learners (18+). ``case`` picks the planted mistakes and the review state.
LEARNERS = [
	("Nguyễn Văn", "An", "missing_try"),
	("Trần Thị", "Bình", "clean"),
	("Lê Hoàng", "Châu", "single_main"),
	("Phạm Minh", "Dũng", "overwrite_json"),
	("Võ Thu", "Hà", "mixed"),
	("Đặng Quốc", "Khoa", "waiting"),
]

# Levels per criterion, in RUBRIC order, and which sandbox tests fail.
CASES = {
	"clean": {"levels": (3, 3, 3, 3, 3), "fails": (), "confidence": "High"},
	"missing_try": {"levels": (3, 1, 3, 3, 2), "fails": (2,), "confidence": "Medium"},
	"single_main": {"levels": (3, 3, 1, 3, 2), "fails": (), "confidence": "High"},
	"overwrite_json": {"levels": (3, 3, 2, 2, 3), "fails": (3,), "confidence": "Medium"},
	"mixed": {"levels": (2, 1, 2, 1, 2), "fails": (2, 3), "confidence": "Low"},
	"waiting": {"levels": None, "fails": (), "confidence": None},
}


def _user(email, first, last, roles):
	if frappe.db.exists("User", email):
		return email
	frappe.get_doc(
		{
			"doctype": "User",
			"email": email,
			"first_name": first,
			"last_name": last,
			"send_welcome_email": 0,
			"user_type": "Website User",
			"roles": [{"role": role} for role in roles],
		}
	).insert(ignore_permissions=True)
	return email


def _repo(slug, attempt=1):
	return f"{REPO_OWNER}/chi-tieu-{slug}" + (f"-v{attempt}" if attempt > 1 else "")


def _slug(text):
	return "-".join(terms(text)) or "hoc-vien"


def _create_course():
	course = frappe.get_doc(
		{
			"doctype": "LMS Course",
			"title": COURSE_TITLE,
			"short_introduction": DEMO_TAG,
			"description": "Khóa Python cơ bản cho người mới bắt đầu, dùng để demo Learning Copilot.",
			"published": 1,
			"instructors": [{"instructor": "Administrator"}],
		}
	).insert(ignore_permissions=True)
	chapter = frappe.get_doc(
		{"doctype": "Course Chapter", "course": course.name, "title": CHAPTER_TITLE}
	).insert(ignore_permissions=True)
	lessons = {}
	for lesson in LESSONS:
		doc = frappe.get_doc(
			{
				"doctype": "Course Lesson",
				"course": course.name,
				"chapter": chapter.name,
				"title": lesson["title"],
				"content": frappe.as_json({"blocks": lesson["blocks"], "version": EDITOR_VERSION}),
			}
		).insert(ignore_permissions=True)
		lessons[lesson["key"]] = doc.name
	# LMS hooks touch the chapter and course while lessons are inserted: link the outline last.
	chapter = frappe.get_doc("Course Chapter", chapter.name)
	for name in lessons.values():
		chapter.append("lessons", {"lesson": name})
	chapter.save(ignore_permissions=True)
	course = frappe.get_doc("LMS Course", course.name)
	course.append("chapters", {"chapter": chapter.name})
	course.save(ignore_permissions=True)
	return course, lessons


def _create_assignment(course, lessons):
	assignment = frappe.get_doc(
		{
			"doctype": "LMS Assignment",
			"title": ASSIGNMENT_TITLE,
			"question": ASSIGNMENT_QUESTION,
			"type": "URL",
			"course": course.name,
			"grade_assignment": 1,
		}
	).insert(ignore_permissions=True)
	frappe.get_doc(
		{
			"doctype": "Copilot Rubric",
			"title": "Dự án chi tiêu v1",
			"assignment": assignment.name,
			"visible_to_learner": 1,
			"notes": f"{DEMO_TAG}: chấm theo mức đã học tới Bài 4, không đòi hỏi class hay thư viện ngoài.",
			"criteria": [
				{
					"criterion": name,
					"taught_in_lesson": lessons[lesson],
					"max_level": max_level,
					"points": points,
					"description": description,
					"levels": levels,
					"pass_example": pass_example,
					"fail_example": fail_example,
				}
				for name, lesson, max_level, points, description, levels, pass_example, fail_example in RUBRIC
			],
		}
	).insert(ignore_permissions=True)
	return assignment


def _tests(case):
	fails = CASES[case]["fails"]
	return [
		{"name": name, "passed": index not in fails, "message": message if index in fails else None}
		for index, (name, message) in enumerate(TESTS)
	]


def _scores(case, lessons):
	levels = CASES[case]["levels"]
	overall = CASES[case]["confidence"]
	lesson_of = {name: lessons[lesson] for name, lesson, *_rest in RUBRIC}
	reasons = {
		0: {
			3: (
				"Thêm, xem danh sách và tổng theo danh mục đều đúng (test “tổng chi” đạt).",
				"main.py",
				12,
				30,
			),
			2: ("Đủ chức năng nhưng tổng theo danh mục sai khi có danh mục viết hoa.", "main.py", 40, 52),
		},
		1: {
			3: ("Số tiền nhập sai được báo lỗi và hỏi lại trong vòng while.", "main.py", 8, 18),
			1: (
				"float(input()) không nằm trong try/except, nhập 'abc' làm chương trình dừng.",
				"main.py",
				9,
				9,
			),
		},
		2: {
			3: ("Mỗi hàm làm một việc, main() chỉ gọi các hàm.", "main.py", 60, 75),
			2: ("Đã tách vài hàm nhưng phần menu còn dài và lặp lại.", "main.py", 30, 70),
			1: ("Toàn bộ chương trình nằm trong một hàm main() khoảng 140 dòng.", "main.py", 3, 142),
		},
		3: {
			3: ("Đọc dữ liệu cũ, thêm khoản mới rồi ghi lại bằng json.dump.", "storage.py", 5, 21),
			2: (
				"Mở chi_tieu.json chế độ 'w' chỉ với khoản chi mới, dữ liệu cũ bị ghi đè.",
				"main.py",
				88,
				91,
			),
			1: ("Mỗi lần lưu ghi đè file và lỗi FileNotFoundError ở lần chạy đầu.", "main.py", 95, 99),
		},
		4: {
			3: ("Tên biến và hàm rõ nghĩa, README có lệnh chạy.", "README.md", 1, 8),
			2: ("Phần lớn tên rõ nghĩa, vẫn còn biến t, x trong vòng lặp.", "main.py", 44, 47),
		},
	}
	block_of = {1: "b3-try", 2: "b2-split", 3: "b4-overwrite"}
	scores = []
	for index, name in enumerate(CRITERIA):
		level = levels[index]
		reason, file, start, end = reasons[index][level]
		citations = [{"file": file, "line_start": start, "line_end": end}]
		if level < 3 and index in block_of:
			citations.append(
				{"lesson": lesson_of[name], "block_id": block_of[index], "label": f"Xem lại: {name}"}
			)
		scores.append(
			{
				"criterion": name,
				"level": level,
				"reason": reason,
				"confidence": "High" if level == 3 else overall,
				"citations": citations,
			}
		)
	return scores


MESSAGES = {
	"clean": "Chào {name}, bài của em chạy đủ chức năng, bắt lỗi nhập liệu và lưu JSON đúng cách. "
	"Em có thể thử thêm chức năng xóa khoản chi để luyện thêm.",
	"missing_try": "Chào {name}, chương trình đã thêm và tính tổng đúng. Khi nhập số tiền là chữ, "
	"chương trình đang dừng hẳn: em xem lại Bài 3 về try/except và thử hỏi lại người dùng trong vòng lặp.",
	"single_main": "Chào {name}, chương trình chạy đúng và có bắt lỗi. Toàn bộ code đang nằm trong một hàm "
	"main() rất dài; em thử tách phần nhập, tính tổng và lưu file thành các hàm riêng như Bài 2.",
	"overwrite_json": "Chào {name}, em đã lưu được file JSON nhưng mỗi lần lưu lại ghi đè mất dữ liệu cũ. "
	"Xem lại phần “Cẩn thận ghi đè” ở Bài 4: đọc dữ liệu cũ trước rồi mới ghi.",
	"mixed": "Chào {name}, em đã có khung chương trình. Hai việc cần làm trước: bắt lỗi khi nhập số tiền "
	"(Bài 3) và giữ lại dữ liệu cũ khi ghi file JSON (Bài 4).",
}


def _submit(learner, assignment, lesson, slug, attempt=1):
	frappe.set_user(learner)
	project = feedback.submit_project(assignment, _repo(slug, attempt), lesson=lesson)["project_submission"]
	frappe.set_user("Administrator")
	return project


def _review(project, case, name, lessons, commit):
	feedback.record_submission_tests(project, _tests(case), commit_sha=commit)
	return feedback.propose_feedback(
		project, _scores(case, lessons), MESSAGES[case].format(name=name), model="demo"
	)["draft"]


def _seed_learners(course, assignment, lessons):
	final_lesson = lessons["json"]
	for index, (first, last, case) in enumerate(LEARNERS, 1):
		email = _user(LEARNER_EMAIL.format(index), first, last, ["LMS Student"])
		frappe.get_doc({"doctype": "LMS Enrollment", "course": course.name, "member": email}).insert(
			ignore_permissions=True
		)
		slug = _slug(last)
		if case == "waiting":
			project = _submit(email, assignment.name, final_lesson, slug)
			feedback.record_submission_tests(
				project, [], error="Không tìm thấy main.py ở thư mục gốc của repo."
			)
			continue
		if case == "mixed":
			first_try = _submit(email, assignment.name, final_lesson, slug)
			_review(first_try, case, last, lessons, frappe.generate_hash(length=40))
		project = _submit(email, assignment.name, final_lesson, slug, attempt=2 if case == "mixed" else 1)
		draft = _review(project, case, last, lessons, frappe.generate_hash(length=40))
		if case == "single_main":
			feedback.approve_feedback(
				draft,
				message=MESSAGES[case].format(name=last) + " Thầy đánh giá cao phần bắt lỗi của em.",
				note=DEMO_TAG,
			)
		elif case == "overwrite_json":
			feedback.request_rewrite(
				draft, "Nhận xét nên chỉ rõ dòng mở file chế độ 'w' và gợi ý đọc file trước."
			)


def _seed_proposals(course, lessons):
	proposals.create_proposal(
		"propose_lesson_change",
		{
			"lesson": lessons["errors"],
			"after_block": "b3-loop-body",
			"markdown": "### Ví dụ: hỏi lại số tiền\n```python\nwhile True:\n    try:\n"
			'        so_tien = float(input("Số tiền: "))\n        break\n    except ValueError:\n'
			'        print("Số tiền phải là số, nhập lại nhé.")\n```\n\n'
			"**Bài luyện:** sửa chương trình để nhập sai danh mục cũng được hỏi lại.",
			"reason": "3/6 bài dự án cuối khóa dừng chương trình khi nhập số tiền là chữ.",
			"confidence": "High",
		},
	)
	frappe.set_user(LEARNER_EMAIL.format(len(LEARNERS)))
	proposals.create_proposal(
		"escalate_to_teacher",
		{
			"course": course.name,
			"question": "Em đi công tác tuần này, em có được nộp dự án cuối khóa muộn 3 ngày không ạ?",
			"summary": "Học viên hỏi về gia hạn nộp dự án cuối khóa.",
		},
	)
	frappe.set_user("Administrator")


def seed():
	if frappe.db.exists("LMS Course", {"title": COURSE_TITLE}):
		print("Demo already exists. Run lms.copilot.demo.clear first.")
		return
	frappe.set_user("Administrator")
	# Seeding must never reach the AI Gateway: drafts are written directly below.
	with patch("lms.copilot.gateway.enqueue_review", return_value=False):
		course, lessons = _create_course()
		assignment = _create_assignment(course, lessons)
		_seed_learners(course, assignment, lessons)
		_seed_proposals(course, lessons)
	frappe.db.commit()
	print(f"Demo ready: /copilot  (course {course.name}, assignment {assignment.name})")


def _demo_courses():
	return sorted(
		set(frappe.get_all("LMS Course", filters={"short_introduction": DEMO_TAG}, pluck="name"))
		| set(frappe.get_all("LMS Course", filters={"title": COURSE_TITLE}, pluck="name"))
	)


def _delete(doctype, filters):
	for name in frappe.get_all(doctype, filters=filters, pluck="name"):
		frappe.delete_doc(doctype, name, force=True, ignore_permissions=True)


def _clear_course(course):
	for doctype in (
		"Copilot Feedback Draft",
		"Copilot Project Submission",
		"Copilot Proposal",
		"Copilot Conversation",
		"Copilot Weekly Insight",
	):
		_delete(doctype, {"course": course})
	for assignment in frappe.get_all("LMS Assignment", filters={"course": course}, pluck="name"):
		_delete("Copilot Rubric", {"assignment": assignment})
		_delete("LMS Assignment Submission", {"assignment": assignment})
		frappe.delete_doc("LMS Assignment", assignment, force=True, ignore_permissions=True)
	_delete("LMS Enrollment", {"course": course})
	_delete("Course Lesson", {"course": course})
	_delete("Course Chapter", {"course": course})
	frappe.delete_doc("LMS Course", course, force=True, ignore_permissions=True)


def clear():
	"""Remove every course tagged DEMO_TAG (this seed and older ones) and the demo learners."""
	frappe.set_user("Administrator")
	courses = _demo_courses()
	for course in courses:
		_clear_course(course)
	learners = frappe.get_all("User", filters={"name": ["like", LEARNER_EMAIL.format("%")]}, pluck="name")
	for email in learners:
		frappe.delete_doc("User", email, force=True, ignore_permissions=True)
	frappe.db.commit()
	print(f"Demo data removed: {len(courses)} course(s), {len(learners)} learner(s).")
