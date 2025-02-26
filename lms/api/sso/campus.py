import frappe
from frappe import _
from frappe.utils.oauth import redirect_post_login


@frappe.whitelist(allow_guest=True)
def login_via_campus(key: str, user_details: dict):
    """API Endpoint to allow Space/ Myonlineoffice clients to login to the helpdesk and create Tickets"""
    try:
        if not validate_evidhya_key(key):
            frappe.throw("Invalid Key")

        user_details = frappe._dict(user_details)
        validate_campus_user(user_details)
        email = user_details.email
        frappe.local.login_manager.login_as(email)

        redirect_to = "/app/"
        redirect_post_login(
            desk_user=frappe.db.get_value("User", frappe.session.user, "user_type")
            == "System User",
            redirect_to=redirect_to,
        )

    except Exception as e:
        frappe.log_error(
            title="Error in login_via_campus", message=frappe.get_traceback(e)
        )
        frappe.respond_as_web_page(
            _("Login Error"),
            _("Authentication failed. Please try again."),
            http_status_code=401,
            indicator_color="red",
        )


def validate_evidhya_key(key):
    doc = frappe.get_single("Evidhya Settings")
    actual_key = doc.get("evidhya_key")

    if not actual_key or not doc.enabled:
        frappe.throw("Regerate the Key or Enable the Evidhya Settings")

    if actual_key == key:
        return True

    return False


def validate_campus_user(user_details: dict):
    user = user_details.get("email")

    if not frappe.db.exists("User", user):
        # Create new user if doesn't exist
        user_doc = frappe.new_doc("User")
        user_doc.email = user
        user_doc.first_name = user_details.first_name or "Evidhya User"
        user_doc.enabled = True
    else:
        # Update existing user
        user_doc = frappe.get_doc("User", user)

    # Update user details from payload
    user_doc.update(
        {
            **user_details,
            "roles": [{"role": "LMS Student"}],
        }
    )

    user_doc.save(ignore_permissions=True)
    return True
