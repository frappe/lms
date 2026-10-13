"""Product events sent to Pulse, one per step a site takes from signing up to
running courses, so the step where sites stop can be found.

Sent from the server, mostly through doc_events, so a step counts however it
was taken: the LMS app, the desk, the API or an import.

Every milestone event says whether it is the site's first of its kind
(`is_first`): first course, first published course, first learner. The demo
content the setup wizard creates is neither sent nor counted.

Nothing identifying goes out: no names, titles or content, only the event and
a few flags about it.
"""

import frappe
from frappe.utils.telemetry import capture
from frappe.utils.telemetry.pulse.client import is_enabled as pulse_enabled

DEMO_COURSE_TITLE = "A guide to Frappe Learning"
DEMO_QUIZ_TITLE = "Do you know Frappe Learning?"


def send(event: str, doc=None, earlier: dict | None = None, **properties):
	"""`earlier` selects the documents that, if any exist besides `doc`, make
	this not the site's first. One indexed lookup, so it stays cheap on large
	sites; leave it out for events that are not milestones."""
	if frappe.flags.in_lms_demo or frappe.flags.in_install or frappe.flags.in_migrate:
		return
	if not pulse_enabled():
		return
	if earlier is not None and "is_first" not in properties:
		properties["is_first"] = not has_earlier(doc, earlier)
	capture(event, "lms", properties=properties)


def has_earlier(doc, earlier: dict) -> bool:
	conditions = [
		[field, *(value if isinstance(value, list) else ["=", value])] for field, value in earlier.items()
	]
	conditions.append(["name", "!=", doc.name])
	return bool(frappe.get_all(doc.doctype, filters=conditions, pluck="name", limit=1))


def turned_on(doc, fieldname: str) -> bool:
	"""Set by this save, where it was unset before (or the document is new)."""
	previous = doc.get_doc_before_save()
	return bool(doc.get(fieldname)) and not (previous and previous.get(fieldname))


def turned_off(doc, fieldname: str) -> bool:
	previous = doc.get_doc_before_save()
	return bool(previous and previous.get(fieldname)) and not doc.get(fieldname)


def demo_course() -> str | None:
	return frappe.db.get_value("LMS Course", {"title": DEMO_COURSE_TITLE}, "name")


def outside_demo(demo: str | None) -> dict:
	"""Leave the demo course's content out of the earlier ones."""
	return {"course": ["!=", demo]} if demo else {}


# Building a course


def course_saved(doc, method=None):
	if doc.title == DEMO_COURSE_TITLE:
		return
	own_courses = {"title": ["!=", DEMO_COURSE_TITLE]}
	if doc.get_doc_before_save() is None:
		send("course_created", doc, own_courses)
	if turned_on(doc, "published"):
		# published_on stays set after an unpublish, so publishing any course
		# again, this one included, is not a second first.
		previous = doc.get_doc_before_save()
		published_before = bool(previous and previous.published_on) or has_earlier(
			doc, {**own_courses, "published_on": ["is", "set"]}
		)
		send("course_published", doc, is_first=not published_before)
	elif turned_off(doc, "published"):
		send("course_unpublished")
	if turned_on(doc, "paid_course"):
		send("paid_course_created", doc, {**own_courses, "paid_course": 1})


def chapter_created(doc, method=None):
	demo = demo_course()
	if doc.course and doc.course == demo:
		return
	send("chapter_created", doc, outside_demo(demo), is_scorm=bool(doc.is_scorm_package))


def lesson_created(doc, method=None):
	demo = demo_course()
	if doc.course and doc.course == demo:
		return
	send("lesson_created", doc, outside_demo(demo), is_scorm=bool(doc.is_scorm_package))


def quiz_created(doc, method=None):
	if doc.title == DEMO_QUIZ_TITLE:
		return
	send("quiz_created", doc, {"title": ["!=", DEMO_QUIZ_TITLE]})


def assignment_created(doc, method=None):
	send("assignment_created", doc, {})


# Getting learners


def batch_saved(doc, method=None):
	if doc.get_doc_before_save() is None:
		send("batch_created", doc, {})
	if turned_on(doc, "published"):
		send("batch_published", doc, {"published": 1})
	if turned_on(doc, "paid_batch"):
		send("paid_batch_created", doc, {"paid_batch": 1})


def live_class_created(doc, method=None):
	send("live_class_created", doc, {})


def enrolled_in_course(doc, method=None):
	demo = demo_course()
	if doc.course == demo:
		return
	send("enrolled_in_course", doc, outside_demo(demo))


def enrolled_in_batch(doc, method=None):
	send("enrolled_in_batch", doc, {})


def certificate_issued(doc, method=None):
	if doc.course and doc.course == demo_course():
		return
	# Not outside_demo(): a batch certificate has no course, and `course != demo`
	# would leave it out of the count.
	send("certificate_issued", doc, {})


# Making money


def payment_gateway_saved(doc, method=None):
	if turned_on(doc, "payment_gateway"):
		send("payment_gateway_configured")


def payment_received(payment: str):
	"""Called where a payment is marked received. Those writes are direct
	db.set_value calls, which run no doc_events."""
	doc = frappe.db.get_value("LMS Payment", payment, ["name", "payment_for_document_type"], as_dict=True)
	if not doc:
		return
	doc.doctype = "LMS Payment"
	send("payment_received", doc, {"payment_received": 1}, payment_for=doc.payment_for_document_type)
