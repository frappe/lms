"""Quiz payload normalisation and creation, moved from ``lms.lms.gateway_tools``.

Creation now only runs from an approved Copilot Proposal.
"""

import frappe
from frappe import _

from lms.copilot.content import append_block
from lms.copilot.validation import boolean, fail, integer, parse_object, required_text

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
MAX_QUESTIONS = 30


def max_question_values():
	"""LMS versions differ in how many option_N fields LMS Question has."""
	fields = frappe.get_meta("LMS Question").fields
	return len([field for field in fields if field.fieldname.startswith("option_")]) or 4


def _question_type(value, index):
	value = required_text(value, _("Question {0} type").format(index))
	question_type = QUESTION_TYPE_ALIASES.get(value.lower(), value)
	if question_type not in {"Choices", "User Input", "Open Ended"}:
		fail(_("Question {0} has an unsupported type.").format(index))
	return question_type


def _normalise_options(options, index):
	limit = max_question_values()
	if not isinstance(options, list) or not 2 <= len(options) <= limit:
		fail(_("Question {0} must have between 2 and {1} options.").format(index, limit))

	normalised = []
	for option_index, option in enumerate(options, 1):
		if isinstance(option, str):
			option = {"text": option, "is_correct": False}
		if not isinstance(option, dict):
			fail(_("Option {0} in question {1} must be an object.").format(option_index, index))
		explanation = option.get("explanation")
		normalised.append(
			{
				"text": required_text(
					option.get("text"), _("Option {0} in question {1}").format(option_index, index), 1000
				),
				"is_correct": boolean(
					option.get("is_correct", False),
					_("Correct flag for option {0} in question {1}").format(option_index, index),
				),
				"explanation": str(explanation)[:1000] if explanation else None,
			}
		)
	if not any(option["is_correct"] for option in normalised):
		fail(_("Question {0} must have at least one correct option.").format(index))
	return normalised


def _normalise_answers(answers, index):
	limit = max_question_values()
	if not isinstance(answers, list) or not 1 <= len(answers) <= limit:
		fail(_("Question {0} must have between 1 and {1} accepted answers.").format(index, limit))
	return [
		required_text(answer, _("Accepted answer {0} in question {1}").format(answer_index, index), 500)
		for answer_index, answer in enumerate(answers, 1)
	]


def _normalise_question(question, index):
	if not isinstance(question, dict):
		fail(_("Question {0} must be an object.").format(index))

	question_type = _question_type(question.get("type", "Choices"), index)
	normalised = {
		"text": required_text(
			question.get("text") or question.get("question"), _("Question {0}").format(index), 2000
		),
		"type": question_type,
		"marks": integer(question.get("marks", 1), _("Question {0} marks").format(index), minimum=1),
	}
	if question_type == "Choices":
		normalised["options"] = _normalise_options(question.get("options"), index)
	elif question_type == "User Input":
		normalised["answers"] = _normalise_answers(
			question.get("answers") or question.get("possibilities"), index
		)
	return normalised


def normalise_quiz(quiz):
	quiz = parse_object(quiz, _("Quiz"))
	questions = quiz.get("questions")
	if not isinstance(questions, list) or not questions:
		fail(_("Quiz must contain at least one question."))
	if len(questions) > MAX_QUESTIONS:
		fail(_("Quiz can contain at most {0} questions.").format(MAX_QUESTIONS))

	normalised_questions = [
		_normalise_question(question, index) for index, question in enumerate(questions, 1)
	]
	question_types = {question["type"] for question in normalised_questions}
	if "Open Ended" in question_types and len(question_types) > 1:
		fail(_("Open-ended questions cannot be mixed with other question types."))

	duration = quiz.get("duration")
	return {
		"title": required_text(quiz.get("title"), _("Quiz title"), 140),
		"passing_percentage": integer(
			quiz.get("passing_percentage", 70), _("Passing percentage"), maximum=100
		),
		"max_attempts": integer(quiz.get("max_attempts", 0), _("Maximum attempts")),
		"duration": (
			None if duration is None or duration == "" else integer(duration, _("Duration"), minimum=1)
		),
		"show_answers": boolean(quiz.get("show_answers", True), _("Show answers")),
		"show_submission_history": boolean(
			quiz.get("show_submission_history", False), _("Show submission history")
		),
		"shuffle_questions": boolean(quiz.get("shuffle_questions", False), _("Shuffle questions")),
		"limit_questions_to": integer(quiz.get("limit_questions_to", 0), _("Question limit")),
		"enable_negative_marking": boolean(
			quiz.get("enable_negative_marking", False), _("Enable negative marking")
		),
		"marks_to_cut": integer(quiz.get("marks_to_cut", 1), _("Marks to deduct")),
		"questions": normalised_questions,
	}


def quiz_preview_lines(quiz):
	lines = [f"+ [Quiz] {quiz['title']} · {len(quiz['questions'])} question(s)"]
	for index, question in enumerate(quiz["questions"], 1):
		lines.append(f"+   {index}. ({question['type']}, {question['marks']}) {question['text']}")
		for option in question.get("options", []):
			marker = "✓" if option["is_correct"] else "·"
			lines.append(f"+      {marker} {option['text']}")
		for answer in question.get("answers", []):
			lines.append(f"+      = {answer}")
	return lines


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


def create_quiz_in_lesson(lesson, quiz_data):
	"""Create the quiz and append it to the lesson. Callers check permission first."""
	question_docs = [_create_question(question) for question in quiz_data["questions"]]
	quiz_doc = frappe.new_doc("LMS Quiz")
	quiz_doc.update({key: value for key, value in quiz_data.items() if key != "questions"})
	for question, question_doc in zip(quiz_data["questions"], question_docs, strict=True):
		quiz_doc.append("questions", {"question": question_doc.name, "marks": question["marks"]})
	quiz_doc.insert(ignore_permissions=True)

	lesson_doc = frappe.get_doc("Course Lesson", lesson)
	block = {"id": frappe.generate_hash(length=10), "type": "quiz", "data": {"quiz": quiz_doc.name}}
	lesson_doc.content = append_block(lesson_doc.content, block)
	lesson_doc.save(ignore_permissions=True)

	return {
		"course": lesson_doc.course,
		"lesson": lesson_doc.name,
		"quiz": quiz_doc.name,
		"title": quiz_doc.title,
		"total_marks": quiz_doc.total_marks,
		"questions": [question.name for question in question_docs],
		"block_id": block["id"],
	}
