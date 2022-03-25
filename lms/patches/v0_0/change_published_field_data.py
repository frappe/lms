import frappe

def execute():
    courses = frappe.get_all("LMS Course", fields=["name", "is_published"])
    for course in courses:
        frappe.db.set_value("LMS Course", course.name, "published", course.is_published)
