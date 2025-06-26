import frappe
import random
from datetime import timedelta
from frappe.utils import now_datetime, validate_email_address, get_datetime


@frappe.whitelist(allow_guest=False)
def verify_email_otp(otp=None, otp1=None):
    user = frappe.session.user
    if user == "Guest":
        return {"status": "error", "message": "Please log in to verify OTP"}

    email = frappe.db.get_value("User", user, "email")
    mobile = frappe.db.get_value("User", user, "mobile_no")

    if not email or (not otp and not otp1):
        return {"status": "error", "message": "Missing email or OTP"}
    
    if not mobile or (not otp and not otp1):
        return {"status": "error", "message": "Missing email or OTP"}

    filters = {
        "email": email,
        "is_verified": 0
    }

    if otp:
        filters["email_otp"] = otp
    if otp1:
        filters["mobile_otp"] = otp1

    otp_doc = frappe.get_all("Custom Auth Data",
        filters=filters,
        fields=[
            "name",
            "email_otp_expiry_datetime",
            "mobile_otp_expiry_datetime",
            "email_otp",
            "mobile_otp",
            "otp_attempts_remaining",
            "is_expired"
        ],
        order_by="creation desc", limit_page_length=1
    )

    now = now_datetime()

    if not otp_doc:
        # Reduce attempt count if OTP doesn't match
        latest_doc = frappe.get_all("Custom Auth Data",
            filters={"email": email, "is_verified": 0},
            fields=["name", "otp_attempts_remaining", "is_expired"],
            order_by="creation desc", limit_page_length=1
        )
        if latest_doc:
            doc = frappe.get_doc("Custom Auth Data", latest_doc[0].name)
            if not doc.is_expired:
                doc.otp_attempts_remaining -= 1
                if doc.otp_attempts_remaining <= 0:
                    doc.is_expired = 1
                doc.save(ignore_permissions=True)
        return {"status": "error", "message": "Invalid OTP"}

    otp_doc = otp_doc[0]

    email_expired = otp_doc.email_otp and now > get_datetime(otp_doc.email_otp_expiry_datetime)
    mobile_expired = otp_doc.mobile_otp and now > get_datetime(otp_doc.mobile_otp_expiry_datetime)

    valid = False
    if otp and otp == otp_doc.email_otp and not email_expired:
        valid = True
    elif otp1 and otp1 == otp_doc.mobile_otp and not mobile_expired:
        valid = True

    doc = frappe.get_doc("Custom Auth Data", otp_doc.name)

    if valid and not doc.is_expired:
        doc.is_verified = 1
        doc.unlocked_at = now
        doc.locked_at = now + timedelta(minutes=60)
        doc.user = user
        doc.save(ignore_permissions=True)
        return {"status": "success", "message": "OTP verified and user unlocked"}

    else:
        if not doc.is_expired:
            doc.otp_attempts_remaining -= 1
            if doc.otp_attempts_remaining <= 0:
                doc.is_expired = 1
            doc.save(ignore_permissions=True)

        return {"status": "error", "message": "OTP expired or invalid"}


@frappe.whitelist(allow_guest=False)
def send_email_otp():
    user = frappe.session.user
    if user == "Guest":
        return {"status": "error", "message": "Please log in to send OTP"}

    email = frappe.db.get_value("User", user, "email")
    mobile = frappe.db.get_value("User", user, "mobile_no")

    if not email:
        return {"status": "error", "message": "User email not found"}

    now = now_datetime()

    latest_doc = frappe.get_all("Custom Auth Data", filters={
        "email": email,
        "is_verified": 0,
        "is_expired": 0
    }, fields=[
        "name", "email_otp", "mobile_otp",
        "email_otp_expiry_datetime", "mobile_otp_expiry_datetime"
    ], order_by="creation desc", limit=1)

    email_otp = str(random.randint(100000, 999999))
    mobile_otp = str(random.randint(100000, 999999))

    if latest_doc:
        otp_info = latest_doc[0]
        email_expired = otp_info.email_otp_expiry_datetime and now > otp_info.email_otp_expiry_datetime
        mobile_expired = otp_info.mobile_otp_expiry_datetime and now > otp_info.mobile_otp_expiry_datetime

        if email_expired and mobile_expired:
            old_doc = frappe.get_doc("Custom Auth Data", otp_info.name)
            old_doc.is_expired = 1
            old_doc.save(ignore_permissions=True)

            new_doc = frappe.get_doc({
                "doctype": "Custom Auth Data",
                "email": email,
                "email_otp": email_otp,
                "mobile_otp": mobile_otp,
                "email_otp_expiry_datetime": now + timedelta(minutes=15),
                "mobile_otp_expiry_datetime": now + timedelta(minutes=15),
                "otp_attempts_remaining": 3,
                "is_verified": 0,
                "is_expired": 0,
                "user": user
            })
            new_doc.insert(ignore_permissions=True)

            frappe.sendmail(
                recipients=[email],
                subject="Your Email OTP Code (Resent)",
                message=f"Your Email OTP is <b>{email_otp}</b>. It will expire in 15 minutes.",
                now=True
            )
            frappe.sendmail(
                recipients=[email],
                subject="Your Mobile OTP Code (Resent)",
                message=f"Your Mobile OTP is <b>{mobile_otp}</b>. It will expire in 15 minutes.",
                now=True
            )

            return {"status": "resent", "message": "Previous OTPs resent in a new record"}

    new_doc = frappe.get_doc({
        "doctype": "Custom Auth Data",
        "email": email,
        "email_otp": email_otp,
        "mobile_otp": mobile_otp,
        "email_otp_expiry_datetime": now + timedelta(minutes=15),
        "mobile_otp_expiry_datetime": now + timedelta(minutes=15),
        "otp_attempts_remaining": 3,
        "is_verified": 0,
        "is_expired": 0,
        "user": user
    })

    new_doc.insert(ignore_permissions=True)

    frappe.sendmail(
        recipients=[email],
        subject="Your Email OTP Code",
        message=f"Your Email OTP is <b>{email_otp}</b>. It will expire in 15 minutes.",
        now=True
    )
    frappe.sendmail(
        recipients=[email],
        subject="Your Mobile OTP Code",
        message=f"Your Mobile OTP is <b>{mobile_otp}</b>. It will expire in 15 minutes.",
        now=True
    )

    return {"status": "new", "message": "New OTPs sent"}


@frappe.whitelist(allow_guest=False)
def get_user_status():
    user = frappe.session.user
    if user == "Guest":
        return {"status": "error", "message": "Please log in to check status"}

    email = frappe.db.get_value("User", user, "email")
    if not email:
        return {"status": "error", "message": "Email not found"}

    try:
        auth_data = frappe.get_all("Custom Auth Data",
            filters={"email": email, "is_verified": 1},
            fields=["name", "locked_at", "unlocked_at"],
            order_by="creation desc", limit=1
        )

        if not auth_data:
            return {"status": "error", "message": "No verification data found"}

        auth = auth_data[0]
        now = now_datetime()

        if auth.get("locked_at") and now > auth.get("locked_at"):
            return {"status": "locked", "message": "Session expired. Please verify OTP again."}

        return {"status": "unlocked", "message": "User is unlocked."}

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_user_status error")
        return {"status": "error", "message": str(e)}
