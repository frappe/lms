import frappe
from community.lms.models import Course

def get_context(context):
    context.no_cache = 1

    course_name = frappe.form_dict["course"]
    batch_name = frappe.form_dict["batch"]
    chapter_index = frappe.form_dict.get("chapter")
    lesson_index = frappe.form_dict.get("lesson")

    course = Course.find(course_name)
    if not course:
        context.template = "www/404.html"
        return

    batch = course.get_batch(batch_name)
    if not batch:
        frappe.local.flags.redirect_location = "/courses/" + course_name
        raise frappe.Redirect

    if not chapter_index or not lesson_index:
        frappe.local.flags.redirect_location = f"/courses/{course_name}/{batch_name}/learn/1.1"
        raise frappe.Redirect

    context.course = course
    context.batch = batch
    context.lesson = course.get_lesson(chapter_index, lesson_index)
    context.lesson_index = lesson_index
    context.chapter_index = chapter_index
    context.livecode_url = get_livecode_url()

def get_livecode_url():
    return frappe.db.get_single_value("LMS Settings", "livecode_url")
