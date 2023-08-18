import frappe

from lms.lms.utils import get_lesson_index, get_certificates
from lms.page_renderers import get_profile_url_prefix
from lms.overrides.user import get_authored_courses, get_enrolled_courses


def get_context(context):
	context.no_cache = 1

	try:
		username = frappe.form_dict["username"]
	except KeyError:
		username = frappe.db.get_value("User", frappe.session.user, ["username"])
		if username:
			frappe.local.flags.redirect_location = get_profile_url_prefix() + username
			raise frappe.Redirect

	try:
		context.member = frappe.get_doc("User", {"username": username})
		context.courses_created = get_authored_courses(context.member.name, True)
		context.enrolled_courses = (
			get_enrolled_courses()["in_progress"] + get_enrolled_courses()["completed"]
		)
		context.read_only = frappe.session.user != context.member.name
		context.certificates = get_certificates(context.member.name)
	except Exception:
		context.template = "www/404.html"
		return

	context.profile_tabs = get_profile_tabs(context.member)
	context.notifications = get_notifications()


def get_profile_tabs(user):
	"""Returns the enabled ProfileTab objects.

	Each ProfileTab is rendered as a tab on the profile page and the
	they are specified as profile_tabs hook.
	"""
	tabs = frappe.get_hooks("profile_tabs") or []
	return [frappe.get_attr(tab)(user) for tab in tabs]


def get_notifications():
	notifications = frappe.get_all(
		"Notification Log",
		{"document_type": "Course Lesson", "for_user": frappe.session.user},
		["subject", "creation", "from_user", "document_name"],
	)

	for notification in notifications:
		course = frappe.db.get_value("Course Lesson", notification.document_name, "course")
		notification.url = (
			f"/courses/{course}/learn/{get_lesson_index(notification.document_name)}"
		)

	return notifications
