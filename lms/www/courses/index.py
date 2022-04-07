import frappe
from lms.lms.doctype.lms_settings.lms_settings import check_profile_restriction

def get_context(context):
    context.no_cache = 1
    context.live_courses, context.upcoming_courses = get_courses()
    context.restriction = check_profile_restriction()
    context.metatags = {
        "title": "All Live Courses",
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
