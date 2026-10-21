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

# Each LMS Question carries up to 10 option/correctness/explanation/possibility
# columns. Keep these lists as the single source of truth so any future change
# to cardinality touches one place.
QUESTION_OPTION_FIELDS = [f"option_{i}" for i in range(1, 11)]
QUESTION_CORRECTNESS_FIELDS = [f"is_correct_{i}" for i in range(1, 11)]
QUESTION_EXPLANATION_FIELDS = [f"explanation_{i}" for i in range(1, 11)]
QUESTION_POSSIBILITY_FIELDS = [f"possibility_{i}" for i in range(1, 11)]

# Prompt/options ship with the quiz attempt; explanations are answer-key material
# and are gated harder (see can_view_quiz_answers).
STUDENT_QUESTION_FIELDS = ("question", *QUESTION_OPTION_FIELDS)
QUESTION_MEDIA_FIELDS = (*STUDENT_QUESTION_FIELDS, *QUESTION_EXPLANATION_FIELDS)


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
	explanation_only: bool
	attached: bool
	owner: str | None
	canonical: bool
	untouched: bool


def _names_containing_url(file_url: str, fields: tuple[str, ...]) -> list[str]:
	"""Questions whose any of `fields` contain file_url, in one LOCATE query."""
	if not fields:
		return []
	question = frappe.qb.DocType("LMS Question")
	criterion = Locate(file_url, question[fields[0]]) > 0
	for field in fields[1:]:
		criterion |= Locate(file_url, question[field]) > 0
	return frappe.qb.from_(question).select(question.name).where(criterion).run(pluck=True)


def _attachment_is_explanation_only(attached_to_field: str | None) -> bool:
	"""Whether a File attachment should be gated like answer-key media.

	Empty/unknown field → explanation-only (fail closed). Only an explicit
	prompt/option field marks the attachment as student-visible on its own.
	"""
	if not attached_to_field:
		return True
	if attached_to_field in QUESTION_EXPLANATION_FIELDS:
		return True
	if attached_to_field in STUDENT_QUESTION_FIELDS:
		return False
	return True


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
			"attached_to_field",
		],
		order_by="creation asc, name asc",
	)
	canonical_owner = file_rows[0].owner if file_rows else None

	refs = [
		_QuestionReference(
			question=r.attached_to_name,
			# Fail closed on empty/unknown attached_to_field: an explanation image
			# that is also attached (with no field) must not clear explanation_only
			# and skip can_view_quiz_answers. A genuine prompt cite still clears the
			# flag via the student-field content search below.
			explanation_only=_attachment_is_explanation_only(r.attached_to_field),
			attached=True,
			owner=r.owner,
			canonical=r.owner == canonical_owner,
			untouched=r.creation == r.modified,
		)
		for r in file_rows
		if r.attached_to_doctype == "LMS Question" and r.attached_to_name
	]

	for name in _names_containing_url(file_url, STUDENT_QUESTION_FIELDS):
		refs.append(_QuestionReference(name, False, False, canonical_owner, True, True))
	for name in _names_containing_url(file_url, tuple(QUESTION_EXPLANATION_FIELDS)):
		refs.append(_QuestionReference(name, True, False, canonical_owner, True, True))

	return refs


def _questions_vouched_by_owner(references: list[_QuestionReference]) -> dict[str, bool]:
	"""Vouched question names → whether only explanation fields cite the bytes.

	Only the canonical File row (the upload of the bytes) may speak. Saving a
	question that pastes another user's /private/files/ url makes Frappe insert a
	second File row attached to the question and owned by the paster
	(attach_files_to_document). That row must not vouch: its owner authors the
	question, but they did not upload the bytes.

	A canonical reference vouches when its owner currently authors the question,
	or when they placed an attachment themselves (they own the question, or the
	File row has never been edited).
	"""
	if not references:
		return {}

	question_names = {ref.question for ref in references}
	owners = frappe.db.get_all(
		"LMS Question",
		filters={"name": ("in", list(question_names))},
		fields=["name", "owner"],
	)
	question_owner = {row.name: row.owner for row in owners}

	# question → explanation_only. A student-visible cite clears the flag.
	vouched: dict[str, bool] = {}
	for ref in references:
		if not ref.owner or not ref.canonical:
			continue
		if not is_content_author("LMS Question", ref.question, ref.owner):
			placed_by_uploader = ref.attached and question_owner.get(ref.question) is not None
			if not (placed_by_uploader and (question_owner[ref.question] == ref.owner or ref.untouched)):
				continue
		if ref.question not in vouched:
			vouched[ref.question] = ref.explanation_only
		elif not ref.explanation_only:
			vouched[ref.question] = False
	return vouched


def _learner_may_receive_question_media(quiz: str, *, explanation_only: bool) -> bool:
	"""Same visibility rules as get_quiz_with_questions for the bytes in question.

	`can_access_quiz` alone is not enough: scheduling withholds the question list,
	and explanations are answer-key material gated by can_view_quiz_answers.
	"""
	from lms.lms.schedule_utils import get_schedule_block_reason
	from lms.lms.utils import PRIVILEGED_ROLES, can_view_quiz_answers

	if not can_access_quiz(quiz):
		return False

	row = frappe.db.get_value(
		"LMS Quiz",
		quiz,
		["enable_scheduling", "schedule_start", "schedule_end", "show_answers"],
		as_dict=True,
	)
	if not row:
		return False

	privileged = bool(PRIVILEGED_ROLES & set(frappe.get_roles()))
	if (
		get_schedule_block_reason(row.enable_scheduling, row.schedule_start, row.schedule_end)
		and not privileged
	):
		return False

	if explanation_only and not can_view_quiz_answers(quiz, row.show_answers):
		return False

	return True


def _deny_question_resource(file_url, reason):
	frappe.logger("lms.security").warning(
		"Question resource access denied: user=%s file_url=%s reason=%s",
		frappe.session.user,
		file_url,
		reason,
	)


# Same ceiling rationale as lesson serve_resource: charged per asset, shared NAT,
# broken <img> on 429 with no toast. Enumeration is held off by the visibility gate.
@frappe.whitelist()
@rate_limit(limit=20000, seconds=60 * 60)
def serve_question_resource(file_url: str):
	"""Access-gated streaming of private quiz-question media.

	Native /private/files/ needs a File read the learner does not hold, so
	get_quiz_with_questions rewrites embedded URLs here. The owning question is
	resolved from its HTML fields (and any File attachment), vouched to the
	uploader/author, then gated by the same visibility rules that deliver the
	question HTML (quiz access, schedule window, answer-key for explanations).
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

	vouched = _questions_vouched_by_owner(references)
	if not vouched:
		_deny_question_resource(file_url, "no referencing question is authored by the file owner")
		raise frappe.PermissionError

	# A quiz that only cites the file via an explanation needs answer visibility;
	# if any vouched question cites it from the prompt/options, treat as student media.
	placements = frappe.get_all(
		"LMS Quiz Question",
		filters={"question": ("in", list(vouched))},
		fields=["parent", "question"],
	)
	quiz_explanation_only: dict[str, bool] = {}
	for row in placements:
		explanation_only = vouched[row.question]
		if row.parent not in quiz_explanation_only:
			quiz_explanation_only[row.parent] = explanation_only
		elif not explanation_only:
			quiz_explanation_only[row.parent] = False

	if not quiz_explanation_only:
		_deny_question_resource(file_url, "question not placed in any quiz")
		raise frappe.PermissionError

	if not any(
		_learner_may_receive_question_media(quiz, explanation_only=explanation_only)
		for quiz, explanation_only in quiz_explanation_only.items()
	):
		_deny_question_resource(file_url, "question media visibility denied for all quizzes")
		raise frappe.PermissionError

	relative_path = file_url.split("/private", 1)[1] if "/private" in file_url else file_url
	return _serve_private_file(relative_path, file_row.file_name)
