import frappe
from . import utils

def get_context(context):
    context.no_cache = 1
    course = utils.get_course()

    cohort = utils.get_cohort(course, frappe.form_dict['cohort'])
    subgroup = utils.get_subgroup(cohort, frappe.form_dict['subgroup'])

    if not subgroup:
        context.template = "www/404.html"
        return

    page = frappe.form_dict.get("page")
    is_mentor = subgroup.is_mentor(frappe.session.user)
    is_admin = cohort.is_admin(frappe.session.user) or "System Manager" in frappe.get_roles()

    if (page not in ["mentors", "students", "join-requests", "admin"]
            or (page == "join-requests" and not (is_mentor or is_admin))
            or (page == "admin" and not is_admin)):
        frappe.local.flags.redirect_location = subgroup.get_url() + "/mentors"
        raise frappe.Redirect

    utils.add_nav(context, "All Courses", "/courses")
    utils.add_nav(context, course.title, f"/courses/{course.name}")
    utils.add_nav(context, "Cohorts", f"/courses/{course.name}/manage")
    utils.add_nav(context, cohort.title, f"/courses/{course.name}/cohorts/{cohort.slug}")

    context.course = course
    context.cohort = cohort
    context.subgroup = subgroup
    context.stats = get_stats(subgroup)
    context.page = page
    context.is_admin = is_admin
    context.is_mentor = is_mentor

def get_stats(subgroup):
    return {
        "join_requests": len(subgroup.get_join_requests()),
        "students": len(subgroup.get_students()),
        "mentors": len(subgroup.get_mentors())
    }
