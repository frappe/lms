import frappe
from lms.lms.utils import has_course_moderator_role, has_course_evaluator_role
from lms.www.utils import is_student


def get_context(context):
	context.no_cache = 1
	class_name = frappe.form_dict["classname"]

	context.class_info = frappe.db.get_value(
		"LMS Class",
		class_name,
		[
			"name",
			"title",
			"description",
			"class_details",
			"start_date",
			"end_date",
			"paid_class",
			"amount",
			"currency",
			"start_time",
			"end_time",
			"seat_count",
		],
		as_dict=1,
	)

	context.courses = frappe.get_all(
		"Class Course",
		{"parent": class_name},
		["name", "course", "title"],
		order_by="creation desc",
	)

	for course in context.courses:
		course.update(
			frappe.db.get_value(
				"LMS Course", course.course, ["name", "short_introduction", "image"], as_dict=1
			)
		)

	context.student_count = frappe.db.count("Class Student", {"parent": class_name})
	context.seats_left = context.class_info.seat_count - context.student_count

	context.is_moderator = has_course_moderator_role()
	context.is_evaluator = has_course_evaluator_role()
	context.is_student = is_student(class_name)
