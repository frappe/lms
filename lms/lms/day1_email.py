"""One email from Jannat (who maintains Learning) to a new Frappe Cloud trial admin, a day after sign-up, naming the single
next step for where they stopped: create a course, add a lesson, publish, or add learners.

Three in four trials never come back after the first day, and the ones that do are far
likelier to pay. A generic drip barely moved that, so this says exactly what to do next
and links straight to it. It goes out once per site, never to self-hosted sites, paying
sites, sites that already have learners, or admins who were active in the last 12 hours.
"""

import frappe
from frappe import _
from frappe.utils import get_datetime, get_url, now_datetime

from lms.lms.telemetry import DEMO_COURSE_TITLE, send
from lms.lms.utils import get_lms_route

SENT_KEY = "lms_day1_email_sent"
REPLY_TO = "jannat@frappe.io"
EARLIEST_HOURS = 20
LATEST_HOURS = 48
QUIET_HOURS = 12


def send_day1_email():
	"""Hourly. Every check before the Frappe Cloud call is a cheap local read."""
	if frappe.db.get_default(SENT_KEY) or not frappe.conf.get("fc_communication_secret"):
		return
	admin = first_admin()
	if not admin:
		return
	if hours_since(admin.creation) > LATEST_HOURS:
		# Too late to be a day-1 email; stop checking on this site.
		frappe.db.set_default(SENT_KEY, "skipped")
		return
	if not Day1Email.due(admin) or not on_trial():
		return
	Day1Email(admin).send()
	frappe.db.set_default(SENT_KEY, 1)


class Day1Email:
	def __init__(self, admin):
		self.admin = admin
		self.courses = frappe.get_all(
			"LMS Course",
			filters={"title": ["!=", DEMO_COURSE_TITLE]},
			fields=["name", "title", "published"],
			order_by="modified desc",
		)

	@staticmethod
	def due(admin) -> bool:
		age = hours_since(admin.creation)
		quiet = not admin.last_active or hours_since(admin.last_active) >= QUIET_HOURS
		return EARLIEST_HOURS <= age <= LATEST_HOURS and quiet

	def send(self):
		step = self.next_step()
		if not step:
			return
		frappe.sendmail(
			recipients=self.admin.name,
			subject=step["subject"],
			template="lms_day1_next_step",
			args={"first_name": self.admin.first_name or _("there"), **step},
			reply_to=REPLY_TO,
			header=[step["subject"], "green"],
			retry=3,
		)
		send("day1_email_sent", step=step["key"])

	def next_step(self) -> dict | None:
		if not self.courses:
			return self.step(
				"create_course",
				_("Your first course is one step away"),
				_(
					"I noticed you set up Frappe Learning yesterday. The next step is your first course: give it a name and add a lesson, and it starts taking shape."
				),
				_("Create your course"),
				"courses/new",
			)
		if self.has_learners():
			return None
		course = self.courses[0]
		if not frappe.db.exists("Course Lesson", {"course": course.name}):
			return self.step(
				"add_lesson",
				_("Add the first lesson to {0}").format(course.title),
				_(
					"I noticed you started {0}. The next step is its first lesson: add a video, a document or a quiz."
				).format(course.title),
				_("Add a lesson"),
				f"courses/{course.name}#editor",
			)
		if not course.published:
			return self.step(
				"publish_course",
				_("{0} is ready to publish").format(course.title),
				_("I noticed {0} has lessons now. Publish it so learners can find it and start.").format(
					course.title
				),
				_("Publish your course"),
				f"courses/{course.name}",
			)
		return self.step(
			"add_learners",
			_("Invite your first learners to {0}").format(course.title),
			_(
				"I noticed {0} is live. The next step is your first learners, so you can follow their progress as they go."
			).format(course.title),
			_("Add learners"),
			f"courses/{course.name}#dashboard",
		)

	def has_learners(self) -> bool:
		names = [course.name for course in self.courses]
		return bool(frappe.db.exists("LMS Enrollment", {"course": ["in", names]}))

	@staticmethod
	def step(key: str, subject: str, message: str, action: str, path: str) -> dict:
		return {
			"key": key,
			"subject": subject,
			"message": message,
			"action": action,
			"link": get_url(get_lms_route(path)),
		}


def first_admin():
	"""The person who signed up: the oldest enabled System Manager who is a real user."""
	admins = frappe.get_all(
		"User",
		filters=[
			["Has Role", "role", "=", "System Manager"],
			["name", "not in", ["Administrator", "Guest"]],
			["enabled", "=", 1],
			["user_type", "=", "System User"],
		],
		fields=["name", "first_name", "creation", "last_active"],
		order_by="`tabUser`.`creation` asc",
		limit=1,
	)
	return admins[0] if admins else None


def on_trial() -> bool:
	"""Asks Frappe Cloud. An unanswered call means "not yet", never "send anyway"."""
	from frappe.integrations.frappe_providers.frappecloud_billing import current_site_info

	try:
		info = current_site_info()
	except Exception:
		return False
	plan = (info or {}).get("plan") or {}
	return bool(plan.get("is_trial_plan"))


def hours_since(moment) -> float:
	return (now_datetime() - get_datetime(moment)).total_seconds() / 3600
