import frappe
from frappe.query_builder.functions import Count


def execute():
	"""
	create_certificate() checks is_certified() and only inserts if nothing
	turned up, with nothing locking between the check and the insert. Two
	requests for the same member+course close enough together (a doubled
	click on "Get Certificate" is enough) can both pass the check and both
	insert - see https://github.com/frappe/lms/issues/2408. Clear out
	whatever that has already produced before adding the constraint that
	closes the race, keeping the earliest certificate of each duplicate set.
	"""
	Certificate = frappe.qb.DocType("LMS Certificate")
	duplicate_groups = (
		frappe.qb.from_(Certificate)
		.select(Certificate.member, Certificate.course, Certificate.batch_name)
		.groupby(Certificate.member, Certificate.course, Certificate.batch_name)
		.having(Count(Certificate.name) > 1)
	).run(as_dict=True)

	for group in duplicate_groups:
		rows = frappe.get_all(
			"LMS Certificate",
			filters={
				"member": group.member,
				"course": group.course,
				"batch_name": group.batch_name,
			},
			fields=["name"],
			order_by="creation asc",
		)
		for row in rows[1:]:
			frappe.delete_doc("LMS Certificate", row.name, ignore_permissions=True, delete_permanently=True)

	frappe.db.add_unique("LMS Certificate", ["member", "course", "batch_name"])
