import frappe
from lms.lms.doctype.lms_settings.lms_settings import check_profile_restriction
from lms.lms.utils import get_membership, is_instructor

def get_context(context):
    context.no_cache = 1

    try:
        course_name = frappe.form_dict["course"]
    except KeyError:
        frappe.local.flags.redirect_location = "/courses"
        raise frappe.Redirect

    course = frappe.db.get_value("LMS Course", course_name,
        ["name", "title", "image", "short_introduction", "description", "published", "upcoming",
        "disable_self_learning", "video_link", "enable_certification", "status", "grant_certificate_after"],
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
    context.show_start_learing_cta = show_start_learing_cta(course, membership, context.restriction)
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

def show_start_learing_cta(course, membership, restriction):
    return not course.disable_self_learning and not membership and not course.upcoming and not restriction.get("restrict") and not is_instructor(course.name)
