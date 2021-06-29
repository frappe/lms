import frappe
from community.lms.models import Course

def get_context(context):
    context.no_cache = 1

    try:
        course_name = frappe.form_dict["course"]
    except KeyError:
        frappe.local.flags.redirect_location = "/courses"
        raise frappe.Redirect

    course = Course.find(course_name)
    if course is None:
        frappe.local.flags.redirect_location = "/courses"
        raise frappe.Redirect

    context.course = course
    membership = course.get_membership(frappe.session.user)
    context.course.query_parameter = "?batch=" + membership.batch if membership and membership.batch else ""
    context.membership = membership
    if not course.is_mentor(frappe.session.user) and membership:
        """ frappe.local.flags.redirect_location = f"/courses/{course.name}/learn"
        raise frappe.Redirect """
