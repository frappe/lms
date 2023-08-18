import frappe


def execute():
	frappe.reload_doc("lms", "doctype", "class_student")
	frappe.reload_doc("lms", "doctype", "class_student_registration")

	students = frappe.get_all(
		"Class Student", {"parent": ["is", "set"]}, ["name", "student", "parent"]
	)

	for student in students:
		student_details = frappe.db.get_value(
			"User", student.student, ["full_name", "username"], as_dict=1
		)
		registration = frappe.new_doc("Class Student Registration")
		registration.member = student.student
		registration.member_name = student_details.full_name
		registration.member_username = student_details.username
		registration.class_name = student.parent
		registration.save()

		frappe.db.set_value("Class Student", student.name, "class_student", registration.name)
