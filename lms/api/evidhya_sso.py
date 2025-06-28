# import frappe
# import jwt
# from frappe.utils import now_datetime
# from frappe.auth import LoginManager
# from frappe import _
# from datetime import datetime
# from jwt.exceptions import ExpiredSignatureError, InvalidTokenError


# @frappe.whitelist(allow_guest=True)
# def login_with_jwt(token: str = None, redirect: str = "/app"):
#     if not token:
#         frappe.throw(_("Missing token"))

#     try:
#         secret = frappe.conf.sso_secret_key or "secret"
#         decoded = jwt.decode(token, secret, algorithms=["HS256"])

#         email = decoded.get("email")
#         exp = decoded.get("exp")

#         if not email or not exp:
#             frappe.throw(_("Invalid token"))

#         if datetime.utcfromtimestamp(exp) < datetime.utcnow():
#             frappe.throw(_("Token has expired"))

#         user = frappe.db.exists("User", email)
#         if not user:
#             # Auto create user if not exists
#             user = frappe.get_doc(
#                 {
#                     "doctype": "User",
#                     "email": email,
#                     "first_name": email.split("@")[0],
#                     "enabled": 1,
#                     "new_password": frappe.generate_hash(),
#                 }
#             )
#             user.insert(ignore_permissions=True)
#             frappe.db.commit()

#         # Log in the user using LoginManager
#         frappe.local.login_manager = LoginManager()
#         frappe.local.login_manager.user = email
#         frappe.local.login_manager.post_login()

#         # Set session cookie
#         frappe.response["type"] = "redirect"
#         frappe.response["location"] = redirect
#         frappe.local.response["cookie"] = {
#             "sid": {
#                 "value": frappe.session.sid,
#                 "path": "/",
#                 "httponly": 1,
#                 "secure": 0,  # Set to 1 if HTTPS
#             }
#         }

#     except ExpiredSignatureError:
#         frappe.throw(_("Token has expired."))
#     except InvalidTokenError:
#         frappe.throw(_("Invalid token."))
#     except Exception as e:
#         frappe.log_error(frappe.get_traceback(), "JWT Login Failed")
#         frappe.throw(_("Something went wrong during SSO login."))
import frappe
import jwt
from frappe.auth import LoginManager
from frappe import _


@frappe.whitelist(allow_guest=True)
def login_with_jwt(token, redirect="/app"):
    try:
        # 1. Decode JWT
        secret = frappe.conf.sso_secret_key
        decoded = jwt.decode(token, secret, algorithms=["HS256"])

        email = decoded.get("email")
       
        if not email:
            frappe.throw(_("Email missing in token"))

        # 2. Create user if not exists
        user = frappe.get_value("User", {"email": email})
        
        if not user:
            user_doc = frappe.get_doc(
                {
                    "doctype": "User",
                    "email": email,
                    "first_name": decoded.get("first_name", "SSO User"),
                    "enabled": 1,
                }
            )
            user_doc.insert(ignore_permissions=True)
            user = user_doc.name
        else:
            user = email

        # 3. Set login session
        frappe.set_user(user)
        print(f"User logged in: {user}")
        frappe.local.login_manager = LoginManager()
        frappe.local.login_manager.user = user
        frappe.local.login_manager.post_login()

        # 4. Set cookie using Frappe’s built-in cookie system
        frappe.local.response["type"] = "redirect"
        frappe.local.response["location"] = redirect
        frappe.local.response["cookie"] = {
            "sid": {
                "value": frappe.session.sid,
                "path": "/",
                "httponly": False,  # Set to True in production
                "secure": False,  # Set to True if using HTTPS
                "samesite": "Lax",
            }
        }

    except jwt.ExpiredSignatureError:
        frappe.throw(_("Token has expired"))
    except jwt.InvalidTokenError:
        frappe.throw(_("Invalid token"))
    except Exception:
        frappe.log_error(frappe.get_traceback(), "SSO Login Failed")
        frappe.throw(_("Something went wrong during SSO login."))
