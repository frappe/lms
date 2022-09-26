import frappe
from datetime import datetime
from lms.lms.utils import has_course_instructor_role, has_course_moderator_role


def get_context(context):
    context.no_cache = 1
    portal_course_creation = frappe.db.get_single_value("LMS Settings", "portal_course_creation")
    context.show_creators_section = portal_course_creation == "Anyone" or has_course_instructor_role()
    context.show_review_section = has_course_moderator_role()
    context.notifications = get_notifications()


def get_notifications():
    notifications = []

    notifications +=  get_notifications_from_lessons_created()

    notifications +=  get_notifications_from_topics_created()

    if len(notifications):
        print(notifications)
        notifications = sorted(notifications, key=lambda t: datetime.strptime(frappe.utils.format_datetime(t.creation, "dd-mm-yyyy HH:mm:ss"),"%d/%m/%Y %H:%M:%S"))
    return notifications


def get_notifications_from_lessons_created():

    lessons = frappe.get_all("Course Lesson", {
        "owner": frappe.session.user
    }, ["name"])

    for lesson in lessons:
        topics = frappe.get_all("Discussion Topic", {
            "reference_doctype": "Course Lesson",
            "reference_docname": lesson.name
        }, ["name"])

    return get_notifications_from_replies(topics)


def get_notifications_from_topics_created():

    topics = frappe.get_all("Discussion Topic", {
        "owner": frappe.session.user
    }, ["name"])

    return get_notifications_from_replies(topics)



def get_notifications_from_replies(topics):
    notifications = []

    for topic in topics:
        replies = frappe.get_all("Discussion Reply", {
            "topic": topic.name
        }, ["reply", "owner", "creation"])


        for reply in replies:
            notification = frappe._dict()
            notification["message"] = reply.reply
            notification["user"] = reply.owner
            notification["creation"] = reply.creation
            notifications.append(notification)

    return notifications
