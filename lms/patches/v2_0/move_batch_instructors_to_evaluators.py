import frappe


def execute():
	batch_instructors = frappe.get_all(
		"Course Instructor",
		{
			"parenttype": "LMS Batch",
		},
		["name", "instructor", "parent"],
	)

	for instructor in batch_instructors:
		if not frappe.db.exists(
			"Course Evaluator",
			{
				"evaluator": instructor.instructor,
			},
		):
			doc = frappe.new_doc("Course Evaluator")
			doc.evaluator = instructor.instructor
			doc.insert()
