import frappe


def execute():
	evaluators = frappe.get_all("Course Evaluator", pluck="name")

	for evaluator in evaluators:
		details = frappe.db.get_value(
			"User", evaluator, ["full_name", "user_image", "username"], as_dict=True
		)
		frappe.db.set_value(
			"Course Evaluator",
			evaluator,
			{
				"full_name": details.full_name,
				"user_image": details.user_image,
				"username": details.username,
			},
		)
