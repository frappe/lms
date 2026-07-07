# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import json
import os
import re
from binascii import Error as BinasciiError

import frappe
from frappe import _, safe_decode
from frappe.core.doctype.file.utils import get_random_filename
from frappe.model.document import Document
from frappe.utils import cint, comma_and, escape_html
from frappe.utils.file_manager import safe_b64decode
from frappe.utils.html_utils import sanitize_html
from fuzzywuzzy import fuzz

from lms.lms.doctype.course_lesson.course_lesson import save_progress
from lms.lms.doctype.lms_question.lms_question import (
	QUESTION_CORRECTNESS_FIELDS,
	QUESTION_OPTION_FIELDS,
	QUESTION_POSSIBILITY_FIELDS,
)
from lms.lms.utils import (
	generate_slug,
)

# Quiz answers may embed inline images as data: URIs. Only raster image types are
# permitted — a data: URI with an active-document extension (.xhtml, .xsl, .html,
# .js, …) would otherwise be written to the public /files/ dir and served inline,
# enabling stored XSS on the LMS origin. SVG is excluded (script-bearing).
ALLOWED_DATAURL_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp"}


class LMSQuiz(Document):
	def validate(self):
		self.validate_duplicate_questions()
		self.validate_limit()
		self.calculate_total_marks()
		self.validate_open_ended_questions()

	def validate_duplicate_questions(self):
		questions = [row.question for row in self.questions]
		rows = [i + 1 for i, x in enumerate(questions) if questions.count(x) > 1]
		if len(rows):
			frappe.throw(_("Rows {0} have the duplicate questions.").format(frappe.bold(comma_and(rows))))

	def validate_limit(self):
		if not self.shuffle_questions and self.limit_questions_to:
			self.limit_questions_to = 0

		if self.limit_questions_to and cint(self.limit_questions_to) >= len(self.questions):
			frappe.throw(_("Limit cannot be greater than or equal to the number of questions in the quiz."))

		if self.limit_questions_to and cint(self.limit_questions_to) < len(self.questions):
			marks = [question.marks for question in self.questions]
			if len(set(marks)) > 1:
				frappe.throw(_("All questions should have the same marks if the limit is set."))

	def calculate_total_marks(self):
		if len(self.questions) == 0:
			self.total_marks = 0
			self.passing_percentage = 100
			return

		if self.limit_questions_to:
			self.total_marks = sum(
				question.marks for question in self.questions[: cint(self.limit_questions_to)]
			)
		else:
			self.total_marks = sum(cint(question.marks) for question in self.questions)

	def validate_open_ended_questions(self):
		types = [question.type for question in self.questions]
		types = set(types)

		if "Open Ended" in types:
			if len(types) > 1:
				frappe.throw(
					_(
						"If you want open ended questions then make sure each question in the quiz is of open ended type."
					)
				)
			else:
				self.show_answers = 0

	def autoname(self):
		if not self.name:
			self.name = generate_slug(self.title, "LMS Quiz")

	def get_last_submission_details(self):
		"""Returns the latest submission for this user."""
		user = frappe.session.user
		if not user or user == "Guest":
			return

		result = frappe.get_all(
			"LMS Quiz Submission",
			fields="*",
			filters={"owner": user, "quiz": self.name},
			order_by="creation desc",
			page_length=1,
		)

		if result:
			return result[0]


def set_total_marks(questions: list) -> int:
	marks = 0
	for question in questions:
		marks += question.get("marks")
	return marks


def _parse_json_arg(raw, label):
	"""Parse a client-supplied JSON-string argument, raising a clean error (not a 500)."""
	try:
		return json.loads(raw)
	except (TypeError, ValueError):
		frappe.throw(_("Invalid {0} submitted.").format(label), frappe.ValidationError)


def _validate_quiz_results(results):
	"""Coarse shape check before process_results reads result["question_name"] / ["answer"].
	Rejects genuinely malformed items (non-dict, no question_name, or an answer that isn't a
	list) with a clean validation error. A blank/null answer element is NOT rejected here — the
	UI legitimately emits answer=[null] for a skipped open-ended question; process_results
	normalises those to "" so a student can still submit a partially-answered quiz."""
	for result in results:
		if not (isinstance(result, dict) and result.get("question_name")):
			frappe.throw(_("Invalid quiz results submitted."), frappe.ValidationError)
		answer = result.get("answer")
		if answer is not None and not isinstance(answer, list):
			frappe.throw(_("Invalid quiz results submitted."), frappe.ValidationError)


@frappe.whitelist()
def submit_quiz(quiz: str, results: str | None = None):
	results = _parse_json_arg(results, _("quiz results")) if results else []
	if not isinstance(results, list):
		frappe.throw(_("Invalid quiz results submitted."), frappe.ValidationError)
	_validate_quiz_results(results)

	quiz_details = frappe.db.get_value(
		"LMS Quiz",
		quiz,
		[
			"name",
			"total_marks",
			"passing_percentage",
			"lesson",
			"course",
			"enable_negative_marking",
			"marks_to_cut",
		],
		as_dict=1,
	)
	if not quiz_details:
		frappe.throw(_("Invalid quiz."), frappe.ValidationError)

	data = process_results(results, quiz_details)
	is_open_ended = data["is_open_ended"]

	# Score and percentage are the submission's responsibility — its validate()
	# runs validate_marks() + set_percentage() on save. Read them back rather
	# than recomputing here, so the two paths can't drift.
	submission = create_submission(
		quiz, data["results"], quiz_details.total_marks, quiz_details.passing_percentage
	)
	percentage = submission.percentage or 0
	save_progress_after_quiz(quiz_details, percentage)

	return {
		"score": submission.score,
		"score_out_of": submission.score_out_of,
		"submission": submission.name,
		"pass": percentage >= quiz_details.passing_percentage,
		"percentage": percentage,
		"is_open_ended": is_open_ended,
	}


def process_results(results: list, quiz_details: dict):
	is_open_ended = False

	for result in results:
		question_details = frappe.db.get_value(
			"LMS Quiz Question",
			{"parent": quiz_details.name, "question": result["question_name"]},
			["question", "marks", "question_detail", "type"],
			as_dict=1,
		)
		# The question must belong to this quiz. A stale/forged submission can name a row
		# that no longer resolves for quiz_details; reject cleanly instead of NoneType-500ing.
		if not question_details:
			frappe.throw(_("Invalid quiz results submitted."), frappe.ValidationError)

		# Normalise the answer to a non-empty list of strings so re.sub/join/[0] below can't
		# choke on a null/empty element (the UI sends [null] for a skipped open-ended answer).
		result["answer"] = [a if isinstance(a, str) else "" for a in (result.get("answer") or [])] or [""]

		result["question_name"] = question_details.question
		result["question"] = question_details.question_detail
		result["marks_out_of"] = question_details.marks

		if question_details.type != "Open Ended":
			if question_details.type == "User Input":
				correct = bool(check_input_answers(question_details.question, result["answer"][0]))
			else:
				correct = verify_answer(question_details.question, result["answer"])
			result["answer"] = ", ".join(result["answer"])
			if correct:
				result["marks"] = question_details.marks
			else:
				result["marks"] = -quiz_details.marks_to_cut if quiz_details.enable_negative_marking else 0
			result["is_correct"] = 1 if correct else 0

		else:
			is_open_ended = True
			result["is_correct"] = 0
			answer = re.sub(r'<img[^>]*src\s*=\s*["\'](?=data:)(.*?)["\']', _save_file, result["answer"][0])
			# Defense-in-depth: the answer is later rendered in the instructor's
			# privileged grading view (QuizSubmission.vue). The frontend already
			# wraps it in sanitizeRichHTML, but a student-controlled answer must
			# not be stored as live HTML that other surfaces could render raw.
			result["answer"] = sanitize_html(answer, always_sanitize=True)

	return {
		"results": results,
		"is_open_ended": is_open_ended,
	}


def verify_answer(question: str, answer: list):
	question_details = get_question_details(question)

	if question_details.multiple:
		for option_field, correctness_field in zip(
			QUESTION_OPTION_FIELDS, QUESTION_CORRECTNESS_FIELDS, strict=True
		):
			option = question_details[option_field]
			is_correct = question_details[correctness_field]
			if option in answer and not is_correct:
				return False
			if is_correct and option not in answer:
				return False
		return True

	correct = False
	for option_field, correctness_field in zip(
		QUESTION_OPTION_FIELDS, QUESTION_CORRECTNESS_FIELDS, strict=True
	):
		if question_details[option_field] in answer:
			correct = question_details[correctness_field]
	return correct


def _save_file(match: re.Match) -> str:
	data = match.group(1).split("data:")[1]
	headers, content = data.split(",")
	mtype = headers.split(";", 1)[0]

	if not mtype.lower().startswith("image/"):
		frappe.throw(_("Only image data is allowed in quiz answers."))

	if isinstance(content, str):
		content = content.encode("utf-8")
	if b"," in content:
		content = content.split(b",")[1]

	try:
		content = safe_b64decode(content)
	except BinasciiError:
		frappe.flags.has_dataurl = True
		return f'<img src="#broken-image" alt="{get_corrupted_image_msg()}"'

	if "filename=" in headers:
		filename = headers.split("filename=")[-1]
		filename = safe_decode(filename).split(";", 1)[0]

	else:
		filename = get_random_filename(content_type=mtype)

	if os.path.splitext(filename)[1].lower() not in ALLOWED_DATAURL_IMAGE_EXTENSIONS:
		frappe.throw(_("File type of {0} is not allowed in quiz answers.").format(escape_html(filename)))

	_file = frappe.get_doc(
		{
			"doctype": "File",
			"file_name": filename,
			"content": content,
			"decode": False,
			"is_private": False,
		}
	)
	_file.save(ignore_permissions=True)
	file_url = _file.unique_url
	frappe.flags.has_dataurl = True

	return f'<img src="{file_url}"'


def get_corrupted_image_msg():
	return _("Image: Corrupted Data Stream")


def create_submission(quiz: str, results: list, score_out_of: int, passing_percentage: float):
	submission = frappe.new_doc("LMS Quiz Submission")
	# Score and percentage are calculated by the controller function
	submission.update(
		{
			"doctype": "LMS Quiz Submission",
			"quiz": quiz,
			"result": results,
			"score": 0,
			"score_out_of": score_out_of,
			"member": frappe.session.user,
			"percentage": 0,
			"passing_percentage": passing_percentage,
		}
	)
	submission.save(ignore_permissions=True)
	return submission


def save_progress_after_quiz(quiz_details: dict, percentage: float):
	if not quiz_details.lesson or not quiz_details.course:
		return

	if quiz_details.passing_percentage and percentage < quiz_details.passing_percentage:
		return
	save_progress(quiz_details.lesson, quiz_details.course)


@frappe.whitelist()
def check_answer(quiz: str, question: str, question_type: str, answers: str):
	ADMIN_ROLES = ("System Manager", "Moderator", "Course Creator", "Batch Evaluator")
	is_admin = any(role in ADMIN_ROLES for role in frappe.get_roles())

	if not frappe.db.exists("LMS Quiz Question", {"parent": quiz, "question": question}):
		frappe.throw(_("Question not found in this quiz."), frappe.PermissionError)

	if not is_admin and not frappe.db.get_value("LMS Quiz", quiz, "show_answers"):
		frappe.throw(
			_("Live answer checking is not enabled for this quiz."),
			frappe.PermissionError,
		)

	answers = _parse_json_arg(answers, _("answers")) if answers else []
	if not isinstance(answers, list):
		frappe.throw(_("Invalid answers submitted."), frappe.ValidationError)

	if question_type == "Choices":
		return check_choice_answers(question, answers)

	# A blank input answer (empty list, or the [null] the UI emits for an untouched field)
	# scores as incorrect — coerce to "" so answers[0] can't IndexError / feed None onward.
	answer = answers[0] if answers else ""
	return check_input_answers(question, answer if isinstance(answer, str) else "")


def get_question_details(question: str):
	fields = ["multiple"] + QUESTION_OPTION_FIELDS + QUESTION_CORRECTNESS_FIELDS
	return frappe.db.get_value("LMS Question", question, fields, as_dict=1)


def check_choice_answers(question: str, answers: list):
	question_details = get_question_details(question)
	is_correct = []

	for option_field, correctness_field in zip(
		QUESTION_OPTION_FIELDS, QUESTION_CORRECTNESS_FIELDS, strict=True
	):
		if question_details[option_field] in answers:
			is_correct.append(question_details[correctness_field])
		elif question_details[correctness_field]:
			is_correct.append(2)
		else:
			is_correct.append(0)

	return is_correct


def check_input_answers(question: str, answer: str):
	question_details = frappe.db.get_value("LMS Question", question, QUESTION_POSSIBILITY_FIELDS, as_dict=1)
	for field in QUESTION_POSSIBILITY_FIELDS:
		possibility = question_details[field]
		if possibility and fuzz.token_sort_ratio(possibility, answer) > 85:
			return 1
	return 0
