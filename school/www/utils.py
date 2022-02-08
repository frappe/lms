import frappe
from school.lms.models import Course
from frappe.utils import flt

def get_common_context(context):
    context.no_cache = 1

    course_name = frappe.form_dict["course"]
    try:
        batch_name = frappe.form_dict["batch"]
    except KeyError:
        batch_name = None

    course = frappe.get_doc("LMS Course", course_name)
    if not course:
        context.template = "www/404.html"
        return
    context.course = course
    context.lessons = course.get_lessons()
    membership = get_membership(course_name, frappe.session.user, batch_name)
    context.membership = membership
    if membership:
        batch = course.get_batch(membership.batch)

        if batch:
            context.batch = batch

    context.course.query_parameter = "?batch=" + membership.batch if membership and membership.batch else ""
    context.livecode_url = get_livecode_url()

def get_livecode_url():
    return frappe.db.get_single_value("LMS Settings", "livecode_url")

def redirect_to_lesson(course, index_="1.1"):
    frappe.local.flags.redirect_location = course.get_learn_url(index_) + course.query_parameter
    raise frappe.Redirect

def get_membership(course, member, batch=None):
    filters = {
        "member": member,
        "course": course
    }
    if batch:
        filters["batch"] = batch

    membership = frappe.db.get_value("LMS Batch Membership",
        filters,
        ["name", "batch", "current_lesson", "member_type", "progress"],
        as_dict=True)

    if membership and membership.batch:
        membership.batch_title = frappe.db.get_value("LMS Batch", membership.batch, "title")
    return membership

def get_chapters(course):
    """Returns all chapters of this course.
    """
    chapters = frappe.get_all("Course Chapter",
        { "course": course },
        ["name", "title", "description", "idx"])
    return chapters

def get_lessons(course, chapter=None):
    """ If chapter is passed, returns lessons of only that chapter.
    Else returns lessons of all chapters of the course """
    lessons = []

    if chapter:
        return get_lesson_details(chapter)

    for chapter in get_chapters(course):
        lesson = get_lesson_details(chapter)
        lessons += lesson

    return lessons

def get_lesson_details(chapter):
    lessons = []
    lesson_list = frappe.get_all("Lesson Reference",
        {"parent": chapter.name},
        ["lesson", "idx"],
        order_by="idx")

    for row in lesson_list:
        lesson_details = frappe.db.get_value("Course Lesson", row.lesson, "name", as_dict=True)
        lesson_details.number = flt("{}.{}".format(chapter.idx, row.idx))
        lessons.append(lesson_details)
    return lessons

def get_tags(course):
    tags = frappe.db.get_value("LMS Course", course, "tags")
    return tags.split(",") if tags else []

def get_instructor(course):
    if self.instructor:
        return frappe.get_doc("User", self.instructor)
    return frappe.get_doc("User", self.owner)
