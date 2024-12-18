import frappe

def assign_custom_role(doc, method):
    """
    Assign a custom role to users created through self-signup.
    """
    # Check if the user was created via self-signup
    if doc.user_type == "Website User":
        custom_role = "Temp Student"  # Replace with your custom role name

        if not frappe.db.exists("Has Role", {"parent": doc.name, "role": custom_role}):
            doc.add_roles(custom_role)