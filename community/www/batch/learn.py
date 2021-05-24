from re import I
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
        frappe.local.flags.redirect_location = f"/courses/{course_name}/{batch_name}/learn/1.1"
        raise frappe.Redirect

    context.lesson = context.course.get_lesson(chapter_index, lesson_index)
    context.lesson_index = lesson_index
    context.chapter_index = chapter_index
    print(context.lesson)
    outline = context.course.get_outline()
    prev_ = outline.get_prev(lesson_number)
    next_ = outline.get_next(lesson_number)
    context.prev_chap = get_chapter_title(course_name, prev_)
    context.next_chap = get_chapter_title(course_name, next_)
    context.next_url = get_learn_url(course_name, batch_name, next_)
    context.prev_url = get_learn_url(course_name, batch_name, prev_)

def get_learn_url(course_name, batch_name, lesson_number):
    if not lesson_number:
        return
    return f"/courses/{course_name}/{batch_name}/learn/{lesson_number}"

def get_chapter_title(course_name, lesson_number):
    if not lesson_number:
        return
    chapter_index = lesson_number.split(".")[0]
    lesson_index = lesson_number.split(".")[1]
    chapter_name = frappe.db.get_value("Chapter", {"course": course_name, "index_": chapter_index}, "name")
    return frappe.db.get_value("Lesson", {"chapter": chapter_name, "index_": lesson_index}, "title")
