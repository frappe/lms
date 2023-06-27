import frappe
from frappe.utils import getdate
from lms.lms.utils import has_course_moderator_role


def get_context(context):
	context.no_cache = 1
	context.is_moderator = has_course_moderator_role()
	classes = frappe.get_all(
		"LMS Class",
		fields=[
			"name",
			"title",
			"description",
			"start_date",
			"end_date",
			"paid_class",
			"seat_count",
		],
	)

	past_classes, upcoming_classes = [], []
	for class_ in classes:
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
			my_classes_info.append(
				frappe.db.get_value(
					"LMS Class",
					class_,
					["name", "title", "start_date", "end_date", "paid_class", "seat_count"],
					as_dict=True,
				)
			)

		context.my_classes = my_classes_info
