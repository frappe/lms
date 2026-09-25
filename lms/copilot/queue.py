"""The teacher's review queue: every pending draft and proposal in one list."""

import frappe
from frappe import _
from frappe.utils import cint

from lms.copilot import access
from lms.copilot.proposals import OPEN, PROPOSAL_TYPES, expire_if_needed

KINDS = {
	"feedback": "Feedback",
	"Lesson Change": "Lesson Change",
	"Lesson Quiz": "Lesson Quiz",
	"Learner Reminder": "Learner Reminder",
	"Escalation": "Escalation",
	"Rubric": "Rubric",
	"Course Draft": "Course Draft",
}
MAX_ROWS = 200


def _course_filter(courses):
	return {} if courses is None else {"course": ["in", courses or [""]]}


def _feedback_rows(course_filter):
	drafts = frappe.get_all(
		"Copilot Feedback Draft",
		filters={"status": "Pending Review", **course_filter},
		fields=["name", "course", "assignment", "member", "confidence", "project_submission", "creation"],
		order_by="creation asc",
		limit=MAX_ROWS,
	)
	rows = []
	for draft in drafts:
		project = frappe.db.get_value(
			"Copilot Project Submission",
			draft.project_submission,
			["tests_passed", "tests_total", "tested_on"],
			as_dict=True,
		)
		flagged = frappe.db.count(
			"Copilot Feedback Score",
			{"parent": draft.name, "parenttype": "Copilot Feedback Draft", "confidence": ["!=", "High"]},
		)
		rows.append(
			{
				"kind": "feedback",
				"name": draft.name,
				"title": frappe.db.get_value("LMS Assignment", draft.assignment, "title"),
				"detail": {
					"tests": f"{cint(project.tests_passed)}/{cint(project.tests_total)}"
					if project and project.tested_on
					else None,
					"flagged": flagged,
				},
				"who": frappe.db.get_value("User", draft.member, "full_name"),
				"course": draft.course,
				"confidence": draft.confidence,
				"created": draft.creation,
			}
		)
	return rows


def _proposal_rows(course_filter, course_drafts=True):
	names = frappe.get_all(
		"Copilot Proposal",
		filters={"status": OPEN, **course_filter},
		pluck="name",
		order_by="creation asc",
		limit=MAX_ROWS,
	)
	if course_drafts and course_filter:
		# A course draft has no course yet, so the course filter never matches it.
		names += frappe.get_all(
			"Copilot Proposal",
			filters={"status": OPEN, "proposal_type": "Course Draft"},
			pluck="name",
			order_by="creation asc",
			limit=MAX_ROWS,
		)
	rows = []
	for name in dict.fromkeys(names):
		doc = frappe.get_doc("Copilot Proposal", name)
		if expire_if_needed(doc):
			continue
		try:
			PROPOSAL_TYPES[doc.proposal_type].assert_reviewer(doc)
		except frappe.PermissionError:
			continue
		who = None
		if doc.proposal_type == "Escalation":
			who = frappe.db.get_value("User", doc.requested_by, "full_name")
		elif doc.proposal_type == "Learner Reminder":
			who = _("{0} learner(s)").format(len(frappe.parse_json(doc.params or "{}").get("learners", [])))
		rows.append(
			{
				"kind": doc.proposal_type,
				"name": doc.name,
				"title": doc.title,
				"detail": {"summary": doc.summary, "via": doc.requested_via},
				"who": who,
				"course": doc.course,
				"confidence": doc.confidence if doc.proposal_type != "Escalation" else None,
				"created": doc.creation,
			}
		)
	return rows


def get_review_queue(course=None, kind=None):
	access.require_login()
	if not ({access.TEACHER, access.REVIEWER} & access.audiences()):
		frappe.throw(_("Only teachers have a review queue."), frappe.PermissionError)
	courses = access.teachable_courses()
	if course:
		if not access.can_review_course(course):
			frappe.throw(_("You cannot review work for this course."), frappe.PermissionError)
		courses = [course]
	course_filter = _course_filter(courses)
	rows = _feedback_rows(course_filter) + _proposal_rows(course_filter, course_drafts=not course)
	counts = {key: 0 for key in KINDS}
	for row in rows:
		counts[row["kind"]] = counts.get(row["kind"], 0) + 1
	if kind:
		rows = [row for row in rows if row["kind"] == kind]
	rows.sort(key=lambda row: row["created"])
	course_titles = {
		name: frappe.db.get_value("LMS Course", name, "title")
		for name in {row["course"] for row in rows if row["course"]}
	}
	for row in rows:
		row["course_title"] = course_titles.get(row["course"])
	quick = [
		row["name"]
		for row in rows
		if row["kind"] == "feedback" and row["confidence"] == "High" and not row["detail"]["flagged"]
	]
	return {"rows": rows, "counts": counts, "total": sum(counts.values()), "quick_approve": quick}
