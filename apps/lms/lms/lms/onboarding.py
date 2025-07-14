import frappe


def get_first_course():
	course = frappe.get_all(
		"LMS Course",
		fields=["name"],
		order_by="creation",
		limit=1,
	)
	return course[0].name if course else None


def get_first_batch():
	batch = frappe.get_all(
		"LMS Batch",
		fields=["name"],
		order_by="creation",
		limit=1,
	)
	return batch[0].name if batch else None
