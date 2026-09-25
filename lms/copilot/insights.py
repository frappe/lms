"""Weekly stuck-point report: gather signals for the agent, store what it found."""

from collections import Counter

import frappe
from frappe import _
from frappe.utils import add_days, cint, get_datetime, getdate, nowdate

from lms.copilot import access
from lms.copilot.validation import (
	existing,
	fail,
	integer,
	load_json,
	optional_text,
	parse_list,
	required_text,
)

MAX_QUESTIONS = 300
MAX_GROUPS = 12
MAX_EVIDENCE = 50
INACTIVE_DAYS = 9


def _week(week_start=None):
	start = getdate(week_start or nowdate())
	start = getdate(add_days(start, -start.weekday()))
	return start, getdate(add_days(start, 6))


def _range(start, end):
	return [get_datetime(f"{start} 00:00:00"), get_datetime(f"{end} 23:59:59")]


def gather_weekly_signals(course, week_start=None):
	"""Raw material for the report. Learners appear only by pseudonym."""
	course = existing("LMS Course", course, _("Course"))
	access.assert_engine_or_reviewer(course)
	start, end = _week(week_start)
	window = ["between", _range(start, end)]

	conversations = frappe.get_all(
		"Copilot Conversation", filters={"course": course}, fields=["name", "user", "lesson"]
	)
	by_name = {row.name: row for row in conversations}
	questions, not_helpful = [], []
	if by_name:
		messages = frappe.get_all(
			"Copilot Conversation Message",
			filters={
				"parent": ["in", list(by_name)],
				"parenttype": "Copilot Conversation",
				"creation": window,
			},
			fields=["parent", "role", "content", "helpful", "idx"],
			order_by="creation asc",
		)
		for message in messages:
			conversation = by_name[message.parent]
			if message.role == "user" and len(questions) < MAX_QUESTIONS:
				questions.append(
					{
						"learner": access.learner_ref(conversation.user),
						"lesson": conversation.lesson,
						"text": message.content[:500],
						"conversation": message.parent,
					}
				)
			if message.role == "assistant" and message.helpful == "Not Helpful":
				not_helpful.append(
					{
						"conversation": message.parent,
						"message_index": message.idx,
						"answer": message.content[:300],
					}
				)

	drafts = frappe.get_all(
		"Copilot Feedback Draft",
		filters={"course": course, "status": "Approved", "reviewed_on": window},
		fields=["name", "member", "assignment"],
	)
	weak = Counter()
	weak_evidence = {}
	for draft in drafts:
		for row in frappe.get_all(
			"Copilot Feedback Score",
			filters={"parent": draft.name, "parenttype": "Copilot Feedback Draft"},
			fields=["criterion", "final_level", "max_level", "reason"],
		):
			if cint(row.final_level) <= max(1, cint(row.max_level) // 2):
				key = (draft.assignment, row.criterion)
				weak[key] += 1
				weak_evidence.setdefault(key, []).append(
					{
						"draft": draft.name,
						"learner": access.learner_ref(draft.member),
						"reason": (row.reason or "")[:300],
					}
				)

	enrolled = frappe.get_all("LMS Enrollment", filters={"course": course}, pluck="member")
	active = set(
		frappe.get_all(
			"Copilot Project Submission",
			filters={"course": course, "creation": [">=", add_days(end, -INACTIVE_DAYS)]},
			pluck="member",
		)
	) | {row.user for row in conversations}
	submissions_this_week = frappe.db.count(
		"Copilot Project Submission", {"course": course, "creation": window}
	)

	return {
		"course": course,
		"week_start": str(start),
		"week_end": str(end),
		"stats": {
			"learners": len(enrolled),
			"questions": len(questions),
			"submissions": submissions_this_week,
			"approved_feedback": len(drafts),
		},
		"questions": questions,
		"not_helpful_answers": not_helpful,
		"weak_criteria": [
			{
				"assignment": assignment,
				"criterion": criterion,
				"count": count,
				"evidence": weak_evidence[(assignment, criterion)][:10],
			}
			for (assignment, criterion), count in weak.most_common()
		],
		"possibly_inactive": [access.learner_ref(member) for member in enrolled if member not in active],
	}


def _group(item, index):
	if not isinstance(item, dict):
		fail(_("Group {0} must be an object.").format(index))
	lesson = item.get("lesson")
	proposals = parse_list(item.get("proposals") or [], _("Proposals"), maximum=10)
	for proposal in proposals:
		existing("Copilot Proposal", proposal, _("Proposal"))
	return {
		"title": required_text(item.get("title"), _("Group {0} title").format(index), 200),
		"lesson": existing("Course Lesson", lesson, _("Lesson")) if lesson else None,
		"learners": integer(item.get("learners", 0), _("Learners")),
		"count": integer(item.get("count", 0), _("Count")),
		"summary": required_text(item.get("summary"), _("Group {0} summary").format(index), 2000),
		"suggestion": optional_text(item.get("suggestion"), _("Suggestion"), 2000),
		"evidence": parse_list(item.get("evidence") or [], _("Evidence"), maximum=MAX_EVIDENCE),
		"proposals": proposals,
	}


def save_weekly_insight(course, groups, week_start=None, at_risk=None, stats=None, model=None):
	course = existing("LMS Course", course, _("Course"))
	access.assert_engine_or_reviewer(course)
	start, end = _week(week_start)
	groups = [
		_group(item, index) for index, item in enumerate(parse_list(groups, _("Groups"), 1, MAX_GROUPS), 1)
	]
	at_risk = parse_list(at_risk or [], _("Learners needing attention"), maximum=100)
	name = frappe.db.get_value("Copilot Weekly Insight", {"course": course, "week_start": start}, "name")
	doc = frappe.get_doc("Copilot Weekly Insight", name) if name else frappe.new_doc("Copilot Weekly Insight")
	doc.update(
		{
			"course": course,
			"week_start": start,
			"week_end": end,
			"status": "Draft",
			"groups": frappe.as_json(groups),
			"at_risk": frappe.as_json(at_risk),
			"stats": frappe.as_json(stats if isinstance(stats, dict) else load_json(stats, {})),
			"model": optional_text(model, _("Model"), 140),
		}
	)
	doc.save(ignore_permissions=True)
	return {"name": doc.name, "week_start": str(start), "groups": len(groups)}


def get_weekly_insight(course, week_start=None):
	course = existing("LMS Course", course, _("Course"))
	access.assert_reviewer(course)
	filters = {"course": course}
	if week_start:
		filters["week_start"] = _week(week_start)[0]
	name = frappe.db.get_value("Copilot Weekly Insight", filters, "name", order_by="week_start desc")
	if not name:
		return None
	doc = frappe.get_doc("Copilot Weekly Insight", name)
	groups = load_json(doc.groups, [])
	for group in groups:
		group["proposal_status"] = {
			proposal: frappe.db.get_value("Copilot Proposal", proposal, "status")
			for proposal in group.get("proposals", [])
		}
	return {
		"name": doc.name,
		"course": course,
		"course_title": frappe.db.get_value("LMS Course", course, "title"),
		"week_start": doc.week_start,
		"week_end": doc.week_end,
		"status": doc.status,
		"stats": load_json(doc.stats, {}),
		"groups": groups,
		"at_risk": load_json(doc.at_risk, []),
	}
