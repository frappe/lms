import frappe
from frappe import _
from frappe.utils import cstr, flt

from lms.lms.utils import get_lesson_url, has_course_moderator_role, is_instructor
from lms.www.utils import (
	get_common_context,
	redirect_to_lesson,
	get_current_lesson_details,
)


def get_context(context):
	get_common_context(context)

	chapter_index = frappe.form_dict.get("chapter")
	lesson_index = frappe.form_dict.get("lesson")
	lesson_number = f"{chapter_index}.{lesson_index}"
	context.lesson_number = lesson_number
	context.lesson_index = lesson_index
	context.chapter = frappe.db.get_value(
		"Chapter Reference", {"idx": chapter_index, "parent": context.course.name}, "chapter"
	)

	if not chapter_index or not lesson_index:
		index_ = "1.1"
		redirect_to_lesson(context.course, index_)

	context.lesson = get_current_lesson_details(lesson_number, context)
	instructor = is_instructor(context.course.name)

	context.show_lesson = (
		context.membership
		or (context.lesson and context.lesson.include_in_preview)
		or instructor
		or has_course_moderator_role()
	)

	if not context.lesson:
		context.lesson = frappe._dict()

	if frappe.form_dict.get("edit"):
		if not instructor and not has_course_moderator_role():
			raise frappe.PermissionError(_("You do not have permission to access this page."))
		context.lesson.edit_mode = True
	else:
		neighbours = get_neighbours(lesson_number, context.lessons)
		context.next_url = get_url(neighbours["next"], context.course)
		context.prev_url = get_url(neighbours["prev"], context.course)

	meta_info = (
		context.lesson.title + " - " + context.course.title
		if context.lesson.title
		else "New Lesson"
	)
	context.metatags = {
		"title": meta_info,
		"keywords": meta_info,
		"description": meta_info,
	}

	context.page_extensions = get_page_extensions(context)
	context.page_context = {
		"course": context.course.name,
		"batch": context.batch,
		"lesson": context.lesson.name if context.lesson.name else "New Lesson",
		"is_member": context.membership is not None,
	}


def get_url(lesson_number, course):
	return (
		get_lesson_url(course.name, lesson_number)
		and get_lesson_url(course.name, lesson_number) + course.query_parameter
	)


def get_page_extensions(context):
	default_value = ["lms.plugins.PageExtension"]
	classnames = frappe.get_hooks("lms_lesson_page_extensions") or default_value
	extensions = [frappe.get_attr(name)() for name in classnames]
	for e in extensions:
		e.set_context(context)
	return extensions


def get_neighbours(current, lessons):
	current = flt(current)
	numbers = sorted(lesson.number for lesson in lessons)
	index = numbers.index(current)
	return {
		"prev": numbers[index - 1] if index - 1 >= 0 else None,
		"next": numbers[index + 1] if index + 1 < len(numbers) else None,
	}
