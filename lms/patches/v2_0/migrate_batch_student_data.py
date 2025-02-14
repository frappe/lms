import frappe


def execute():
	students = frappe.get_all(
		"Batch Student",
		fields=[
			"student",
			"student_name",
			"username",
			"payment",
			"source",
			"parent",
			"confirmation_email_sent",
		],
	)

	for student in students:
		if not frappe.db.exists(
			"LMS Batch Enrollment", {"member": student.student, "batch": student.parent}
		):
			doc = frappe.new_doc("LMS Batch Enrollment")
			doc.member = student.student
			doc.member_name = student.student_name
			doc.member_username = student.username
			doc.payment = student.payment
			doc.source = student.source
			doc.batch = student.parent
			doc.confirmation_email_sent = student.confirmation_email_sent
			doc.save()
