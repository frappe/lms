import frappe


def execute():
	"""Add the composite (batch, member) index the Raven 'Students of Batches' lookup needs; idempotent. Fresh installs skip patches, so after_install adds it too."""
	if not frappe.db.table_exists("LMS Batch Enrollment"):
		return
	frappe.db.add_index("LMS Batch Enrollment", ["batch", "member"])
