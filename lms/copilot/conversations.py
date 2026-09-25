"""Learner Q&A transcripts, ratings and hand-offs to the teacher."""

import frappe
from frappe import _
from frappe.utils import add_days, cint, now_datetime

from lms.copilot import access
from lms.copilot.proposals import create_proposal
from lms.copilot.validation import (
	boolean,
	existing,
	fail,
	integer,
	optional_text,
	parse_list,
	required_text,
)

MAX_MESSAGES = 400
MAX_CITATIONS = 8


def _own_conversation(name):
	name = existing("Copilot Conversation", name, _("Conversation"))
	doc = frappe.get_doc("Copilot Conversation", name)
	if doc.user != frappe.session.user:
		frappe.throw(_("This conversation belongs to someone else."), frappe.PermissionError)
	return doc


def _citations(citations):
	result = []
	for index, item in enumerate(parse_list(citations or [], _("Citations"), maximum=MAX_CITATIONS), 1):
		if not isinstance(item, dict):
			fail(_("Citation {0} must be an object.").format(index))
		result.append(
			{
				"lesson": existing("Course Lesson", item.get("lesson"), _("Cited lesson")),
				"block_id": optional_text(item.get("block_id"), _("Cited block"), 40),
				"label": optional_text(item.get("label"), _("Citation label"), 200),
			}
		)
	return result


def _open_conversation(course, lesson):
	role = "Teacher" if access.can_teach_course(course) else "Learner"
	return frappe.get_doc(
		{
			"doctype": "Copilot Conversation",
			"user": frappe.session.user,
			"role": role,
			"course": course,
			"lesson": lesson,
		}
	)


def log_conversation_turn(
	course, question, answer, lesson=None, citations=None, conversation=None, model=None
):
	"""Store one question and the assistant's answer so ratings and reports can use them."""
	course = existing("LMS Course", course, _("Course"))
	access.assert_course_reader(course)
	if lesson:
		lesson = existing("Course Lesson", lesson, _("Lesson"))
	doc = _own_conversation(conversation) if conversation else _open_conversation(course, lesson)
	if len(doc.messages) + 2 > MAX_MESSAGES:
		doc = _open_conversation(course, lesson)
	doc.lesson = lesson or doc.lesson
	doc.append("messages", {"role": "user", "content": required_text(question, _("Question"), 4000)})
	doc.append(
		"messages",
		{
			"role": "assistant",
			"content": required_text(answer, _("Answer"), 8000),
			"citations": frappe.as_json(_citations(citations)),
			"model": optional_text(model, _("Model"), 140),
		},
	)
	if doc.is_new():
		doc.insert(ignore_permissions=True)
	else:
		doc.save(ignore_permissions=True)
	return {"conversation": doc.name, "message_index": len(doc.messages)}


def rate_answer(conversation, message_index, helpful):
	doc = _own_conversation(conversation)
	index = integer(message_index, _("Message"), minimum=1, maximum=len(doc.messages))
	row = doc.messages[index - 1]
	if row.role != "assistant":
		fail(_("Only assistant answers can be rated."))
	row.helpful = "Helpful" if boolean(helpful, _("Helpful")) else "Not Helpful"
	doc.save(ignore_permissions=True)
	return {"conversation": doc.name, "message_index": index, "helpful": row.helpful}


def escalate(course, question, summary=None, lesson=None, conversation=None):
	"""Hand a question to the teacher. It lands in the review queue as an Escalation."""
	if conversation:
		conversation = _own_conversation(conversation).name
	result = create_proposal(
		"escalate_to_teacher",
		{"course": course, "lesson": lesson, "question": question, "summary": summary},
		conversation=conversation,
	)
	if conversation:
		frappe.db.set_value("Copilot Conversation", conversation, "escalated", 1)
	result["message"] = _("Your question was sent to your teacher.")
	return result


def purge_old_transcripts():
	"""Daily: delete conversations and tool logs past the site's retention period."""
	days = cint(frappe.db.get_single_value("Copilot Settings", "conversation_retention_days")) or 90
	cutoff = add_days(now_datetime(), -days)
	for doctype in ("Copilot Conversation", "Copilot Tool Log"):
		for name in frappe.get_all(doctype, filters={"modified": ["<", cutoff]}, pluck="name"):
			frappe.delete_doc(doctype, name, ignore_permissions=True, force=True)
