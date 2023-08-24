import frappe
from frappe.utils import getdate
from lms.lms.utils import has_course_moderator_role, has_course_evaluator_role


def get_context(context):
	context.no_cache = 1
	context.is_moderator = has_course_moderator_role()
	context.is_evaluator = has_course_evaluator_role()
	classes = frappe.get_all(
		"LMS Class",
		fields=[
			"name",
			"title",
			"description",
			"start_date",
			"end_date",
			"paid_class",
			"amount",
			"currency",
			"seat_count",
		],
		order_by="start_date",
	)

	past_classes, upcoming_classes = [], []
	for class_ in classes:
		class_.student_count = frappe.db.count("Class Student", {"parent": class_.name})
		class_.course_count = frappe.db.count("Class Course", {"parent": class_.name})
		class_.seats_left = (
			class_.seat_count - class_.student_count if class_.seat_count else None
		)
		print(class_.seat_count, class_.student_count, class_.seats_left)
		if getdate(class_.start_date) < getdate():
			past_classes.append(class_)
		else:
			upcoming_classes.append(class_)

	context.past_classes = sorted(past_classes, key=lambda d: d.start_date)
	context.upcoming_classes = sorted(upcoming_classes, key=lambda d: d.start_date)

	if frappe.session.user != "Guest":
		my_classes_info = []
		my_classes = frappe.get_all(
			"Class Student", {"student": frappe.session.user}, pluck="parent"
		)

		for class_ in my_classes:
			class_info = frappe.db.get_value(
				"LMS Class",
				class_,
				[
					"name",
					"title",
					"description",
					"start_date",
					"end_date",
					"paid_class",
					"amount",
					"currency",
					"seat_count",
				],
				as_dict=True,
			)

			class_info.student_count = frappe.db.count(
				"Class Student", {"parent": class_info.name}
			)
			class_info.course_count = frappe.db.count(
				"Class Course", {"parent": class_info.name}
			)
			class_info.seats_left = class_info.seat_count - class_info.student_count

			my_classes_info.append(class_info)

		context.my_classes = my_classes_info
