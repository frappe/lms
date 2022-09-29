import frappe
from frappe import _
from lms.lms.utils import check_profile_restriction, get_restriction_details


def get_context(context):
    context.no_cache = 1
    context.live_courses, context.upcoming_courses = get_courses()
    context.restriction = check_profile_restriction()

    if context.restriction:
        context.restriction_details = get_restriction_details()

    context.metatags = {
        "title": _("All Live Courses"),
        "image": frappe.db.get_single_value("Website Settings", "banner_image"),
        "description": "This page lists all the courses published on our website",
        "keywords": "All Courses, Courses, Learn"
    }


def get_courses():
    courses = frappe.get_all("LMS Course",
        filters={"published": True},
        fields=["name", "upcoming", "title", "image", "enable_certification",
        "paid_certificate", "price_certificate", "currency"])

    live_courses, upcoming_courses = [], []
    for course in courses:
        if course.upcoming:
            upcoming_courses.append(course)
        else:
            live_courses.append(course)
    return live_courses, upcoming_courses
