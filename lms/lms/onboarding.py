import frappe

ONBOARDING_ROLES = ("System Manager", "Moderator")


@frappe.whitelist()
def get_first_course() -> str | None:
	frappe.only_for(ONBOARDING_ROLES)
	course = frappe.get_all(
		"LMS Course",
		fields=["name"],
		order_by="creation",
		limit=1,
	)
	return course[0].name if course else None


@frappe.whitelist()
def get_first_batch() -> str | None:
	frappe.only_for(ONBOARDING_ROLES)
	batch = frappe.get_all(
		"LMS Batch",
		fields=["name"],
		order_by="creation",
		limit=1,
	)
	return batch[0].name if batch else None
