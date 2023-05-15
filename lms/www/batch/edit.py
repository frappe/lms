import frappe
from lms.www.utils import get_current_lesson_details, get_common_context
from lms.lms.utils import is_instructor, has_course_moderator_role
from frappe import _


def get_context(context):
	get_common_context(context)
	chapter_index = frappe.form_dict.get("chapter")
	lesson_index = frappe.form_dict.get("lesson")
	lesson_number = f"{chapter_index}.{lesson_index}"
	context.lesson_index = lesson_index
	context.lesson_number = lesson_number
	context.chapter = frappe.db.get_value(
		"Chapter Reference", {"idx": chapter_index, "parent": context.course.name}, "chapter"
	)
	context.lesson = get_current_lesson_details(lesson_number, context, True)
	context.is_moderator = has_course_moderator_role()
	instructor = is_instructor(context.course.name)

	if not instructor and not has_course_moderator_role():
		raise frappe.PermissionError(_("You do not have permission to access this page."))
