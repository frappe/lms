import frappe
from . import utils

def get_context(context):
    context.no_cache = 1
    course = utils.get_course()
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=" + frappe.request.path
        raise frappe.Redirect()

    cohort = utils.get_cohort(course, frappe.form_dict['cohort'])
    subgroup = utils.get_subgroup(cohort, frappe.form_dict['subgroup'])

    if not subgroup:
        context.template = "www/404.html"
        return

    utils.add_nav(context, "All Courses", "/courses")
    utils.add_nav(context, course.title, f"/courses/{course.name}")
    utils.add_nav(context, "Cohorts", f"/courses/{course.name}/manage")
    utils.add_nav(context, cohort.title, f"/courses/{course.name}/cohorts/{cohort.slug}")

    context.course = course
    context.cohort = cohort
    context.subgroup = subgroup
    context.stats = get_stats(subgroup)
    context.page = frappe.form_dict["page"]

def get_stats(subgroup):
    return {
        "join_requests": len(subgroup.get_join_requests()),
        "students": len(subgroup.get_students())
    }
