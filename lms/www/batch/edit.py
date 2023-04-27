import frappe
from lms.www.utils import get_current_lesson_details, get_common_context


def get_context(context):
	get_common_context(context)
	chapter_index = frappe.form_dict.get("chapter")
	lesson_index = frappe.form_dict.get("lesson")
	lesson_number = f"{chapter_index}.{lesson_index}"
	context.lesson = get_current_lesson_details(lesson_number, context, True)
