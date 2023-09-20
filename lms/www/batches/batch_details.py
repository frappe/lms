import frappe
from frappe import _
from lms.lms.utils import has_course_moderator_role, has_course_evaluator_role
from lms.www.utils import is_student


def get_context(context):
	context.no_cache = 1
	batch_name = frappe.form_dict["batchname"]

	context.batch_info = frappe.db.get_value(
		"LMS Batch",
		batch_name,
		[
			"name",
			"title",
			"description",
			"batch_details",
			"start_date",
			"end_date",
			"paid_batch",
			"amount",
			"currency",
			"start_time",
			"end_time",
			"seat_count",
			"published",
		],
		as_dict=1,
	)

	context.is_moderator = has_course_moderator_role()
	context.is_evaluator = has_course_evaluator_role()
	context.is_student = is_student(batch_name)

	if not context.is_moderator and not context.batch_info.published:
		raise frappe.PermissionError(_("You do not have permission to access this page."))

	if context.is_student:
		frappe.local.flags.redirect_location = f"/batches/{batch_name}"
		raise frappe.Redirect

	context.courses = frappe.get_all(
		"Batch Course",
		{"parent": batch_name},
		["name as batch_course", "course", "title", "evaluator"],
		order_by="creation desc",
	)

	for course in context.courses:
		course.update(
			frappe.db.get_value(
				"LMS Course", course.course, ["name", "short_introduction", "image"], as_dict=1
			)
		)

	context.student_count = frappe.db.count("Batch Student", {"parent": batch_name})
	context.seats_left = context.batch_info.seat_count - context.student_count
