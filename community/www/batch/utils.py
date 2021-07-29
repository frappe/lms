import frappe
from community.lms.models import Course

def get_common_context(context):
    context.no_cache = 1

    course_name = frappe.form_dict["course"]
    try:
        batch_name = frappe.form_dict["batch"]
    except KeyError:
        batch_name = None

    course = frappe.get_doc("LMS Course", course_name)
    if not course:
        context.template = "www/404.html"
        return
    context.course = course
    context.lessons = course.get_lessons()
    membership = course.get_membership(frappe.session.user, batch_name)
    context.membership = membership
    if membership:
        batch = course.get_batch(membership.batch)

        if batch:
            context.batch = batch

        context.members = course.get_mentors(membership.batch) + course.get_students(membership.batch)
        context.member_count = len(context.members)

    context.course.query_parameter = "?batch=" + membership.batch if membership and membership.batch else ""
    context.livecode_url = get_livecode_url()

def get_livecode_url():
    return frappe.db.get_single_value("LMS Settings", "livecode_url")

def redirect_to_lesson(course, index_="1.1"):
    frappe.local.flags.redirect_location = course.get_learn_url(index_) + course.query_parameter
    raise frappe.Redirect
