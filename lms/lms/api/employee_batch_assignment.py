import frappe
import json


@frappe.whitelist()
def bulk_assign_existing_employees(employee_list, batch_name):
	if isinstance(employee_list, str):
		employee_list = json.loads(employee_list)

	assigned = 0
	skipped_no_user = 0
	skipped_existing = 0

	for emp_name in employee_list:
		employee = frappe.get_doc("Employee", emp_name)

		if not employee.user_id:
			skipped_no_user += 1
			continue

		# Check if already enrolled
		exists = frappe.db.exists(
			"LMS Batch Enrollment",
			{
				"member": employee.user_id,
				"batch": batch_name,
			},
		)

		if exists:
			skipped_existing += 1
			continue

		frappe.get_doc(
			{
				"doctype": "LMS Batch Enrollment",
				"member": employee.user_id,
				"batch": batch_name,
			}
		).insert(ignore_permissions=True)

		assigned += 1

	return {
		"assigned": assigned,
		"skipped_no_user": skipped_no_user,
		"skipped_existing": skipped_existing,
	}
