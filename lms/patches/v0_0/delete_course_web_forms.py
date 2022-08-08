import frappe

def execute():
    frappe.delete_doc("Web Form", "lesson", ignore_missing=True, force=True)
    frappe.delete_doc("Web Form", "chapter", ignore_missing=True, force=True)
    frappe.delete_doc("Web Form", "course", ignore_missing=True, force=True)
