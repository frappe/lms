# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

# import frappe
import base64
import re
import unittest

import frappe
from frappe.exceptions import ValidationError

from lms.lms.doctype.lms_quiz.lms_quiz import _save_file

# 1x1 transparent PNG, used to assert that genuine images are still accepted.
ONE_PIXEL_PNG = base64.b64decode(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC"
)
# Same matcher process_results() uses to feed data: URIs to _save_file().
IMAGE_DATA_URI_PATTERN = r'<img[^>]*src\s*=\s*["\'](?=data:)(.*?)["\']'


class TestLMSQuiz(unittest.TestCase):
	@classmethod
	def setUpClass(cls) -> None:
		frappe.get_doc({"doctype": "LMS Quiz", "title": "Test Quiz", "passing_percentage": 90}).save()

	def test_with_multiple_options(self):
		question = frappe.new_doc("LMS Question")
		question.question = "Question Multiple"
		question.type = "Choices"
		question.option_1 = "Option 1"
		question.is_correct_1 = 1
		question.option_2 = "Option 2"
		question.is_correct_2 = 1
		question.save()
		self.assertTrue(question.multiple)

	def test_with_no_correct_option(self):
		question = frappe.new_doc("LMS Question")
		question.question = "Question Multiple"
		question.type = "Choices"
		question.option_1 = "Option 1"
		question.option_2 = "Option 2"
		self.assertRaises(frappe.ValidationError, question.save)

	def test_with_no_possible_answers(self):
		question = frappe.new_doc("LMS Question")
		question.question = "Question Multiple"
		question.type = "User Input"
		self.assertRaises(frappe.ValidationError, question.save)

	def test_scores_question_with_ten_options(self):
		from lms.lms.doctype.lms_quiz.lms_quiz import verify_answer

		q = frappe.new_doc("LMS Question")
		q.question = "Ten option question"
		q.type = "Choices"
		for i in range(1, 11):
			q.set(f"option_{i}", f"opt{i}")
		q.is_correct_7 = 1
		q.save()

		self.assertTrue(verify_answer(q.name, ["opt7"]))
		self.assertFalse(verify_answer(q.name, ["opt3"]))

	def test_legacy_two_option_question_still_scores(self):
		from lms.lms.doctype.lms_quiz.lms_quiz import verify_answer

		q = frappe.new_doc("LMS Question")
		q.question = "Two option legacy"
		q.type = "Choices"
		q.option_1 = "yes"
		q.is_correct_1 = 1
		q.option_2 = "no"
		q.save()

		self.assertTrue(verify_answer(q.name, ["yes"]))
		self.assertFalse(verify_answer(q.name, ["no"]))

	def test_user_input_matches_seventh_possibility(self):
		from lms.lms.doctype.lms_quiz.lms_quiz import check_input_answers

		q = frappe.new_doc("LMS Question")
		q.question = "Ten possibility question"
		q.type = "User Input"
		for i in range(1, 11):
			q.set(f"possibility_{i}", f"answer {i}")
		q.save()

		self.assertTrue(bool(check_input_answers(q.name, "answer 7")))
		self.assertFalse(bool(check_input_answers(q.name, "totally different")))

	@classmethod
	def tearDownClass(cls) -> None:
		frappe.db.delete("LMS Quiz", "test-quiz")
		frappe.db.delete("LMS Question")


class TestQuizAnswerImageUpload(unittest.TestCase):
	"""Open-ended quiz answers may embed inline images as data: URIs that get
	written to the public /files/ directory. Only image types are allowed: an
	active-document extension (.xhtml, .js, ...) would be served inline and
	enable stored XSS on the LMS origin.
	"""

	def save_answer_image(self, mime_type, filename, content=b"image-bytes"):
		encoded = base64.b64encode(content).decode()
		answer = f'<img src="data:{mime_type};filename={filename},{encoded}">'
		return re.sub(IMAGE_DATA_URI_PATTERN, _save_file, answer)

	def test_rejects_active_document_extension(self):
		with self.assertRaises(ValidationError):
			self.save_answer_image("application/xhtml+xml", "attack.xhtml", b"<script>alert(1)</script>")

	def test_rejects_non_image_mime_type(self):
		with self.assertRaises(ValidationError):
			self.save_answer_image("text/javascript", "attack.js", b"alert(1)")

	def test_rejects_image_mime_with_active_document_extension(self):
		with self.assertRaises(ValidationError):
			self.save_answer_image("image/png", "spoof.xhtml")

	def test_accepts_genuine_image(self):
		rendered = self.save_answer_image("image/png", "answer.png", ONE_PIXEL_PNG)
		self.assertIn("/files/", rendered)

	def tearDown(self):
		for name in frappe.get_all("File", {"file_name": "answer.png"}, pluck="name"):
			frappe.delete_doc("File", name, force=True, ignore_permissions=True)
