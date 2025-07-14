import frappe


def execute():
	frappe.reload_doc("community", "doctype", "community_member")
	docs = frappe.get_all("Community Member")
	for doc in docs:
		member = frappe.get_doc("Community Member", doc.name)
		if not member.abbr:
			abbr = ("").join([s[0] for s in member.full_name.split()])
			frappe.db.set_value("Community Member", member.name, "abbr", abbr)
