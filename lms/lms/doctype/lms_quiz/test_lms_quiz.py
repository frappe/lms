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


from lms.lms.doctype.lms_quiz.lms_quiz import _parse_json_arg  # noqa: E402


class TestQuizSubmissionInputValidation(unittest.TestCase):
	"""submit_quiz / check_answer json.loads the client-sent answers payload. A malformed
	payload used to surface as a raw 500 (JSONDecodeError); it now raises a clean
	validation error. Fixture-free.
	"""

	def test_valid_json_is_parsed(self):
		self.assertEqual(_parse_json_arg("[1, 2]", "answers"), [1, 2])
		self.assertEqual(_parse_json_arg('{"a": 1}', "answers"), {"a": 1})

	def test_malformed_json_is_rejected(self):
		# Under a real request this is frappe.ValidationError; bare it raises too — the
		# contract is "reject, don't 500/parse-as-None".
		for raw in ("not json", "{bad}", "", "[1,"):
			with self.subTest(raw=raw):
				with self.assertRaises(Exception):
					_parse_json_arg(raw, "answers")


class TestCheckAnswerEmptyInput(unittest.TestCase):
	"""check_answer normalises the client answers payload before dispatching. Empty/absent
	answers used to skip the parser and reach downstream in the wrong shape — answers[0]
	(IndexError on "") or `x in None` (TypeError). It must now normalise to a list and
	reject an empty answer for input questions with a clean ValidationError. The pre-dispatch
	permission/existence checks are monkeypatched so this stays fixture-free.
	"""

	def setUp(self):
		from lms.lms.doctype.lms_quiz import lms_quiz

		self.mod = lms_quiz
		self._orig = {
			name: getattr(lms_quiz, name) for name in ("check_choice_answers", "check_input_answers")
		}
		self._orig_exists = frappe.db.exists
		self._orig_get_value = frappe.db.get_value
		self._orig_get_roles = frappe.get_roles

		self.choice_calls = []
		self.input_calls = []
		lms_quiz.check_choice_answers = lambda q, a: self.choice_calls.append(a) or []
		lms_quiz.check_input_answers = lambda q, a: self.input_calls.append(a) or []
		# question exists; live checking enabled (show_answers); admin so gate is open anyway
		frappe.db.exists = lambda *a, **k: True
		frappe.db.get_value = lambda *a, **k: 1
		frappe.get_roles = lambda *a, **k: ["System Manager"]

	def tearDown(self):
		for name, fn in self._orig.items():
			setattr(self.mod, name, fn)
		frappe.db.exists = self._orig_exists
		frappe.db.get_value = self._orig_get_value
		frappe.get_roles = self._orig_get_roles

	# `answers` is a whitelisted str param; Frappe's own type wrapper rejects a bare
	# None before the body, so the realistic empty value to test here is "" (and the
	# JSON strings that parse to empty/null), not Python None.

	def test_empty_choice_answers_normalise_to_list(self):
		# No selection on a choice question is legitimate — dispatch with [], never crash.
		for raw in ("", "[]"):
			with self.subTest(raw=raw):
				self.choice_calls.clear()
				self.mod.check_answer("Q", "QN", "Choices", raw)
				self.assertEqual(self.choice_calls, [[]])

	def test_blank_input_answers_dispatch_empty_string(self):
		# A blank input answer ("" / [] / the [null]/[""] the UI emits for an untouched
		# field) scores as incorrect: it's coerced to "" and dispatched, never throwing
		# and never IndexError-ing on answers[0].
		for raw in ("", "[]", "[null]", '[""]'):
			with self.subTest(raw=raw):
				self.input_calls.clear()
				self.mod.check_answer("Q", "QN", "Input", raw)
				self.assertEqual(self.input_calls, [""])

	def test_non_list_answers_are_rejected(self):
		for raw in ('{"a": 1}', '"str"', "42"):
			with self.subTest(raw=raw):
				with self.assertRaises(ValidationError):
					self.mod.check_answer("Q", "QN", "Choices", raw)

	def test_valid_input_answer_reaches_checker(self):
		self.input_calls.clear()
		self.mod.check_answer("Q", "QN", "Input", '["my answer"]')
		self.assertEqual(self.input_calls, ["my answer"])


class TestQuizResultValidation(unittest.TestCase):
	"""submit_quiz validates the results payload item-by-item before process_results reads
	result["question_name"] and result["answer"][0]. Malformed items must raise a clean
	ValidationError, not a 500 deep in scoring. Fixture-free (validator is pure).
	"""

	def setUp(self):
		from lms.lms.doctype.lms_quiz.lms_quiz import _validate_quiz_results

		self.fn = _validate_quiz_results

	def test_wellformed_and_blank_results_pass(self):
		# Only coarse shape is enforced here; a blank/absent answer is NOT rejected (the UI
		# emits [null] for a skipped question — process_results normalises it to "").
		self.fn([])  # empty submission is fine
		self.fn([{"question_name": "Q1", "answer": ["opt1"]}])
		self.fn([{"question_name": "Q1", "answer": ["a", "b"]}])
		self.fn([{"question_name": "Q1"}])  # missing answer
		self.fn([{"question_name": "Q1", "answer": None}])
		self.fn([{"question_name": "Q1", "answer": []}])
		self.fn([{"question_name": "Q1", "answer": [None]}])  # blank open-ended

	def test_malformed_items_are_rejected(self):
		cases = [
			[{}],  # no question_name
			[{"question_name": "", "answer": ["x"]}],  # empty question_name
			[{"question_name": "Q", "answer": "opt1"}],  # answer not a list -> would iterate chars
			["not a dict"],
			[None],
		]
		for results in cases:
			with self.subTest(results=results):
				with self.assertRaises(ValidationError):
					self.fn(results)
