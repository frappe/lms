from re import I
import frappe
from . import utils

def get_context(context):
    utils.get_common_context(context)

    chapter_index = frappe.form_dict.get("chapter")
    lesson_index = frappe.form_dict.get("lesson")
    lesson_number = f"{chapter_index}.{lesson_index}"

    course_name = context.course.name

    if not chapter_index or not lesson_index:
        index_ = get_lesson_index(context.course, context.batch, frappe.session.user) or "1.1"
        frappe.local.flags.redirect_location = context.batch.get_learn_url(index_)
        raise frappe.Redirect

    context.lesson = context.course.get_lesson(chapter_index, lesson_index)
    context.lesson_index = lesson_index
    context.chapter_index = chapter_index

    outline = context.course.get_outline()
    prev_ = outline.get_prev(lesson_number)
    next_ = outline.get_next(lesson_number)
    context.prev_chap = get_chapter_title(course_name, prev_)
    context.next_chap = get_chapter_title(course_name, next_)
    context.next_url = context.batch.get_learn_url(next_)
    context.prev_url = context.batch.get_learn_url(prev_)



def get_chapter_title(course_name, lesson_number):
    if not lesson_number:
        return
    chapter_index = lesson_number.split(".")[0]
    lesson_index = lesson_number.split(".")[1]
    chapter_name = frappe.db.get_value("Chapter", {"course": course_name, "index_": chapter_index}, "name")
    return frappe.db.get_value("Lesson", {"chapter": chapter_name, "index_": lesson_index}, "title")

def get_lesson_index(course, batch, user):
    lesson = batch.get_current_lesson(user)
    return lesson and course.get_lesson_index(lesson)


