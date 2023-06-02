import frappe
from lms.lms.utils import has_course_moderator_role
from frappe import _
from lms.www.utils import get_assessments


def get_context(context):
	context.no_cache = 1

	student = frappe.form_dict["username"]
	class_name = frappe.form_dict["classname"]
	context.is_moderator = has_course_moderator_role()

	context.student = frappe.db.get_value(
		"User",
		{"username": student},
		["first_name", "full_name", "name", "last_active", "username"],
		as_dict=True,
	)
	context.class_info = frappe.db.get_value(
		"LMS Class", class_name, ["name"], as_dict=True
	)

	context.assessments = get_assessments(class_name, context.student.name)
