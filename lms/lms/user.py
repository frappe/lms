import frappe
from frappe import _
from frappe.model.naming import append_number_if_name_exists
from frappe.website.utils import cleanup_page_name
from frappe.website.utils import is_signup_disabled
from frappe.utils import random_string, escape_html
from lms.lms.utils import get_country_code
import random
import string
import frappe
from frappe.utils.password import update_password

def validate_username_duplicates(doc, method):
	while not doc.username or doc.username_exists():
		doc.username = append_number_if_name_exists(
			doc.doctype, cleanup_page_name(doc.full_name), fieldname="username"
		)
	if " " in doc.username:
		doc.username = doc.username.replace(" ", "")

	if len(doc.username) < 4:
		doc.username = doc.email.replace("@", "").replace(".", "")


def after_insert(doc, method):
	doc.add_roles("LMS Student")

## FUNCTIONS FOR CUSTOM SIGNUP FLOW

def generate_and_save_otp():
	otp = "123456"
	return otp

def create_user_from_employee(self, method=None):
	full_name = self.first_name + " " + self.last_name if self.last_name else self.first_name
	email = self.company_email 
	country = self.country 

	print( "email", email, "country", country)
	# Check if user already exists
	try:
		if not frappe.db.exists("User", email):
			new_password = frappe.generate_hash(length=10)

			if not self.user_id:
				# if user is not created, then create user
				self.user_id = frappe.get_doc(
					{
						"doctype": "User",
						"email": self.company_email,
						"first_name": self.first_name,
						"full_name": full_name,
						"enabled": 1,
						"user_type": "Website User",						
						"new_password": new_password,
						"user_category": "Employee",
						"mobile_no": self.employee_number,
						"send_welcome_email": 0,
					}
					).insert(ignore_permissions=True).email
			
				update_password(email, new_password)
				
				# Update self in the database
				frappe.sendmail(
					recipients=[self.company_email],	
					sender='noreply@merlinlms.com',
					subject='Test Email',	
					message=f'<p>Hello {self.first_name} from meril lms for your email {self.company_email} your password is : {new_password} </p>'
				)

				# self.db_set("user_id", self.user_id)
		else:
				frappe.throw(_("A user with this email already exists."))
		
		print("User created successfully")
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Employee Creation Process Failed")
		frappe.throw(_("An error occurred during employee creation: {0}").format(str(e)))


def generate_password(length=10):
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

def create_user_from_distributor(self, method=None):
    email = self.distributor_email_address
    country = self.country

    print("email", email, "country", country)

    try:
        if not frappe.db.exists("User", email):
            new_password = generate_password()

            if not self.user_id:
                # Create the user
                user = frappe.get_doc({
                    "doctype": "User",
                    "email": email,
                    "enabled": 1,
                    "user_type": "Website User",
                    "send_welcome_email": 0,
					"mobile_no": self.distributor_contact_number,
					"first_name": email.split('@')[0],  # Use email prefix as first name
                    "user_category": "Distributor",
			"roles": [
				{"role": "Distributor"},
				{"role": "LMS Student"}
			],
			"country": country
		}).insert(ignore_permissions=True)

                update_password(email, new_password)
                print("user", user)
                self.db_set("user_id", user.name)

                frappe.sendmail(
                    recipients=[email],
                    sender='noreply@merlinlms.com',
                    subject='Your Merlin LMS Account',
                    message=f'<p>Hello {email},<br>Your password is: <b>{new_password}</b><br>Regards,<br>Merlin LMS</p>'
                )
        else:
            frappe.throw(_("A user with this email already exists."))

        print("User created successfully")

    except Exception as e:
        print("ERROR:", str(e))
        frappe.log_error(frappe.get_traceback(), "Distributor Creation Process Failed")
        frappe.throw(_("An error occurred during distributor creation: {0}").format(str(e)))


@frappe.whitelist(allow_guest=False)
def get_unlocked_status():
	frappe.session.user

@frappe.whitelist(allow_guest=False)
def send_otp(category=None):
    """
    Sends OTPs to the currently logged-in user's email and/or mobile number.
    """
    user = frappe.session.user

    # Fetch the User documen
    user_doc = frappe.get_doc("User", user)

    # Pull email and mobile off the User doc
    email = user_doc.email or None
    mobile = user_doc.get("mobile_no") or user_doc.get("mobile") or None

    if not email and not mobile:
        return {"success": False, "error": "No email or mobile number found on your user profile."}

    response = {"success": True, "messages": []}

    # Generate OTPs
    email_otp = generate_and_save_otp(email) if email else None
    mobile_otp = generate_and_save_otp(email) if mobile else None

    # Send Email OTP
    if email:
        try:
            frappe.utils.validate_email_address(email, throw=True)
            frappe.sendmail(
                recipients=[email],
                sender='noreply@merlinlms.com',
                subject='Your Merlin LMS OTP',
                message=f'<p>Hello {user_doc.full_name or user}, your email OTP is: <b>{email_otp} your mobbile otp is {mobile_otp} </b></p>'
            )
            response["messages"].append(f"Email OTP sent to {email}")
        except Exception as e:
            return {"success": False, "error": f"Failed to send email OTP: {e}"}

    # Send Mobile OTP (simulate SMS sending)
    # if mobile:
    #     try:
    #         # TODO: replace print with your SMS gateway integration
    #         print(f"SMS OTP to {mobile}: {mobile_otp}")
    #         response["messages"].append(f"SMS OTP sent to {mobile}")
    #     except Exception as e:
    #         return {"success": False, "error": f"Failed to send SMS OTP: {e}"}

    return response


@frappe.whitelist(allow_guest=True)
def validate_otp(email, otp):
	if not email or not otp:
		frappe.throw(_("Email and OTP are required"), _("Validation Error"))

	# Here you would typically validate the OTP against a stored value
	# For demonstration, we assume the OTP is always valid
	if otp == "123456":
		return {"message": _("OTP is valid"), "data": distributor_details, "success": True }
	else:
		return {"message": _("Invalid OTP"), "success": False}

# Dummy distributor details object
distributor_details = {
    "division": "Diagnostics",
    "meril_company_name": "Meril Life Sciences",
    "bu_fd_head": "John Doe",
    "rsm_state_head": "Jane Smith",
    "region": "West",
    "state": "Maharashtra",
    "city": "Mumbai",
    "distributor_code": "D12345",
    "distributor_company_name": "ABC Distributors",
    "distributor_email": "abc@distributor.com",
    "distributor_address": "123, Main Street, Mumbai",
    "distributor_contact": "9876543210"
}


@frappe.whitelist(allow_guest=True)
def sign_up(email, full_name, verify_terms, user_category):
	if is_signup_disabled():
		frappe.throw(_("Sign Up is disabled"), _("Not Allowed"))

	user = frappe.db.get("User", {"email": email})
	if user:
		if user.enabled:
			return 0, _("Already Registered")
		else:
			return 0, _("Registered but disabled")
	else:
		if frappe.db.get_creation_count("User", 60) > 300:
			frappe.respond_as_web_page(
				_("Temporarily Disabled"),
				_(
					"Too many users signed up recently, so the registration is disabled. Please try back in an hour"
				),
				http_status_code=429,
			)

	user = frappe.get_doc(
		{
			"doctype": "User",
			"email": email,
			"first_name": escape_html(full_name),
			"verify_terms": verify_terms,
			"user_category": user_category,
			"country": "",
			"enabled": 1,
			"new_password": random_string(10),
			"user_type": "Website User",
		}
	)
	user.flags.ignore_permissions = True
	user.flags.ignore_password_policy = True
	user.insert()

	# set default signup role as per Portal Settings
	default_role = frappe.db.get_single_value("Portal Settings", "default_role")
	if default_role:
		user.add_roles(default_role)

	user.add_roles("LMS Student")
	set_country_from_ip(None, user.name)

	if user.flags.email_sent:
		return 1, _("Please check your email for verification")
	else:
		return 2, _("Please ask your administrator to verify your sign-up")


def set_country_from_ip(login_manager=None, user=None):
	if not user and login_manager:
		user = login_manager.user
	user_country = frappe.db.get_value("User", user, "country")
	# if user_country:
	#    return
	frappe.db.set_value("User", user, "country", get_country_code())
	return


def on_login(login_manager):
	user_id = login_manager.user
	user_doc = frappe.get_doc("User", user_id)
	roles = [user.role for user in user_doc.roles]

	if "Distributor" in roles:
		distributor = frappe.db.get_value(
			"Distributor",
			{"user_id": user_doc.email},
			["name", "distributor_edited_fields_once"],
			as_dict=True
		)

		print("Distributor:", distributor,"edited once", distributor.distributor_edited_fields_once)
		if distributor:
			if distributor.distributor_edited_fields_once == 1:
				frappe.local.response["home_page"] = "/lms"
			else:
				frappe.local.response["home_page"] = "/edit-distributor-profile"
		else:
			frappe.log_error(f"No Distributor found for user: {user_doc.name}", "on_login")

	else:
		default_app = frappe.db.get_single_value("System Settings", "default_app")
		if default_app == "lms":
			frappe.local.response["home_page"] = "/lms"




