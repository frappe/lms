import frappe
from frappe.model.document import Document

class CourseEnrollmentRequest(Document):
    pass

@frappe.whitelist()
def get_list_query(doctype, txt, filters, limit_start, limit_page_length=20, order_by=None):
    """Custom query to show only own requests to students"""
    user_roles = frappe.get_roles(frappe.session.user)
    
    if frappe.session.user == "Administrator" or "System Manager" in user_roles:
        return filters
    
    # Students see only their own requests
    if "Student" in user_roles:
        filters["student_email"] = frappe.session.user
    
    return filters