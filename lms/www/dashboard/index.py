import frappe
from datetime import datetime
from lms.lms.utils import has_course_instructor_role, has_course_moderator_role, get_lesson_index


def get_context(context):
    context.no_cache = 1
    portal_course_creation = frappe.db.get_single_value("LMS Settings", "portal_course_creation")
    context.show_creators_section = portal_course_creation == "Anyone" or has_course_instructor_role()
    context.show_review_section = has_course_moderator_role()
    context.notifications = get_notifications()


def get_notifications():
    notifications = frappe.get_all("Notification Log", {
        "document_type": "Course Lesson",
        "for_user": frappe.session.user
    }, ["subject", "creation", "from_user", "document_name"])

    for notification in notifications:
        course = frappe.db.get_value("Course Lesson", notification.document_name, "course")
        notification.url = "/courses/{0}/learn/{1}".format(course, get_lesson_index(notification.document_name))

    return notifications
