import frappe
from frappe.utils import getdate
from lms.lms.utils import has_course_moderator_role


def get_context(context):
	context.no_cache = 1
	context.is_moderator = has_course_moderator_role()
	classes = frappe.get_all(
		"LMS Class",
		fields=["name", "title", "start_date", "end_date"],
	)
	past_classes, upcoming_classes = [], []
	for class_ in classes:
		if getdate(class_.end_date) < getdate():
			past_classes.append(class_)
		else:
			upcoming_classes.append(class_)
	context.past_classes = past_classes
	context.upcoming_classes = upcoming_classes
