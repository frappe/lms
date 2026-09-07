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
from frappe.utils import (
	cint,
	comma_and,
	convert_utc_to_system_timezone,
	escape_html,
	get_datetime,
	now_datetime,
)
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
# permitted. A data: URI with an active-document extension (.xhtml, .xsl, .html,
# .js, …) would otherwise be written to the public /files/ dir and served inline,
# enabling stored XSS on the LMS origin. SVG is excluded (script-bearing).
ALLOWED_DATAURL_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp"}

VIOLATION_EVENT_TYPES = {"tab_switch", "no_face", "multiple_faces", "focus_loss", "camera_disconnect"}
SUBMISSION_REASONS = {"manual", "timer_expired", "max_violations", "browser_closed"}
# One attempt cannot plausibly produce more proctoring events than this; the rest is a flood.
MAX_VIOLATION_EVENTS = 500
# Proctoring frames are ~320px JPEGs, so a frame past this is not a frame. Held as a
# data: URI length because that is the form it arrives in, and rejecting it before the
# base64 is decoded is what keeps a hostile payload cheap.
MAX_VIOLATION_FRAME_CHARS = 400_000
MAX_VIOLATION_FRAME_BYTES = 250 * 1024
# Per attempt, not per event: an attempt that trips two hundred times does not need two
# hundred stills to show what happened.
MAX_VIOLATION_FRAMES = 40


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
	list) with a clean validation error. A blank/null answer element is NOT rejected here: the
	UI legitimately emits answer=[null] for a skipped open-ended question; process_results
	normalises those to "" so a student can still submit a partially-answered quiz."""
	for result in results:
		if not (isinstance(result, dict) and result.get("question_name")):
			frappe.throw(_("Invalid quiz results submitted."), frappe.ValidationError)
		answer = result.get("answer")
		if answer is not None and not isinstance(answer, list):
			frappe.throw(_("Invalid quiz results submitted."), frappe.ValidationError)


@frappe.whitelist()
def submit_quiz(
	quiz: str,
	results: str | None = None,
	violation_count: int = 0,
	submission_reason: str = "manual",
	violation_events: str | None = None,
):
	if not isinstance(quiz, str):
		frappe.throw(_("Invalid quiz."), frappe.ValidationError)

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
			"enable_proctoring",
			"max_violations",
		],
		as_dict=1,
	)
	if not quiz_details:
		frappe.throw(_("Invalid quiz."), frappe.ValidationError)

	from lms.lms.permissions import can_access_quiz

	if not can_access_quiz(quiz):
		frappe.throw(_("You are not authorized to submit this quiz."), frappe.PermissionError)

	data = process_results(results, quiz_details)
	is_open_ended = data["is_open_ended"]

	proctoring = _build_proctoring_record(quiz_details, violation_count, submission_reason, violation_events)

	# Score and percentage are the submission's responsibility. Its validate()
	# runs validate_marks() + set_percentage() on save. Read them back rather
	# than recomputing here, so the two paths can't drift.
	submission = create_submission(
		quiz,
		data["results"],
		quiz_details.total_marks,
		quiz_details.passing_percentage,
		violation_count=proctoring["violation_count"],
		submission_reason=proctoring["submission_reason"],
	)
	percentage = submission.percentage or 0
	save_progress_after_quiz(quiz_details, percentage)

	_save_violation_events(submission.name, proctoring["events"])

	return {
		"score": submission.score,
		"score_out_of": submission.score_out_of,
		"submission": submission.name,
		"pass": percentage >= quiz_details.passing_percentage,
		"percentage": percentage,
		"is_open_ended": is_open_ended,
	}


def _build_proctoring_record(
	quiz_details: dict,
	violation_count: int,
	submission_reason: str,
	violation_events: str | None,
) -> dict:
	"""Decide what proctoring evidence is actually stored for a submission.

	Every field here is reported by the learner's own browser, so the fields are checked against
	each other rather than believed one at a time. The event log is treated as the record and the
	stored count is derived from it, so a learner cannot log five tab switches and report zero,
	nor inflate a count past the events behind it. A caller that sends no event list at all (the
	pagehide beacon) keeps its reported count — there is nothing to derive from — but still cannot
	claim a reason its count does not support.

	What cross-checking cannot do is catch a client that reports nothing. An empty event list with
	a zero count is indistinguishable from an attempt that had nothing to report, and no rule here
	can separate them while the browser is the only witness — tightening one field only moves
	which field a tampered client has to lie about. So a clean log is the absence of evidence, not
	evidence of absence. Making silence itself suspicious takes a client that checks in on a
	schedule, so that a gap in the trail is the finding.
	"""
	reason = submission_reason if submission_reason in SUBMISSION_REASONS else "manual"

	if not quiz_details.enable_proctoring:
		# Nothing was being watched, so there is no evidence to keep whatever the client sent.
		return {
			"violation_count": 0,
			"submission_reason": "manual" if reason == "max_violations" else reason,
			"events": [],
		}

	events = _normalise_violation_events(violation_events)
	if violation_events:
		count = sum(1 for event in events if event["severity"] == "violation")
	else:
		count = cint(violation_count)

	max_violations = cint(quiz_details.max_violations)
	# The count is the evidence; make the reason agree with it in both directions.
	if max_violations and count >= max_violations:
		reason = "max_violations"
	elif reason == "max_violations":
		reason = "manual"

	return {"violation_count": count, "submission_reason": reason, "events": events}


def _normalise_violation_events(raw_events: str | None) -> list[dict]:
	"""Coerce the client's event list into rows we are willing to store: a known event type, a
	known severity, and a timestamp that cannot be in the future."""
	if not raw_events:
		return []

	events = _parse_json_arg(raw_events, _("violation events"))
	if not isinstance(events, list):
		frappe.throw(_("Invalid violation events submitted."), frappe.ValidationError)

	received_at = now_datetime()
	normalised = []
	for event in events[:MAX_VIOLATION_EVENTS]:
		if not isinstance(event, dict):
			continue
		event_type = event.get("eventType") or event.get("event_type")
		if event_type not in VIOLATION_EVENT_TYPES:
			continue
		severity = event.get("severity")
		normalised.append(
			{
				"event_type": event_type,
				"severity": severity if severity in ("violation", "warning") else "violation",
				"timestamp": _violation_event_timestamp(event.get("timestamp"), received_at),
				"frame": _violation_event_frame(event.get("frame")),
			}
		)
	return normalised


def _violation_event_frame(raw_frame):
	"""Keep the camera still only if it is plausibly one. Anything else is dropped rather than
	thrown for: the frame is supporting evidence, and losing it must not cost the submission."""
	if not isinstance(raw_frame, str):
		return None
	if not raw_frame.startswith("data:image/"):
		return None
	if len(raw_frame) > MAX_VIOLATION_FRAME_CHARS:
		return None
	return raw_frame


def _violation_event_timestamp(raw_timestamp, received_at):
	"""JS sends Date.toISOString(), which is always UTC — store it in the site's timezone so the
	instructor's activity table reads in the same clock as every other date on the page. A stamp
	we cannot parse, or one from a client clock running ahead of ours, becomes the receive time."""
	if not raw_timestamp:
		return received_at
	try:
		timestamp = convert_utc_to_system_timezone(get_datetime(raw_timestamp)).replace(tzinfo=None)
	except Exception:
		return received_at
	return received_at if not timestamp or timestamp > received_at else timestamp


def _save_violation_events(submission_name: str, events: list[dict]):
	"""Best effort. The graded submission is already saved and carries the headline
	violation_count, so losing the detail log must not fail the learner's submission."""
	if not events:
		return

	user = frappe.session.user
	now = now_datetime()
	# Names are ours to choose, so they are kept: the camera stills are attached to these
	# rows afterwards, and bulk_insert hands nothing back to attach them to.
	names = [frappe.generate_hash(length=10) for _ in events]
	rows = [
		(
			name,
			now,  # creation
			now,  # modified
			user,  # modified_by
			user,  # owner
			0,  # docstatus
			0,  # idx
			submission_name,  # quiz_submission
			event["event_type"],
			event["severity"],
			event["timestamp"],
		)
		for name, event in zip(names, events, strict=True)
	]
	try:
		frappe.db.bulk_insert(
			"LMS Quiz Violation Log",
			fields=[
				"name",
				"creation",
				"modified",
				"modified_by",
				"owner",
				"docstatus",
				"idx",
				"quiz_submission",
				"event_type",
				"severity",
				"timestamp",
			],
			values=rows,
		)
	except Exception:
		frappe.log_error(title=f"Could not save quiz violation events for {submission_name}")
		return

	_attach_violation_frames(names, events)


def _attach_violation_frames(names: list[str], events: list[dict]):
	"""Store each camera still as a private File hung off its own log row, so a frame is
	reachable only through the row it belongs to and inherits that row's audience.

	Best effort for the same reason as the log itself: a frame that will not decode is not
	worth failing a graded submission over."""
	saved = 0
	for name, event in zip(names, events, strict=True):
		if saved >= MAX_VIOLATION_FRAMES:
			break
		if not event.get("frame"):
			continue
		try:
			if _save_violation_frame(name, event["frame"]):
				saved += 1
		except Exception:
			frappe.log_error(title=f"Could not save proctoring frame for {name}")


def _save_violation_frame(log_name: str, data_url: str) -> bool:
	"""Decode one data: URI onto a private File attached to log_name. Returns whether it
	was stored."""
	headers, separator, content = data_url.partition(",")
	if not separator or not content:
		return False

	mimetype = headers.split("data:", 1)[1].split(";", 1)[0]
	if not mimetype.lower().startswith("image/"):
		return False

	try:
		decoded = safe_b64decode(content.encode("utf-8"))
	except BinasciiError:
		return False
	if not decoded or len(decoded) > MAX_VIOLATION_FRAME_BYTES:
		return False

	filename = get_random_filename(content_type=mimetype)
	# Same allowlist the answer images use: an active-document extension here would be
	# written under /files/ and served inline.
	if os.path.splitext(filename)[1].lower() not in ALLOWED_DATAURL_IMAGE_EXTENSIONS:
		return False

	# The learner is writing evidence against their own attempt: File checks write on the
	# doctype it is attached to, and a student holds nothing on LMS Quiz Violation Log — only
	# System Manager and Instructor do. Without the bypass the attachment fails for exactly the
	# person it is meant to record. The row it hangs off was created by this same call chain a
	# moment earlier, and the frame reaches nobody the row does not.
	# nosemgrep: lms-unjustified-ignore-permissions - proctoring evidence written by the learner it records
	frappe.get_doc(
		{
			"doctype": "File",
			"file_name": filename,
			"content": decoded,
			"decode": False,
			"is_private": 1,
			"attached_to_doctype": "LMS Quiz Violation Log",
			"attached_to_name": log_name,
		}
	).insert(ignore_permissions=True)
	return True


@frappe.whitelist()
def is_open_ended_submission(submission: str) -> bool:
	quiz = frappe.db.get_value("LMS Quiz Submission", submission, "quiz")
	if not quiz:
		return False
	question_type = frappe.db.get_value("LMS Quiz Question", {"parent": quiz}, "type")
	return question_type == "Open Ended"


@frappe.whitelist()
def get_quiz_violation_logs(submission: str):
	if not frappe.db.exists("LMS Quiz Submission", submission):
		frappe.throw(_("Invalid submission."), frappe.ValidationError)
	if not (
		frappe.db.get_value("LMS Quiz Submission", submission, "member") == frappe.session.user
		or frappe.has_permission("LMS Quiz Submission", "read", submission)
	):
		frappe.throw(_("Insufficient Permission"), frappe.PermissionError)
	# The caller is already authorised above, against the parent submission: either they
	# own it or they hold read on it. The log rows carry no permissions of their own —
	# they are only ever read through this endpoint — so reading them under the check
	# already made is the access rule, not a bypass of one.
	# nosemgrep: lms-unjustified-ignore-permissions - access is gated on the parent submission above
	logs = frappe.get_all(
		"LMS Quiz Violation Log",
		filters={"quiz_submission": submission},
		fields=["name", "event_type", "severity", "timestamp"],
		order_by="timestamp asc",
		ignore_permissions=True,
	)
	_attach_frame_urls(logs)
	return logs


def _attach_frame_urls(logs: list[dict]):
	"""Fold each row's camera still onto the row. One query for the lot rather than one per
	row, and the caller has already been authorised for every row it is given."""
	if not logs:
		return

	# nosemgrep: lms-unjustified-ignore-permissions - the rows these hang off were authorised above
	frames = frappe.get_all(
		"File",
		filters={
			"attached_to_doctype": "LMS Quiz Violation Log",
			"attached_to_name": ("in", [log["name"] for log in logs]),
		},
		fields=["attached_to_name", "file_url"],
		ignore_permissions=True,
	)
	by_log = {frame["attached_to_name"]: frame["file_url"] for frame in frames}
	for log in logs:
		log["frame"] = by_log.get(log["name"])


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
		result["question_type"] = question_details.type

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


def create_submission(
	quiz: str,
	results: list,
	score_out_of: int,
	passing_percentage: float,
	violation_count: int = 0,
	submission_reason: str = "manual",
):
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
			"violation_count": violation_count,
			"submission_reason": submission_reason,
		}
	)
	submission.save(ignore_permissions=True)
	return submission


def save_progress_after_quiz(quiz_details: dict, percentage: float):
	if not quiz_details.lesson or not quiz_details.course:
		return

	if quiz_details.passing_percentage and percentage < quiz_details.passing_percentage:
		return

	# save_progress refuses a locked lesson by raising, which would roll back the
	# submission create_submission() has already written. A quiz can be reached
	# without its lesson being open — can_access_quiz also grants through an
	# LMS Assessment on a batch — so skip the progress write instead of failing the
	# submit. The throw stays in _save_progress, which is the boundary for the
	# direct-call bypass.
	from lms.lms.permissions import get_locked_lessons

	if quiz_details.lesson in get_locked_lessons(quiz_details.course):
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
	# scores as incorrect; coerce to "" so answers[0] can't IndexError / feed None onward.
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
