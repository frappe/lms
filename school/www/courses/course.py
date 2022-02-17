import frappe
from school.lms.doctype.lms_settings.lms_settings import check_profile_restriction
from school.lms.utils import get_membership

def get_context(context):
    context.no_cache = 1

    try:
        course_name = frappe.form_dict["course"]
    except KeyError:
        frappe.local.flags.redirect_location = "/courses"
        raise frappe.Redirect

    course = frappe.db.get_value("LMS Course", course_name,
        ["name", "title", "image", "short_introduction", "description", "is_published", "upcoming",
        "disable_self_learning", "video_link", "enable_certification"],
        as_dict=True)

    related_courses = frappe.get_all("Related Courses", {"parent": course.name}, ["course"])
    for csr in related_courses:
        csr.update(frappe.db.get_value("LMS Course",
            csr.course, ["name", "upcoming", "title", "image", "enable_certification"], as_dict=True))
    course.related_courses = related_courses

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
