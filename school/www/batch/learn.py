from re import I
import frappe
from school.www.utils import get_common_context, redirect_to_lesson, get_lesson_url
from frappe.utils import cstr, flt

from school.www import batch

def get_context(context):
    get_common_context(context)

    chapter_index = frappe.form_dict.get("chapter")
    lesson_index = frappe.form_dict.get("lesson")
    lesson_number = f"{chapter_index}.{lesson_index}"
    if not chapter_index or not lesson_index:
        if context.batch:
            index_ = get_lesson_index(context.course, context.batch, frappe.session.user) or "1.1"
        else:
            index_ = "1.1"
        redirect_to_lesson(context.course, index_)

    context.lesson = get_current_lesson_details(lesson_number, context)
    neighbours = get_neighbours(lesson_number, context.lessons)
    context.next_url = get_url(neighbours["next"], context.course)
    context.prev_url = get_url(neighbours["prev"], context.course)

    meta_info = context.lesson.title + " - " + context.course.title
    context.metatags = {
        "title": meta_info,
        "keywords": meta_info,
        "description": meta_info
    }

    context.page_extensions = get_page_extensions(context)
    context.page_context = {
        "course": context.course.name,
        "batch": context.get("batch") and context.batch.name,
        "lesson": context.lesson.name,
        "is_member": context.membership is not None
    }
    print(context)

def get_current_lesson_details(lesson_number, context):
    details_list = list(filter(lambda x: cstr(x.number) == lesson_number, context.lessons))
    if not len(details_list):
        redirect_to_lesson(context.course)
    return details_list[0]

def get_url(lesson_number, course):
    return get_lesson_url(course.name, lesson_number) and get_lesson_url(course.name, lesson_number) + course.query_parameter

def get_lesson_index(course, batch, user):
    lesson = batch.get_current_lesson(user)
    return lesson and course.get_lesson_index(lesson)

def get_page_extensions(context):
    default_value = ["school.plugins.PageExtension"]
    classnames = frappe.get_hooks("school_lesson_page_extensions") or default_value
    extensions = [frappe.get_attr(name)() for name in classnames]
    for e in extensions:
        e.set_context(context)
    return extensions

def get_neighbours(current, lessons):
    current = flt(current)
    numbers = sorted(lesson.number for lesson in lessons)
    index = numbers.index(current)
    return {
            "prev": numbers[index-1] if index-1 >= 0 else None,
            "next": numbers[index+1] if index+1 < len(numbers) else None
        }
