import frappe
from community.www.courses.utils import get_instructor
from frappe.utils import nowdate, getdate
from community.lms.models import Course

def get_context(context):
    context.no_cache = 1

    try:
        course_slug = frappe.form_dict["course"]
    except KeyError:
        frappe.local.flags.redirect_location = "/courses"
        raise frappe.Redirect

    course = Course.find(course_slug)
    if course is None:
        frappe.local.flags.redirect_location = "/courses"
        raise frappe.Redirect

    context.course = course

