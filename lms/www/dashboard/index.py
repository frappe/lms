import frappe
from lms.lms.utils import has_course_instructor_role, has_course_moderator_role


def get_context(context):
    context.no_cache = 1
    portal_course_creation = frappe.db.get_single_value("LMS Settings", "portal_course_creation")
    context.show_creators_section = portal_course_creation == "Anyone" or has_course_instructor_role()
    context.show_review_section = has_course_moderator_role()
