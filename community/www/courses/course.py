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

    batch = course.get_student_batch(frappe.session.user)
    if batch:
        frappe.local.flags.redirect_location = f"/courses/{course.name}/{batch.name}/learn"
        raise frappe.Redirect

