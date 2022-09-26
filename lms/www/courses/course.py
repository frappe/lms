import frappe
from lms.lms.doctype.lms_settings.lms_settings import check_profile_restriction
from lms.lms.utils import get_membership, has_course_moderator_role, is_instructor, is_certified, get_evaluation_details, redirect_to_courses_list

def get_context(context):
    context.no_cache = 1

    try:
        course_name = frappe.form_dict["course"]
    except KeyError:
        redirect_to_courses_list()

    if course_name == "new-course":
        if frappe.session.user == "Guest":
            redirect_to_courses_list()
        context.course = frappe._dict()
        context.course.edit_mode = True
        context.membership = None
    else:
        set_course_context(context, course_name)


def set_course_context(context, course_name):
    course = frappe.db.get_value("LMS Course", course_name,
        ["name", "title", "image", "short_introduction", "description", "published", "upcoming", "disable_self_learning",
        "status", "video_link", "enable_certification", "grant_certificate_after", "paid_certificate",
        "price_certificate", "currency", "max_attempts", "duration"],
        as_dict=True)

    if frappe.form_dict.get("edit"):
        if not is_instructor(course.name) and not has_course_moderator_role():
            redirect_to_courses_list()
        course.edit_mode = True

    if course is None:
        frappe.local.flags.redirect_location = "/courses"
        raise frappe.Redirect

    related_courses = frappe.get_all("Related Courses", {"parent": course.name}, ["course"])
    for csr in related_courses:
        csr.update(frappe.db.get_value("LMS Course",
            csr.course, ["name", "upcoming", "title", "image", "enable_certification"], as_dict=True))
    course.related_courses = related_courses

    context.course = course
    membership = get_membership(course.name, frappe.session.user)
    context.course.query_parameter = "?batch=" + membership.batch if membership and membership.batch else ""
    context.membership = membership
    context.restriction = check_profile_restriction()
    context.show_start_learing_cta = show_start_learing_cta(course, membership, context.restriction)
    context.certificate = is_certified(course.name)
    eval_details = get_evaluation_details(course.name)
    context.eligible_for_evaluation = eval_details.eligible
    context.certificate_request = eval_details.request
    context.no_of_attempts = eval_details.no_of_attempts

    if context.course.upcoming:
        context.is_user_interested = get_user_interest(context.course.name)

    context.metatags = {
        "title": course.title,
        "image": course.image,
        "description": course.short_introduction,
        "keywords": course.title
    }


def get_user_interest(course):
    return frappe.db.count("LMS Course Interest", {
            "course": course,
            "user": frappe.session.user
        })


def show_start_learing_cta(course, membership, restriction):
    return not course.disable_self_learning and not membership and not course.upcoming and not restriction.get("restrict") and not is_instructor(course.name) and course.status == "Approved"
