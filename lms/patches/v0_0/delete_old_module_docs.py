import frappe

def execute():

    frappe.db.delete("DocType", {"module": "Conference"})
    frappe.db.delete("DocType", {"module": "Hackathon"})
    frappe.db.delete("DocType", {"module": "Event Management"})
