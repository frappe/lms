import frappe
from community.lms.models import Course

def get_common_context(context):
    context.no_cache = 1

    course_name = frappe.form_dict["course"]
    batch_name = frappe.form_dict["batch"]

    course = Course.find(course_name)
    if not course:
        context.template = "www/404.html"
        return

    batch = course.get_batch(batch_name)
    if not batch:
        frappe.local.flags.redirect_location = "/courses/" + course_name
        raise frappe.Redirect

    context.course = course
    context.batch = batch
    context.members = batch.get_mentors() + batch.get_students()
    context.member_count = len(context.members)
    context.livecode_url = get_livecode_url()

def get_livecode_url():
    return frappe.db.get_single_value("LMS Settings", "livecode_url")

