import frappe
from frappe.model.naming import make_autoname
from frappe.model.rename_doc import rename_doc


def execute():
	frappe.reload_doc("community", "doctype", "community_member")
	docs = frappe.get_all("Community Member")
	for doc in docs:
		member = frappe.get_doc("Community Member", doc.name)
		name = make_autoname("hash", "Community Member")
		rename_doc(
			"Community Member",
			member.name,
			name,
			force=True,
			merge=False,
			ignore_permissions=True,
			ignore_if_exists=False,
		)
