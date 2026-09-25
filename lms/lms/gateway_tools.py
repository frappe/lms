"""Narrow LMS operations intended for trusted automation gateways."""

import json

import frappe
from frappe import _

from lms.lms.utils import can_modify_course


QUESTION_TYPE_ALIASES = {
	"choices": "Choices",
	"choice": "Choices",
	"single_choice": "Choices",
	"multiple_choice": "Choices",
	"user input": "User Input",
	"user_input": "User Input",
	"short_answer": "User Input",
	"open ended": "Open Ended",
	"open_ended": "Open Ended",
	"essay": "Open Ended",
}
MAX_QUESTION_VALUES = 10


def _validation_error(message):
	frappe.throw(message, frappe.ValidationError)


def _parse_object(value, label):
	if isinstance(value, str):
		try:
			value = json.loads(value)
		except (TypeError, ValueError):
			_validation_error(_("{0} must be valid JSON.").format(label))
	if not isinstance(value, dict):
		_validation_error(_("{0} must be an object.").format(label))
	return value


def _required_text(value, label):
	if not isinstance(value, str) or not value.strip():
		_validation_error(_("{0} is required.").format(label))
	return value.strip()


def _integer(value, label, minimum=0, maximum=None):
	if isinstance(value, bool):
		_validation_error(_("{0} must be a whole number.").format(label))
	try:
		parsed = int(value)
	except (TypeError, ValueError):
		_validation_error(_("{0} must be a whole number.").format(label))
	if str(value).strip() not in {str(parsed), f"{parsed}.0"} and not isinstance(value, int):
		_validation_error(_("{0} must be a whole number.").format(label))
	if parsed < minimum or (maximum is not None and parsed > maximum):
		if maximum is None:
			_validation_error(_("{0} must be at least {1}.").format(label, minimum))
		_validation_error(_("{0} must be between {1} and {2}.").format(label, minimum, maximum))
	return parsed


def _boolean(value, label):
	if isinstance(value, bool):
		return int(value)
	if isinstance(value, int) and value in {0, 1}:
		return value
	if isinstance(value, str) and value.strip().lower() in {"true", "false", "1", "0"}:
		return int(value.strip().lower() in {"true", "1"})
	_validation_error(_("{0} must be true or false.").format(label))


def _question_type(value, index):
	value = _required_text(value, _("Question {0} type").format(index))
	question_type = QUESTION_TYPE_ALIASES.get(value.lower(), value)
	if question_type not in {"Choices", "User Input", "Open Ended"}:
		_validation_error(_("Question {0} has an unsupported type.").format(index))
	return question_type


def _normalise_options(options, index):
	if not isinstance(options, list) or not 2 <= len(options) <= MAX_QUESTION_VALUES:
		_validation_error(
			_("Question {0} must have between 2 and {1} options.").format(index, MAX_QUESTION_VALUES)
		)

	normalised = []
	for option_index, option in enumerate(options, 1):
		if isinstance(option, str):
			option = {"text": option, "is_correct": False}
		if not isinstance(option, dict):
			_validation_error(_("Option {0} in question {1} must be an object.").format(option_index, index))
		normalised.append(
			{
				"text": _required_text(
					option.get("text"), _("Option {0} in question {1}").format(option_index, index)
				),
				"is_correct": _boolean(
					option.get("is_correct", False),
					_("Correct flag for option {0} in question {1}").format(option_index, index),
				),
				"explanation": option.get("explanation"),
			}
		)
	if not any(option["is_correct"] for option in normalised):
		_validation_error(_("Question {0} must have at least one correct option.").format(index))
	return normalised


def _normalise_answers(answers, index):
	if not isinstance(answers, list) or not 1 <= len(answers) <= MAX_QUESTION_VALUES:
		_validation_error(
			_("Question {0} must have between 1 and {1} accepted answers.").format(
				index, MAX_QUESTION_VALUES
			)
		)
	return [
		_required_text(answer, _("Accepted answer {0} in question {1}").format(answer_index, index))
		for answer_index, answer in enumerate(answers, 1)
	]


def _normalise_question(question, index):
	if not isinstance(question, dict):
		_validation_error(_("Question {0} must be an object.").format(index))

	question_type = _question_type(question.get("type", "Choices"), index)
	normalised = {
		"text": _required_text(question.get("text") or question.get("question"), _("Question {0}").format(index)),
		"type": question_type,
		"marks": _integer(question.get("marks", 1), _("Question {0} marks").format(index), minimum=1),
	}
	if question_type == "Choices":
		normalised["options"] = _normalise_options(question.get("options"), index)
	elif question_type == "User Input":
		normalised["answers"] = _normalise_answers(
			question.get("answers") or question.get("possibilities"), index
		)
	return normalised


def _normalise_quiz(quiz):
	quiz = _parse_object(quiz, _("Quiz"))
	questions = quiz.get("questions")
	if not isinstance(questions, list) or not questions:
		_validation_error(_("Quiz must contain at least one question."))

	normalised_questions = [
		_normalise_question(question, index) for index, question in enumerate(questions, 1)
	]
	question_types = {question["type"] for question in normalised_questions}
	if "Open Ended" in question_types and len(question_types) > 1:
		_validation_error(_("Open-ended questions cannot be mixed with other question types."))

	duration = quiz.get("duration")
	return {
		"title": _required_text(quiz.get("title"), _("Quiz title")),
		"passing_percentage": _integer(
			quiz.get("passing_percentage", 70), _("Passing percentage"), maximum=100
		),
		"max_attempts": _integer(quiz.get("max_attempts", 0), _("Maximum attempts")),
		"duration": (
			None if duration is None or duration == "" else _integer(duration, _("Duration"), minimum=1)
		),
		"show_answers": _boolean(quiz.get("show_answers", True), _("Show answers")),
		"show_submission_history": _boolean(
			quiz.get("show_submission_history", False), _("Show submission history")
		),
		"shuffle_questions": _boolean(quiz.get("shuffle_questions", False), _("Shuffle questions")),
		"limit_questions_to": _integer(
			quiz.get("limit_questions_to", 0), _("Question limit")
		),
		"enable_negative_marking": _boolean(
			quiz.get("enable_negative_marking", False), _("Enable negative marking")
		),
		"marks_to_cut": _integer(quiz.get("marks_to_cut", 1), _("Marks to deduct")),
		"questions": normalised_questions,
	}


def _create_question(question):
	doc = frappe.new_doc("LMS Question")
	doc.update({"question": question["text"], "type": question["type"]})
	for index, option in enumerate(question.get("options", []), 1):
		doc.set(f"option_{index}", option["text"])
		doc.set(f"is_correct_{index}", option["is_correct"])
		doc.set(f"explanation_{index}", option["explanation"])
	for index, answer in enumerate(question.get("answers", []), 1):
		doc.set(f"possibility_{index}", answer)
	doc.insert(ignore_permissions=True)
	return doc


def _append_quiz_block(content, quiz_name):
	if content:
		try:
			editor_data = json.loads(content)
		except (TypeError, ValueError):
			_validation_error(_("Lesson content is not valid EditorJS JSON."))
		if not isinstance(editor_data, dict) or not isinstance(editor_data.get("blocks"), list):
			_validation_error(_("Lesson content is not a valid EditorJS document."))
	else:
		editor_data = {"blocks": [], "version": "2.29.0"}

	editor_data["blocks"].append(
		{
			"id": frappe.generate_hash(length=10),
			"type": "quiz",
			"data": {"quiz": quiz_name},
		}
	)
	return frappe.as_json(editor_data)


@frappe.whitelist(methods=["POST"])
def create_lesson_quiz(lesson: str, quiz: dict):
	"""Create a quiz with its questions and append it to a lesson.

	``quiz.questions`` accepts ``Choices`` questions with ``options``, ``User Input``
	questions with ``answers``, and ``Open Ended`` questions. The operation is
	transactional and is restricted to users who may modify the lesson's course.
	"""
	lesson = _required_text(lesson, _("Lesson"))
	lesson_details = frappe.db.get_value("Course Lesson", lesson, ["name", "course"], as_dict=True)
	if not lesson_details:
		frappe.throw(_("Lesson not found."), frappe.DoesNotExistError)
	if not can_modify_course(lesson_details.course):
		frappe.throw(
			_("You do not have permission to add a quiz to this lesson."), frappe.PermissionError
		)

	quiz_data = _normalise_quiz(quiz)
	savepoint = f"create_lesson_quiz_{frappe.generate_hash(length=8)}"
	frappe.db.savepoint(savepoint)
	try:
		question_docs = [_create_question(question) for question in quiz_data["questions"]]
		quiz_doc = frappe.new_doc("LMS Quiz")
		quiz_doc.update({key: value for key, value in quiz_data.items() if key != "questions"})
		for question, question_doc in zip(quiz_data["questions"], question_docs, strict=True):
			quiz_doc.append("questions", {"question": question_doc.name, "marks": question["marks"]})
		quiz_doc.insert(ignore_permissions=True)

		lesson_doc = frappe.get_doc("Course Lesson", lesson)
		lesson_doc.content = _append_quiz_block(lesson_doc.content, quiz_doc.name)
		lesson_doc.save(ignore_permissions=True)
	except Exception:
		frappe.db.rollback(save_point=savepoint)
		raise

	return {
		"course": lesson_details.course,
		"lesson": lesson_doc.name,
		"quiz": quiz_doc.name,
		"title": quiz_doc.title,
		"total_marks": quiz_doc.total_marks,
		"questions": [question.name for question in question_docs],
	}
