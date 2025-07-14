import frappe


def execute():

	frappe.db.delete("DocType", {"module": "Conference"})
	frappe.db.delete("DocType", {"module": "Hackathon"})
	frappe.db.delete("DocType", {"module": "Event Management"})

	frappe.db.delete("Web Form", {"module": "Conference"})
	frappe.db.delete("Web Form", {"module": "Hackathon"})
	frappe.db.delete("Web Form", {"module": "Event Management"})

	frappe.db.delete("Module Def", "Conference")
	frappe.db.delete("Module Def", "Hackathon")
	frappe.db.delete("Module Def", "Event Management")
