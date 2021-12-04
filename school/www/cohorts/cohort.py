import frappe
from . import utils

def get_context(context):
    context.no_cache = 1
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=" + frappe.request.path
        raise frappe.Redirect()

    course = utils.get_course()
    cohort = course and utils.get_cohort(course, frappe.form_dict["cohort"])
    if not cohort:
        context.template = "www/404.html"
        return

    user = frappe.session.user
    mentor = cohort.get_mentor(user)
    is_mentor = mentor is not None
    is_admin = cohort.is_admin(user) or "System Manager" in frappe.get_roles()

    if not is_admin and not is_mentor :
        frappe.throw("Permission Deined", frappe.PermissionError)

    utils.add_nav(context, "All Courses", "/courses")
    utils.add_nav(context, course.title, "/courses/" + course.name)
    utils.add_nav(context, "Cohorts", "/courses/" + course.name + "/manage")

    context.course = course
    context.cohort = cohort
    context.mentor = mentor
    context.is_mentor = is_mentor
    context.is_admin = is_admin
    context.page = frappe.form_dict.get("page") or ""

    # Function to render to custom page given the slug
    context.render_page = lambda page: frappe.render_template(
        cohort.get_page_template(page),
        context)
