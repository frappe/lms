# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

# import json

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

	def test_question_without_a_scorable_answer_is_rejected(self):
		def no_correct_option():
			question = frappe.new_doc("LMS Question")
			question.question = "Question Multiple"
			question.type = "Choices"
			question.option_1 = "Option 1"
			question.option_2 = "Option 2"
			return question

		def no_possible_answers():
			question = frappe.new_doc("LMS Question")
			question.question = "Question Multiple"
			question.type = "User Input"
			return question

		cases = [
			("no_correct_option", no_correct_option),
			("no_possible_answers", no_possible_answers),
		]
		for case, build in cases:
			with self.subTest(case=case):
				question = build()
				self.assertRaises(frappe.ValidationError, question.save)

	def test_choice_scoring_true_and_false_for_ten_and_two_option_questions(self):
		from lms.lms.doctype.lms_quiz.lms_quiz import verify_answer

		def ten_options():
			q = frappe.new_doc("LMS Question")
			q.question = "Ten option question"
			q.type = "Choices"
			for i in range(1, 11):
				q.set(f"option_{i}", f"opt{i}")
			q.is_correct_7 = 1
			q.save()
			return q, "opt7", "opt3"

		def legacy_two_options():
			q = frappe.new_doc("LMS Question")
			q.question = "Two option legacy"
			q.type = "Choices"
			q.option_1 = "yes"
			q.is_correct_1 = 1
			q.option_2 = "no"
			q.save()
			return q, "yes", "no"

		cases = [
			("ten_options", ten_options),
			("legacy_two_options", legacy_two_options),
		]
		for case, build in cases:
			with self.subTest(case=case):
				q, correct, incorrect = build()
				self.assertTrue(verify_answer(q.name, [correct]))
				self.assertFalse(verify_answer(q.name, [incorrect]))

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

	def test_rejects_unsafe_mime_type_or_extension_combos(self):
		cases = [
			(
				"active_document_extension",
				"application/xhtml+xml",
				"attack.xhtml",
				b"<script>alert(1)</script>",
			),
			("non_image_mime_type", "text/javascript", "attack.js", b"alert(1)"),
			("image_mime_with_active_document_extension", "image/png", "spoof.xhtml", b"image-bytes"),
		]
		for case, mime_type, filename, content in cases:
			with self.subTest(case=case):
				with self.assertRaises(ValidationError):
					self.save_answer_image(mime_type, filename, content)

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
		# Under a real request this is frappe.ValidationError; bare it raises too. The
		# contract is "reject, don't 500/parse-as-None".
		for raw in ("not json", "{bad}", "", "[1,"):
			with self.subTest(raw=raw):
				with self.assertRaises(Exception):
					_parse_json_arg(raw, "answers")


class TestCheckAnswerEmptyInput(unittest.TestCase):
	"""check_answer normalises the client answers payload before dispatching. Empty/absent
	answers used to skip the parser and reach downstream in the wrong shape: answers[0]
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
		# No selection on a choice question is legitimate. Dispatch with [], never crash.
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
		# emits [null] for a skipped question; process_results normalises it to "").
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


# ---------------------------------------------------------------------------
# Question bank and usage helpers
# ---------------------------------------------------------------------------
import json  # noqa: E402 (local re-import is fine; json is stdlib)

from frappe.tests.utils import FrappeTestCase

from lms.lms.doctype.lms_quiz.lms_quiz import (
	get_question_bank,
	get_question_meta,
)


class TestQuizAuthoringHelpers(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		cls.q1 = frappe.get_doc(
			{
				"doctype": "LMS Question",
				"question": "Usage Q1",
				"type": "Choices",
				"option_1": "A",
				"is_correct_1": 1,
				"option_2": "B",
			}
		).insert()
		cls.q2 = frappe.get_doc(
			{
				"doctype": "LMS Question",
				"question": "Usage Q2",
				"type": "Open Ended",
			}
		).insert()
		cls.quiz_a = frappe.get_doc(
			{
				"doctype": "LMS Quiz",
				"title": "Usage Quiz A",
				"passing_percentage": 70,
				"questions": [{"question": cls.q1.name, "marks": 2}],
			}
		).insert()
		cls.quiz_b = frappe.get_doc(
			{
				"doctype": "LMS Quiz",
				"title": "Usage Quiz B",
				"passing_percentage": 70,
				"questions": [{"question": cls.q1.name, "marks": 3}],
			}
		).insert()

	def test_meta_counts_distinct_quizzes(self):
		result = get_question_meta(json.dumps([self.q1.name, self.q2.name]))
		self.assertEqual(result[self.q1.name]["quizzes"], 2)
		# q2 is in no quiz, so it is still listed and reports none.
		self.assertEqual(result[self.q2.name]["quizzes"], 0)

	def test_meta_accepts_list_and_validates(self):
		result = get_question_meta([self.q1.name])
		self.assertEqual(result[self.q1.name]["quizzes"], 2)
		self.assertEqual(get_question_meta([]), {})
		with self.assertRaises(frappe.ValidationError):
			get_question_meta("not-json-and-not-a-list")

	def test_meta_reports_the_type_a_child_row_cannot(self):
		# LMS Quiz Question has no `multiple` column, so a collapsed card reading
		# the row alone badges a multiple choice question as single.
		multi = frappe.get_doc(
			{
				"doctype": "LMS Question",
				"question": "Pick two",
				"type": "Choices",
				"option_1": "A",
				"is_correct_1": 1,
				"option_2": "B",
				"is_correct_2": 1,
			}
		).insert()
		result = get_question_meta([multi.name, self.q1.name, self.q2.name])
		self.assertEqual(result[multi.name]["type"], "Choices")
		self.assertEqual(result[multi.name]["multiple"], 1)
		self.assertEqual(result[self.q1.name]["multiple"], 0)
		self.assertEqual(result[self.q2.name]["type"], "Open Ended")

	def test_bank_lists_with_flags_and_default_marks(self):
		bank = get_question_bank(quiz=self.quiz_a.name)
		by_name = {row["name"]: row for row in bank}
		self.assertIn(self.q1.name, by_name)
		self.assertTrue(by_name[self.q1.name]["already_in_quiz"])
		# Marks belong to the question now, so q1 reports its own 1 and neither
		# quiz row's number (2 in quiz_a, 3 in quiz_b) leaks into the bank.
		self.assertEqual(by_name[self.q1.name]["default_marks"], 1)
		self.assertFalse(by_name[self.q2.name]["already_in_quiz"])
		self.assertEqual(by_name[self.q2.name]["default_marks"], 1)

	def test_bank_offers_the_questions_own_marks_including_zero(self):
		# FrappeTestCase rolls back once at class teardown, so a write to the shared q1
		# must restore itself. `marks` is non_negative, so 0 is a real choice; `or 1`
		# used to read it as absent and offer the question as worth 1.
		original_marks = frappe.db.get_value("LMS Question", self.q1.name, "marks")
		self.addCleanup(frappe.db.set_value, "LMS Question", self.q1.name, "marks", original_marks)
		cases = [("nonzero", 5), ("zero", 0)]
		for case, marks in cases:
			with self.subTest(case=case):
				frappe.db.set_value("LMS Question", self.q1.name, "marks", marks)
				bank = get_question_bank(quiz=self.quiz_a.name)
				by_name = {row["name"]: row for row in bank}
				self.assertEqual(by_name[self.q1.name]["default_marks"], marks)

	def test_bank_excludes_the_names_it_is_given(self):
		# The picker gets one page, so a quiz already holding the most recently
		# modified questions used to draw an empty bank with the rest still there.
		bank = get_question_bank(quiz=self.quiz_a.name, exclude=[self.q1.name])
		names = [row["name"] for row in bank]
		self.assertNotIn(self.q1.name, names)
		self.assertIn(self.q2.name, names)

	def test_bank_takes_the_exclusion_as_a_json_string(self):
		# frappe hands a list argument over as JSON on some call paths.
		bank = get_question_bank(quiz=self.quiz_a.name, exclude=json.dumps([self.q1.name]))
		self.assertNotIn(self.q1.name, [row["name"] for row in bank])

	def test_bank_narrows_to_the_types_the_quiz_can_take(self):
		bank = get_question_bank(quiz=self.quiz_a.name, allowed_types=["Open Ended"])
		self.assertTrue(all(row["type"] == "Open Ended" for row in bank))

	def test_bank_ignores_an_unusable_exclusion(self):
		full = get_question_bank(quiz=self.quiz_a.name)
		self.assertEqual(
			[row["name"] for row in get_question_bank(quiz=self.quiz_a.name, exclude="not json")],
			[row["name"] for row in full],
		)

	def test_bank_intersects_an_explicit_type_with_what_the_quiz_takes(self):
		# Answering with rows the picker then drops on the floor reads as a bug: the
		# quiz's mixing constraint still applies to a type the author picked.
		# Choices, because q1 is one: without the intersection the bank answers with it.
		self.assertEqual(
			get_question_bank(
				quiz=self.quiz_a.name,
				question_type="Choices",
				allowed_types=["Open Ended"],
			),
			[],
		)

	def test_bank_filters_by_type_and_search(self):
		open_only = get_question_bank(quiz=self.quiz_a.name, question_type="Open Ended")
		self.assertTrue(all(r["type"] == "Open Ended" for r in open_only))
		searched = get_question_bank(quiz=self.quiz_a.name, search="Usage Q1")
		self.assertTrue(any(r["name"] == self.q1.name for r in searched))
		self.assertFalse(any(r["name"] == self.q2.name for r in searched))

	def test_question_meta_and_bank_endpoints_require_instructor(self):
		# addCleanup, not a trailing set_user: if the endpoint ever stops raising, the
		# assertion raises out of this method and every later test in the run would
		# execute as Guest and fail for a reason that has nothing to do with it.
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user("Guest")
		cases = [
			("get_question_meta", lambda: get_question_meta([self.q1.name])),
			("get_question_bank", lambda: get_question_bank(quiz=self.quiz_a.name)),
		]
		for case, action in cases:
			with self.subTest(case=case):
				with self.assertRaises(frappe.PermissionError):
					action()


from lms.patches.v2_0.set_question_marks_from_quizzes import PATCH as MARKS_PATCH  # noqa: E402
from lms.patches.v2_0.set_question_marks_from_quizzes import (  # noqa: E402
	execute as backfill_question_marks,
)


class TestQuestionMarksBackfill(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		# The site this runs on has already migrated, so the patch is recorded and
		# its run-once guard would return before touching anything. Every test that
		# exercises the backfill has to look like a site seeing it for the first
		# time; the rollback puts the row back.
		self._forget_the_patch_ran()

	def _forget_the_patch_ran(self):
		for row in frappe.get_all("Patch Log", filters={"patch": ("like", f"{MARKS_PATCH}%")}):
			frappe.db.delete("Patch Log", {"name": row.name})

	def _question(self, text):
		return frappe.get_doc({"doctype": "LMS Question", "question": text, "type": "Open Ended"}).insert()

	def _quiz(self, title, rows):
		return frappe.get_doc(
			{
				"doctype": "LMS Quiz",
				"title": title,
				"passing_percentage": 70,
				"questions": rows,
			}
		).insert()

	def test_backfill_takes_the_highest_quiz_weight_and_leaves_authored_marks_alone(self):
		def zero_weight():
			# 0 is a weight an author can pick (`reqd` reads an Int through cstr, so "0"
			# counts as content). Filtering on `marks > 1` left it on the default of 1.
			question = self._question("Backfill zero")
			self._quiz("Backfill Zero Quiz", [{"question": question.name, "marks": 0}])
			frappe.db.set_value("LMS Question", question.name, "marks", 1, update_modified=False)
			return question, 0

		def highest_weight():
			question = self._question("Backfill highest")
			self._quiz("Backfill Highest A", [{"question": question.name, "marks": 2}])
			self._quiz("Backfill Highest B", [{"question": question.name, "marks": 5}])
			frappe.db.set_value("LMS Question", question.name, "marks", 1, update_modified=False)
			return question, 5

		def deliberate_zero():
			# 0 is a weight, not an absent value. `marks <= 1` kept it permanently
			# eligible, so a re-run read the author's 0 as unset and overwrote it.
			question = self._question("Backfill deliberate zero")
			self._quiz("Backfill Deliberate Zero Quiz", [{"question": question.name, "marks": 3}])
			frappe.db.set_value("LMS Question", question.name, "marks", 0, update_modified=False)
			return question, 0

		def already_run():
			# The only guard that can protect a deliberate 1: from the data alone it is
			# indistinguishable from a question nobody has touched.
			question = self._question("Backfill already run")
			self._quiz("Backfill Already Run Quiz", [{"question": question.name, "marks": 6}])
			frappe.db.set_value("LMS Question", question.name, "marks", 1, update_modified=False)
			frappe.get_doc({"doctype": "Patch Log", "patch": f"{MARKS_PATCH} #05-09-2026"}).insert()
			return question, 1

		def set_by_hand():
			question = self._question("Backfill manual")
			self._quiz("Backfill Manual Quiz", [{"question": question.name, "marks": 4}])
			frappe.db.set_value("LMS Question", question.name, "marks", 7, update_modified=False)
			return question, 7

		cases = [
			("a_zero_weight_backfills_as_zero", zero_weight),
			("takes_the_highest_weight_across_quizzes", highest_weight),
			("leaves_a_weight_deliberately_set_to_zero", deliberate_zero),
			("does_nothing_once_the_patch_is_recorded", already_run),
			("leaves_a_weight_set_by_hand", set_by_hand),
		]
		for case, build in cases:
			with self.subTest(case=case):
				# Only "already_run" wants the patch marked recorded; forgetting it
				# again here undoes that row's insert so later rows still backfill.
				self._forget_the_patch_ran()
				question, expected_marks = build()

				backfill_question_marks()

				self.assertEqual(frappe.db.get_value("LMS Question", question.name, "marks"), expected_marks)
