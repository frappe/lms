from frappe.tests.utils import FrappeTestCase

from lms.copilot.content import rank_sections, search_terms

SECTIONS = [
	{"block_id": "naming", "heading": "Đặt tên biến", "text": "Em nên đặt tên biến rõ nghĩa, ví dụ so_tien."},
	{"block_id": "loop", "heading": "Vòng lặp", "text": "Dùng vòng for khi em muốn lặp lại một việc."},
	{
		"block_id": "valueerror",
		"heading": "Khi chương trình gặp lỗi",
		"text": 'float("abc") gây ra ValueError và chương trình dừng lại nếu không xử lý.',
	},
	{
		"block_id": "try",
		"heading": "Bắt lỗi với try/except",
		"text": 'try:\n    so_tien = float(input("Số tiền: "))\nexcept ValueError:\n    print("Số tiền phải là số.")',
	},
]


class TestSearchRanking(FrappeTestCase):
	def test_function_words_are_ignored(self):
		self.assertEqual(search_terms("Vậy em đặt try ở đâu thì đúng?"), ["try", "dung"])

	def test_rare_topic_word_beats_filler(self):
		ranked = rank_sections("Vậy em đặt try ở đâu thì đúng?", SECTIONS)
		self.assertEqual(ranked[0][1]["block_id"], "try")

	def test_long_learner_question_finds_the_error_block(self):
		question = "Tại sao chương trình của em bị dừng khi em nhập chữ vào chỗ số tiền? Em nên làm gì?"
		ranked = rank_sections(question, SECTIONS)
		self.assertIn(ranked[0][1]["block_id"], {"valueerror", "try"})
		self.assertGreaterEqual(ranked[0][0], 0.3)

	def test_only_filler_returns_nothing(self):
		self.assertEqual(rank_sections("em hỏi thầy cái này với ạ", SECTIONS), [])
