import frappe
from community.lms.models import Course

def get_common_context(context):
    context.no_cache = 1

    course_name = frappe.form_dict["course"]

    course = Course.find(course_name)
    if not course:
        context.template = "www/404.html"
        return

    membership = course.get_current_membership(frappe.session.user)

    if membership:
        context.membership = membership
        batch = course.get_batch(membership.batch)

        if batch:
            context.batch = batch

        context.members = course.get_mentors(membership.batch) + course.get_students(membership.batch)
        context.member_count = len(context.members)


    context.course = course
    context.livecode_url = get_livecode_url()

def get_livecode_url():
    return frappe.db.get_single_value("LMS Settings", "livecode_url")

def redirect_to_lesson(course, index_="1.1"):
    frappe.local.flags.redirect_location = course.get_learn_url(index_)
    raise frappe.Redirect
