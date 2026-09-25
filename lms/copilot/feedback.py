"""Project submissions and rubric feedback drafts.

A learner submits a GitHub repo, the review agent records test results and
drafts rubric feedback, and a teacher edits and approves it. Only approval
writes the feedback into the LMS Assignment Submission the learner sees.
"""

import difflib
import re
import time

import frappe
from frappe import _
from frappe.utils import cint, escape_html, now_datetime
from frappe.utils.html_utils import sanitize_html

from lms.copilot import access
from lms.copilot.audit import log_tool
from lms.copilot.read_tools import rubric_for_assignment, serialise_rubric, serialise_tests
from lms.copilot.validation import (
	boolean,
	confidence,
	existing,
	fail,
	integer,
	load_json,
	lowest_confidence,
	optional_text,
	parse_list,
	parse_object,
	required_text,
)

GITHUB_REPO = re.compile(r"^https://github\.com/([A-Za-z0-9-]{1,39})/([A-Za-z0-9._-]{1,100}?)(?:\.git)?/?$")
COMMIT = re.compile(r"^[0-9a-f]{7,40}$")
MAX_TESTS = 500
MAX_CITATIONS = 10
OPEN_DRAFT = "Pending Review"
RESULT_STATUSES = ("Pass", "Fail", "Not Graded")
LIGHT_EDIT_RATIO = 0.8


def normalise_repo_url(url):
	url = required_text(url, _("Repository URL"), 300)
	match = GITHUB_REPO.match(url)
	if not match:
		fail(_("Enter a public GitHub repository link like https://github.com/owner/repo."))
	return f"https://github.com/{match.group(1)}/{match.group(2)}"


def _assignment_context(assignment, lesson=None):
	doc = frappe.get_doc("LMS Assignment", assignment)
	course = doc.get("course")
	if lesson:
		lesson = existing("Course Lesson", lesson, _("Lesson"))
		lesson_course = frappe.db.get_value("Course Lesson", lesson, "course")
		if course and lesson_course != course:
			fail(_("The lesson does not belong to this assignment's course."))
		course = course or lesson_course
	return doc, course, lesson


# ---------------------------------------------------------------- learner side


def submit_project(assignment, repo_url, lesson=None):
	access.require_login()
	assignment = existing("LMS Assignment", assignment, _("Assignment"))
	doc, course, lesson = _assignment_context(assignment, lesson)
	if not course:
		frappe.throw(_("This assignment is not linked to a course."), frappe.PermissionError)
	if not access.is_enrolled(course) and not access.can_review_course(course):
		frappe.throw(_("Enroll in the course before submitting this project."), frappe.PermissionError)
	repo_url = normalise_repo_url(repo_url)
	member = frappe.session.user

	submission_name = frappe.db.get_value(
		"LMS Assignment Submission", {"assignment": assignment, "member": member}, "name"
	)
	if submission_name:
		submission = frappe.get_doc("LMS Assignment Submission", submission_name)
		submission.answer = repo_url
		submission.save(ignore_permissions=True)
	else:
		submission = frappe.get_doc(
			{
				"doctype": "LMS Assignment Submission",
				"assignment": assignment,
				"member": member,
				"type": "URL",
				"answer": repo_url,
				"lesson": lesson,
				"course": course,
			}
		).insert(ignore_permissions=True)

	for draft in frappe.get_all(
		"Copilot Feedback Draft",
		filters={"assignment": assignment, "member": member, "status": OPEN_DRAFT},
		pluck="name",
	):
		frappe.db.set_value("Copilot Feedback Draft", draft, "status", "Superseded")

	project = frappe.get_doc(
		{
			"doctype": "Copilot Project Submission",
			"assignment": assignment,
			"course": course,
			"lesson": lesson,
			"member": member,
			"assignment_submission": submission.name,
			"repo_url": repo_url,
			"status": "Submitted",
		}
	).insert(ignore_permissions=True)

	from lms.copilot.gateway import enqueue_review

	enqueue_review(project.name)
	return learner_status(project)


def _timeline(project):
	tested = bool(project.tested_on)
	sent = project.status == "Feedback Sent"
	return [
		{"step": "submitted", "done": True, "at": project.creation},
		{"step": "tested", "done": tested, "at": project.tested_on},
		{"step": "review", "done": sent, "current": tested and not sent and project.status != "Error"},
		{"step": "feedback", "done": sent, "at": project.feedback_sent_on},
	]


def learner_status(project):
	"""What the learner may see: tests at once, words only after approval."""
	result = {
		"project_submission": project.name,
		"assignment": project.assignment,
		"repo_url": project.repo_url,
		"commit": project.commit_sha,
		"status": project.status,
		"submitted_on": project.creation,
		"tests": serialise_tests(project) if project.tested_on else None,
		"timeline": _timeline(project),
		"feedback": None,
	}
	if project.status == "Feedback Sent":
		draft = frappe.db.get_value(
			"Copilot Feedback Draft",
			{"project_submission": project.name, "status": "Approved"},
			["final_message", "result_status", "name"],
			as_dict=True,
		)
		if draft:
			scores = frappe.get_all(
				"Copilot Feedback Score",
				filters={"parent": draft.name, "parenttype": "Copilot Feedback Draft"},
				fields=["criterion", "final_level", "max_level"],
				order_by="idx asc",
			)
			result["feedback"] = {
				"message": draft.final_message,
				"result": draft.result_status,
				"scores": [dict(score) for score in scores],
			}
	return result


def get_assignment_for_learner(assignment):
	access.require_login()
	assignment = existing("LMS Assignment", assignment, _("Assignment"))
	doc, course, _lesson = _assignment_context(assignment)
	if course and not access.can_read_course(course):
		frappe.throw(_("You are not enrolled in this course."), frappe.PermissionError)
	if not course and not access.can_review_course(None):
		frappe.throw(_("This assignment is not linked to a course."), frappe.PermissionError)
	rubric = rubric_for_assignment(assignment)
	projects = frappe.get_all(
		"Copilot Project Submission",
		filters={"assignment": assignment, "member": frappe.session.user},
		pluck="name",
		order_by="creation desc",
		limit=5,
	)
	return {
		"assignment": doc.name,
		"title": doc.title,
		"question": sanitize_html(doc.question or "", always_sanitize=True),
		"course": course,
		"course_title": frappe.db.get_value("LMS Course", course, "title") if course else None,
		"rubric": serialise_rubric(rubric, for_learner=True)
		if rubric and cint(rubric.visible_to_learner)
		else None,
		"submissions": [
			learner_status(frappe.get_doc("Copilot Project Submission", name)) for name in projects
		],
	}


# ------------------------------------------------------------ review agent side


def _project(name):
	name = existing("Copilot Project Submission", name, _("Project submission"))
	return frappe.get_doc("Copilot Project Submission", name)


def _test_result(item, index):
	if not isinstance(item, dict):
		fail(_("Test result {0} must be an object.").format(index))
	return {
		"name": required_text(item.get("name"), _("Test {0} name").format(index), 300),
		"passed": boolean(item.get("passed"), _("Test {0} passed").format(index)),
		"message": optional_text(item.get("message"), _("Test {0} message").format(index), 2000),
	}


def record_submission_tests(project_submission, results, commit_sha=None, error=None):
	project = _project(project_submission)
	access.assert_engine_or_reviewer(project.course)
	results = [
		_test_result(item, index)
		for index, item in enumerate(parse_list(results, _("Results"), maximum=MAX_TESTS), 1)
	]
	if commit_sha:
		commit_sha = required_text(commit_sha, _("Commit"), 40).lower()
		if not COMMIT.match(commit_sha):
			fail(_("Commit must be a git SHA."))
	project.update(
		{
			"test_results": frappe.as_json(results),
			"tests_total": len(results),
			"tests_passed": sum(1 for item in results if item["passed"]),
			"tested_on": now_datetime(),
			"commit_sha": commit_sha or project.commit_sha,
			"error": optional_text(error, _("Error"), 2000),
			"status": "Awaiting Review"
			if project.status in ("Submitted", "Testing", "Rewrite Requested")
			else project.status,
		}
	)
	project.save(ignore_permissions=True)
	return {"project_submission": project.name, "status": project.status, "tests": serialise_tests(project)}


def _citation(item, index):
	if not isinstance(item, dict):
		fail(_("Citation {0} must be an object.").format(index))
	citation = {}
	if item.get("file"):
		citation["file"] = required_text(item.get("file"), _("Citation file"), 300)
		citation["line_start"] = integer(item.get("line_start", 1), _("Citation line"), minimum=1)
		citation["line_end"] = integer(
			item.get("line_end", citation["line_start"]), _("Citation line"), minimum=citation["line_start"]
		)
	elif item.get("lesson"):
		citation["lesson"] = existing("Course Lesson", item.get("lesson"), _("Cited lesson"))
		citation["block_id"] = optional_text(item.get("block_id"), _("Cited block"), 40)
	else:
		fail(_("Citation {0} needs a file or a lesson.").format(index))
	citation["label"] = optional_text(item.get("label"), _("Citation label"), 200)
	return citation


def _scores(rubric, scores):
	scores = parse_list(scores, _("Scores"), minimum=1)
	criteria = {row.criterion: cint(row.max_level) or 3 for row in rubric.criteria}
	seen = {}
	for index, score in enumerate(scores, 1):
		if not isinstance(score, dict):
			fail(_("Score {0} must be an object.").format(index))
		criterion = required_text(score.get("criterion"), _("Score {0} criterion").format(index), 140)
		if criterion not in criteria:
			fail(_("{0} is not a criterion of this rubric.").format(criterion))
		if criterion in seen:
			fail(_("{0} is scored twice.").format(criterion))
		citations = parse_list(score.get("citations") or [], _("Citations"), maximum=MAX_CITATIONS)
		seen[criterion] = {
			"criterion": criterion,
			"max_level": criteria[criterion],
			"level": integer(
				score.get("level"), _("Level for {0}").format(criterion), 1, criteria[criterion]
			),
			"reason": required_text(score.get("reason"), _("Reason for {0}").format(criterion), 2000),
			"confidence": confidence(score.get("confidence"), _("Confidence for {0}").format(criterion)),
			"citations": [_citation(item, i) for i, item in enumerate(citations, 1)],
		}
	missing = [criterion for criterion in criteria if criterion not in seen]
	if missing:
		fail(_("Missing scores for: {0}.").format(", ".join(missing)))
	return [seen[criterion] for criterion in criteria]


def propose_feedback(project_submission, scores, message, model=None):
	project = _project(project_submission)
	access.assert_engine_or_reviewer(project.course)
	if project.status == "Feedback Sent":
		fail(_("Feedback for this submission has already been sent."))
	rubric = rubric_for_assignment(project.assignment)
	if not rubric:
		fail(_("This assignment has no rubric yet. Ask the teacher to add one."))
	rows = _scores(rubric, scores)
	message = required_text(message, _("Message"), 8000)

	for draft in frappe.get_all(
		"Copilot Feedback Draft",
		filters={"project_submission": project.name, "status": ["in", [OPEN_DRAFT, "Rewrite Requested"]]},
		pluck="name",
	):
		frappe.db.set_value("Copilot Feedback Draft", draft, "status", "Superseded")

	draft = frappe.get_doc(
		{
			"doctype": "Copilot Feedback Draft",
			"project_submission": project.name,
			"rubric": rubric.name,
			"course": project.course,
			"assignment": project.assignment,
			"member": project.member,
			"status": OPEN_DRAFT,
			"confidence": lowest_confidence([row["confidence"] for row in rows]),
			"model": optional_text(model, _("Model"), 140),
			"message": message,
			"scores": [
				{**row, "final_level": row["level"], "citations": frappe.as_json(row["citations"])}
				for row in rows
			],
		}
	).insert(ignore_permissions=True)
	project.db_set("status", "Awaiting Review")
	return {
		"draft": draft.name,
		"status": draft.status,
		"confidence": draft.confidence,
		"message": _("Feedback drafted for teacher review. The learner sees nothing yet."),
	}


# ----------------------------------------------------------------- teacher side


def _draft(name):
	name = existing("Copilot Feedback Draft", name, _("Feedback draft"))
	doc = frappe.get_doc("Copilot Feedback Draft", name)
	access.assert_reviewer(doc.course)
	return doc


def get_feedback_review(draft):
	doc = _draft(draft)
	project = frappe.get_doc("Copilot Project Submission", doc.project_submission)
	rubric = frappe.get_doc("Copilot Rubric", doc.rubric) if doc.rubric else None
	assignment_title = frappe.db.get_value("LMS Assignment", doc.assignment, "title")
	return {
		"draft": doc.name,
		"status": doc.status,
		"confidence": doc.confidence,
		"model": doc.model,
		"message": doc.message,
		"final_message": doc.final_message,
		"result_status": doc.result_status,
		"review_note": doc.review_note,
		"reviewed_by": doc.reviewed_by,
		"edit_level": doc.edit_level,
		"assignment": doc.assignment,
		"assignment_title": assignment_title,
		"course": doc.course,
		"course_title": frappe.db.get_value("LMS Course", doc.course, "title") if doc.course else None,
		"learner_name": frappe.db.get_value("User", doc.member, "full_name"),
		"rubric": serialise_rubric(rubric),
		"scores": [
			{
				"criterion": row.criterion,
				"max_level": row.max_level,
				"level": row.level,
				"final_level": row.final_level or row.level,
				"confidence": row.confidence,
				"reason": row.reason,
				"citations": load_json(row.citations, []),
			}
			for row in doc.scores
		],
		"submission": {
			"name": project.name,
			"repo_url": project.repo_url,
			"commit": project.commit_sha,
			"status": project.status,
			"submitted_on": project.creation,
			"tests": serialise_tests(project),
			"history": frappe.get_all(
				"Copilot Project Submission",
				filters={"assignment": project.assignment, "member": project.member},
				fields=["name", "commit_sha", "status", "tests_passed", "tests_total", "creation"],
				order_by="creation desc",
				limit=10,
			),
		},
		"neighbours": _neighbours(doc),
	}


def _neighbours(doc):
	"""Previous and next pending drafts in the same course, for quick review."""
	pending = frappe.get_all(
		"Copilot Feedback Draft",
		filters={"status": OPEN_DRAFT, "course": doc.course},
		pluck="name",
		order_by="creation asc",
	)
	if doc.name not in pending:
		return {"previous": None, "next": pending[0] if pending else None}
	index = pending.index(doc.name)
	return {
		"previous": pending[index - 1] if index > 0 else None,
		"next": pending[index + 1] if index + 1 < len(pending) else None,
	}


def _apply_teacher_edits(doc, scores=None, message=None):
	if scores not in (None, "", {}):
		scores = parse_object(scores, _("Scores"))
		rows = {row.criterion: row for row in doc.scores}
		for criterion, level in scores.items():
			row = rows.get(criterion)
			if not row:
				fail(_("{0} is not a criterion of this draft.").format(criterion))
			row.final_level = integer(
				level, _("Level for {0}").format(criterion), 1, cint(row.max_level) or 3
			)
	if message not in (None, ""):
		doc.final_message = required_text(message, _("Message"), 8000)


def edit_level(doc):
	"""Unchanged, light or rewrite: the pilot's main quality metric."""
	changed_levels = sum(1 for row in doc.scores if cint(row.final_level) != cint(row.level))
	final_message = doc.final_message or doc.message
	ratio = difflib.SequenceMatcher(a=doc.message or "", b=final_message or "", autojunk=False).ratio()
	if changed_levels == 0 and ratio == 1:
		return "Unchanged"
	if changed_levels <= 1 and ratio >= LIGHT_EDIT_RATIO:
		return "Light"
	return "Rewrite"


def _assert_open(doc):
	if doc.status != OPEN_DRAFT:
		fail(_("This draft is already {0}.").format(_(doc.status)))


def save_feedback_draft(draft, scores=None, message=None, note=None):
	doc = _draft(draft)
	_assert_open(doc)
	_apply_teacher_edits(doc, scores, message)
	doc.review_note = optional_text(note, _("Note"), 2000)
	doc.save(ignore_permissions=True)
	return {"draft": doc.name, "status": doc.status}


def _comments_html(doc):
	lines = [f"<p>{escape_html(line)}</p>" for line in (doc.final_message or "").splitlines() if line.strip()]
	items = "".join(
		f"<li>{escape_html(row.criterion)}: {cint(row.final_level)}/{cint(row.max_level)}</li>"
		for row in doc.scores
	)
	return "".join(lines) + (f"<ul>{items}</ul>" if items else "")


def approve_feedback(draft, scores=None, message=None, result_status=None, note=None):
	"""Send the reviewed feedback to the learner through their LMS submission."""
	started = time.monotonic()
	doc = _draft(draft)
	_assert_open(doc)
	_apply_teacher_edits(doc, scores, message)
	doc.final_message = doc.final_message or doc.message
	if result_status in (None, ""):
		result_status = "Pass" if all(cint(row.final_level) > 1 for row in doc.scores) else "Fail"
	if result_status not in RESULT_STATUSES:
		fail(_("Result must be Pass, Fail or Not Graded."))

	project = frappe.get_doc("Copilot Project Submission", doc.project_submission)
	if project.assignment_submission and frappe.db.exists(
		"LMS Assignment Submission", project.assignment_submission
	):
		submission = frappe.get_doc("LMS Assignment Submission", project.assignment_submission)
		submission.update(
			{"status": result_status, "comments": _comments_html(doc), "evaluator": frappe.session.user}
		)
		submission.save(ignore_permissions=True)

	doc.update(
		{
			"status": "Approved",
			"result_status": result_status,
			"reviewed_by": frappe.session.user,
			"reviewed_on": now_datetime(),
			"review_note": optional_text(note, _("Note"), 2000),
		}
	)
	doc.edit_level = edit_level(doc)
	doc.save(ignore_permissions=True)
	project.update({"status": "Feedback Sent", "feedback_sent_on": now_datetime()})
	project.save(ignore_permissions=True)
	log_tool(
		"approve_feedback",
		"Success",
		arguments={"draft": doc.name, "result_status": result_status},
		result={"name": doc.name, "status": doc.status},
		duration_ms=(time.monotonic() - started) * 1000,
		is_write=True,
	)
	return {"draft": doc.name, "status": doc.status, "edit_level": doc.edit_level, "result": result_status}


def reject_feedback(draft, note=None):
	doc = _draft(draft)
	_assert_open(doc)
	doc.update(
		{
			"status": "Rejected",
			"reviewed_by": frappe.session.user,
			"reviewed_on": now_datetime(),
			"review_note": optional_text(note, _("Note"), 2000),
		}
	)
	doc.save(ignore_permissions=True)
	return {"draft": doc.name, "status": doc.status}


def request_rewrite(draft, note):
	doc = _draft(draft)
	_assert_open(doc)
	doc.update(
		{
			"status": "Rewrite Requested",
			"reviewed_by": frappe.session.user,
			"reviewed_on": now_datetime(),
			"review_note": required_text(note, _("What should the assistant change?"), 2000),
		}
	)
	doc.save(ignore_permissions=True)
	frappe.db.set_value("Copilot Project Submission", doc.project_submission, "status", "Rewrite Requested")

	from lms.copilot.gateway import enqueue_review

	enqueue_review(doc.project_submission, rewrite_of=doc.name)
	return {"draft": doc.name, "status": doc.status}


def bulk_approve_feedback(drafts):
	"""Approve drafts unchanged, but only when every criterion is high confidence."""
	names = parse_list(drafts, _("Drafts"), minimum=1, maximum=50)
	approved, skipped = [], []
	for name in names:
		doc = _draft(name)
		if doc.status != OPEN_DRAFT or any(row.confidence != "High" for row in doc.scores):
			skipped.append({"draft": doc.name, "reason": _("Not every criterion is high confidence.")})
			continue
		approve_feedback(doc.name)
		approved.append(doc.name)
	return {"approved": approved, "skipped": skipped}
