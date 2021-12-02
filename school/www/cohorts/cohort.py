import frappe
from . import utils

def get_context(context):
    context.no_cache = 1
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=" + frappe.request.path
        raise frappe.Redirect()

    course = utils.get_course()
    cohort = course and get_cohort(course, frappe.form_dict["cohort"])

    if not cohort:
        context.template = "www/404.html"
        return

    utils.add_nav(context, "All Courses", "/courses")
    utils.add_nav(context, course.title, "/courses/" + course.name)
    utils.add_nav(context, "Cohorts", "/courses/" + course.name + "/manage")

    context.course = course
    context.cohort = cohort

def get_cohort(course, cohort_slug):
    cohort = utils.get_cohort(course, cohort_slug)

    if cohort.is_mentor(frappe.session.user):
        mentor = cohort.get_mentor(frappe.session.user)
        sg = frappe.get_doc("Cohort Subgroup", mentor.subgroup)
        frappe.local.flags.redirect_location = f"/courses/{course.name}/subgroups/{cohort.slug}/{sg.slug}"
        raise frappe.Redirect
    elif cohort.is_admin(frappe.session.user) or "System Manager" in frappe.get_roles():
        return cohort

