import frappe
from school.lms.doctype.lms_settings.lms_settings import check_profile_restriction
from school.www.utils import get_membership

def get_context(context):
    context.no_cache = 1

    try:
        course_name = frappe.form_dict["course"]
    except KeyError:
        frappe.local.flags.redirect_location = "/courses"
        raise frappe.Redirect

    course = frappe.get_doc("LMS Course", course_name)
    if course is None:
        frappe.local.flags.redirect_location = "/courses"
        raise frappe.Redirect

    context.course = course
    membership = get_membership(course.name, frappe.session.user)
    context.course.query_parameter = "?batch=" + membership.batch if membership and membership.batch else ""
    context.membership = membership
    if context.course.upcoming:
        context.is_user_interested = get_user_interest(context.course.name)
    context.restriction = check_profile_restriction()
    context.metatags = {
        "title": course.title,
        "image": course.image,
        "description": course.short_introduction,
        "keywords": course.title
    }

def get_user_interest(course):
    return frappe.db.count("LMS Course Interest",
            {
                "course": course,
                "user": frappe.session.user
            })
