

import frappe
import jwt
from frappe.auth import LoginManager
from frappe import _
from frappe.utils.password import update_password
from frappe import respond_as_web_page

@frappe.whitelist(allow_guest=True)
def login_with_jwt(token, redirect="/app/lms"):
    try:
        # 1. Decode token
        secret = frappe.conf.sso_secret_key
        decoded = jwt.decode(token, secret, algorithms=["HS256"])
        email = decoded.get("email")
        first_name = decoded.get("first_name", "SSO User")

        if not email:
            frappe.throw(_("Email missing in token"))

        # 2. Create user if not exists
        user = frappe.get_value("User", {"email": email})
        if not user:
            user_doc = frappe.get_doc({
                "doctype": "User",
                "email": email,
                "first_name": first_name,
                "enabled": 1
            })
            user_doc.insert(ignore_permissions=True)
            update_password(user_doc.name, "erp@123")
            if frappe.db.exists("Role", "System User"):
                user_doc.add_roles("System User")
            user = user_doc.name

        # 3. Log in
        frappe.local.login_manager = LoginManager()
        frappe.local.login_manager.authenticate(user=email, pwd="erp@123")
        frappe.local.login_manager.post_login()

        # 4. Set cookie
        frappe.local.response["cookie"] = {
            "sid": {
                "value": frappe.session.sid,
                "path": "/",
                "httponly": True,
                "secure": False,  # Set True on HTTPS
                "samesite": "None"
            }
        }

        # 5. Return HTML with JS redirect
        return respond_as_web_page(
            title="Redirecting...",
            html=f"""
            <html>
              <head>
                <script>
                  window.location.href = "{redirect}";
                </script>
              </head>
              <body>
                Logging in, redirecting to LMS...
              </body>
            </html>
            """
        )

    except jwt.ExpiredSignatureError:
        frappe.throw(_("Token has expired"))
    except jwt.InvalidTokenError:
        frappe.throw(_("Invalid token"))
    except Exception:
        frappe.log_error(frappe.get_traceback(), "SSO Login Failed")
        frappe.throw(_("Something went wrong during SSO login."))
