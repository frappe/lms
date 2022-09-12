import frappe

def execute():
    if not frappe.db.exists("Role", "Course Moderator"):
        role = frappe.get_doc({
            "doctype": "Role",
            "role_name": "Course Moderator",
            "home_page": "/dashboard",
            "desk_access": 0
        })
        role.save(ignore_permissions=True)
