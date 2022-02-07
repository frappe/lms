import frappe

def execute():
    frappe.get_all("LMS Course", fields=["name", "instructor"])
