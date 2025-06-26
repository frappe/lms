import frappe
from frappe.utils import cint

@frappe.whitelist(allow_guest=False)
def post_session_creation(session):

    roles = frappe.get_roles()
    print("Roles:", roles)
    if "Distributor" in roles:
        d = frappe.db.get_value(
            "Distributor",
            {"user_id": frappe.session.user},
            "distributor_edited_fields_once",
            as_dict=True
        )
        edited = cint(d.distributor_edited_fields_once)
        # Override redirect
        frappe.local.flags.redirect_location = edited and "/lms" or "/edit-distributor-profile"