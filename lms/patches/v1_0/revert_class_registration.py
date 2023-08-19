import frappe


def execute():
	if frappe.db.exists("DocType", "Class Student Registration"):
		frappe.reload_doc("lms", "doctype", "class_student")

		students = frappe.get_all("Class Student", fields=["name", "student"])
		for student in students:
			student_details = frappe.db.get_value(
				"User", student.student, ["full_name", "username"], as_dict=1
			)
			frappe.db.set_value(
				"Class Student",
				student.name,
				{
					"class_student": None,
					"student_name": student_details.full_name,
					"username": student_details.username,
				},
			)

		frappe.delete_doc("DocType", "Class Student Registration")
