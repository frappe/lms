import frappe
from . import utils

def get_context(context):
    utils.get_common_context(context)

    chapter_index = frappe.form_dict.get("chapter")
    lesson_index = frappe.form_dict.get("lesson")
    lesson_number = f"{chapter_index}.{lesson_index}"

    course_name = context.course.name
    batch_name = context.batch.name

    if not chapter_index or not lesson_index:
        index_ = get_lesson_index(context.course, context.batch, frappe.session.user) or "1.1"
        frappe.local.flags.redirect_location = get_learn_url(course_name, batch_name, index_)
        raise frappe.Redirect

    context.lesson = context.course.get_lesson(chapter_index, lesson_index)
    context.lesson_index = lesson_index
    context.chapter_index = chapter_index

    outline = context.course.get_outline()
    next_ = outline.get_next(lesson_number)
    prev_ = outline.get_prev(lesson_number)
    context.next_url = get_learn_url(course_name, batch_name, next_)
    context.prev_url = get_learn_url(course_name, batch_name, prev_)

def get_learn_url(course_name, batch_name, lesson_number):
    if not lesson_number:
        return
    return f"/courses/{course_name}/{batch_name}/learn/{lesson_number}"

def get_lesson_index(course, batch, user):
    lesson = batch.get_current_lesson(user)
    return lesson and course.get_lesson_index(lesson)


