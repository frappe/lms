# Copyright (c) 2023, Frappe and contributors
# For license information, please see license.txt

from typing import NamedTuple
from urllib.parse import unquote

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.query_builder.functions import Locate
from frappe.rate_limiter import rate_limit

from lms.lms.doctype.lms_content_author.lms_content_author import AuthoredDocument
from lms.lms.permissions import can_access_quiz, is_content_author
from lms.lms.utils import has_moderator_role, moderators_among

# Each LMS Question carries up to 10 option/correctness/explanation/possibility
# columns. Keep these lists as the single source of truth so any future change
# to cardinality touches one place.
QUESTION_OPTION_FIELDS = [f"option_{i}" for i in range(1, 11)]
QUESTION_CORRECTNESS_FIELDS = [f"is_correct_{i}" for i in range(1, 11)]
QUESTION_EXPLANATION_FIELDS = [f"explanation_{i}" for i in range(1, 11)]
QUESTION_POSSIBILITY_FIELDS = [f"possibility_{i}" for i in range(1, 11)]

# HTML-bearing fields that may embed private editor uploads. Options and
# explanations are usually plain text today; searching them keeps a future rich
# option/explanation path from silently 403ing the same way lesson media once did.
QUESTION_MEDIA_FIELDS = ("question", *QUESTION_OPTION_FIELDS, *QUESTION_EXPLANATION_FIELDS)


class LMSQuestion(AuthoredDocument, Document):
	def validate(self):
		validate_correct_answers(self)
		update_question_title(self)


def validate_correct_answers(question):
	if question.type == "Choices":
		validate_duplicate_options(question)
		validate_minimum_options(question)
		validate_correct_options(question)
	elif question.type == "User Input":
		validate_possible_answer(question)


def validate_duplicate_options(question):
	options = [question.get(f) for f in QUESTION_OPTION_FIELDS if question.get(f)]
	if len(set(options)) != len(options):
		frappe.throw(_("Duplicate options found for this question."))


def validate_correct_options(question):
	correct_options = get_correct_options(question)

	if len(correct_options) > 1:
		question.multiple = 1
	else:
		question.multiple = 0

	if not len(correct_options):
		frappe.throw(_("At least one option must be correct for this question."))


def validate_minimum_options(question):
	if question.type == "Choices" and (not question.option_1 or not question.option_2):
		frappe.throw(_("Minimum two options are required for multiple choice questions."))


def validate_possible_answer(question):
	if not any(question.get(f) for f in QUESTION_POSSIBILITY_FIELDS):
		frappe.throw(
			_("Add at least one possible answer for this question: {0}").format(
				frappe.bold(question.question)
			)
		)


def update_question_title(question):
	if not question.is_new():
		question_rows = frappe.get_all("LMS Quiz Question", {"question": question.name}, pluck="name")

		for row in question_rows:
			frappe.db.set_value("LMS Quiz Question", row, "question_detail", question.question)


def get_correct_options(question):
	return [f for f in QUESTION_CORRECTNESS_FIELDS if question.get(f) == 1]


class _QuestionReference(NamedTuple):
	"""One claim that `question` uses the bytes, plus the evidence behind the claim."""

	question: str
	attached: bool
	owner: str | None
	canonical: bool
	untouched: bool


def _resolve_question_references(file_url: str) -> list[_QuestionReference]:
	"""Every LMS Question reference to file_url, from attachments and content search.

	Rich-text uploads are frequently private-but-unattached, so the question body is
	the source of truth — same shape as lesson serve_resource.
	"""
	file_rows = frappe.db.get_all(
		"File",
		filters={"file_url": file_url, "is_private": 1},
		fields=[
			"owner",
			"creation",
			"modified",
			"attached_to_doctype",
			"attached_to_name",
		],
		order_by="creation asc, name asc",
	)
	canonical_owner = file_rows[0].owner if file_rows else None

	refs = [
		_QuestionReference(
			question=r.attached_to_name,
			attached=True,
			owner=r.owner,
			canonical=r.owner == canonical_owner,
			untouched=r.creation == r.modified,
		)
		for r in file_rows
		if r.attached_to_doctype == "LMS Question" and r.attached_to_name
	]

	question = frappe.qb.DocType("LMS Question")
	for field in QUESTION_MEDIA_FIELDS:
		names = (
			frappe.qb.from_(question)
			.select(question.name)
			.where(Locate(file_url, question[field]) > 0)
			.run(pluck=True)
		)
		for name in names:
			refs.append(_QuestionReference(name, False, canonical_owner, True, True))

	return refs


def _questions_vouched_by_owner(references: list[_QuestionReference]) -> set[str]:
	"""Question names entitled to speak for the bytes.

	A reference vouches only when its owner uploaded the bytes (canonical File row)
	and currently authors the question — or, for an attachment they placed and never
	edited, when they own the question document. Borrowed File rows (later inserts
	that only name the url) are kept solely while their owner is still a Moderator.
	"""
	if not references:
		return set()

	question_names = {ref.question for ref in references}
	owners = frappe.db.get_all(
		"LMS Question",
		filters={"name": ("in", list(question_names))},
		fields=["name", "owner"],
	)
	question_owner = {row.name: row.owner for row in owners}

	borrowed = {ref.owner for ref in references if ref.attached and not ref.canonical}
	trusted = references
	if borrowed:
		moderators = moderators_among(borrowed)
		trusted = [ref for ref in references if ref.canonical or ref.owner in moderators]

	vouched = set()
	for ref in trusted:
		if not ref.owner:
			continue
		if is_content_author("LMS Question", ref.question, ref.owner) or has_moderator_role(
			ref.owner
		):
			vouched.add(ref.question)
			continue
		placed_by_uploader = (
			ref.attached and ref.canonical and question_owner.get(ref.question) is not None
		)
		if placed_by_uploader and (question_owner[ref.question] == ref.owner or ref.untouched):
			vouched.add(ref.question)
	return vouched


def _quizzes_for_questions(questions: set[str]) -> list[str]:
	if not questions:
		return []
	return frappe.get_all(
		"LMS Quiz Question",
		filters={"question": ("in", list(questions))},
		pluck="parent",
	)


def _deny_question_resource(file_url, reason):
	frappe.logger("lms.security").warning(
		"Question resource access denied: user=%s file_url=%s reason=%s",
		frappe.session.user,
		file_url,
		reason,
	)


# Same ceiling rationale as lesson serve_resource: charged per asset, shared NAT,
# broken <img> on 429 with no toast. Enumeration is held off by can_access_quiz.
@frappe.whitelist()
@rate_limit(limit=20000, seconds=60 * 60)
def serve_question_resource(file_url: str):
	"""Access-gated streaming of private quiz-question media.

	Native /private/files/ needs a File read the learner does not hold, so
	get_quiz_with_questions rewrites embedded URLs here. The owning question is
	resolved from its HTML fields (and any File attachment), vouched to the
	uploader/author, then gated by can_access_quiz on any quiz that includes it.
	"""
	# Local import: course_lesson imports from utils at module load in places that
	# would cycle if lms_question imported _serve_private_file at the top.
	from lms.lms.doctype.course_lesson.course_lesson import _serve_private_file

	if not isinstance(file_url, str):
		frappe.throw(_("file_url must be a string"))

	file_url = unquote(file_url)

	if ".." in file_url:
		frappe.throw(_("Invalid file path"))

	file_row = frappe.db.get_value(
		"File", {"file_url": file_url, "is_private": 1}, ["file_name"], as_dict=True
	)
	if not file_row:
		_deny_question_resource(file_url, "no matching private file")
		raise frappe.PermissionError

	references = _resolve_question_references(file_url)
	if not references:
		_deny_question_resource(file_url, "file not referenced by any question")
		raise frappe.PermissionError

	questions = _questions_vouched_by_owner(references)
	if not questions:
		_deny_question_resource(file_url, "no referencing question is authored by the file owner")
		raise frappe.PermissionError

	quizzes = _quizzes_for_questions(questions)
	if not quizzes:
		_deny_question_resource(file_url, "question not placed in any quiz")
		raise frappe.PermissionError

	if not any(can_access_quiz(quiz) for quiz in quizzes):
		_deny_question_resource(file_url, "can_access_quiz denied for all quizzes")
		raise frappe.PermissionError

	relative_path = file_url.split("/private", 1)[1] if "/private" in file_url else file_url
	return _serve_private_file(relative_path, file_row.file_name)
