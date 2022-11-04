import frappe
from frappe.utils import get_url

from .utils import add_nav, get_course


def get_context(context):
	context.no_cache = 1
	context.course = get_course()
	if frappe.session.user == "Guest":
		frappe.local.flags.redirect_location = "/login?redirect-to=" + frappe.request.path
		raise frappe.Redirect()

	if not context.course:
		context.template = "www/404.html"
		return

	context.cohorts = get_cohorts(context.course)
	if len(context.cohorts) == 1:
		frappe.local.flags.redirect_location = (
			f"{get_url()}/courses/{context.course.name}/cohorts/{context.cohorts[0].slug}"
		)
		raise frappe.Redirect

	add_nav(context, "All Courses", "/courses")
	add_nav(context, context.course.title, "/courses/" + context.course.name)


def get_cohorts(course):
	if "System Manager" in frappe.get_roles():
		return course.get_cohorts()

	staff_roles = frappe.get_all(
		"Cohort Staff", filters={"course": course.name}, fields=["cohort"]
	)
	mentor_roles = frappe.get_all(
		"Cohort Mentor", filters={"course": course.name}, fields=["cohort"]
	)
	roles = staff_roles + mentor_roles
	names = {role.cohort for role in roles}
	return [frappe.get_doc("Cohort", name) for name in names]
