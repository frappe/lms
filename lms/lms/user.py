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
	# This function should generate an OTP and save it to the database or session
	# For demonstration, we will just return a static OTP
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
						"send_welcome_email": 0,
					}
					).insert(ignore_permissions=True).email
			

				
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
                    "new_password": new_password,
                    "send_welcome_email": 0,
                    "user_category": "Distributor",
                }).insert(ignore_permissions=True)

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


@frappe.whitelist(allow_guest=True)
def send_otp(email, category=None):
	if not email:
		frappe.throw(_("Email is required"), _("Validation Error"))

	try:
		frappe.utils.validate_email_address(email, throw=True)
	except frappe.ValidationError:
		frappe.throw(_("Invalid email address"), _("Validation Error"))

	otp = generate_and_save_otp()

	res = frappe.sendmail(
		recipients=[email],
		sender='noreply@merlinlms.com',
		subject='Test Email',
		message=f'<p>Hello Priyansh from merlin lms your otp is : {otp} </p>'
	)

	print("otp send res: ", res)
	return {"message": _("Email sent  successfully to {0}").format(email), "status": "success"}

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
	user = frappe.get_doc("User", frappe.session.user)
	user_category = user.get("user_category")

	if user_category == "Distributor":
		# Check if distributor_edited_fields is truthy
		if user.get("distributor_edited_fields"):
			frappe.local.response["home_page"] = "/lms"
		else:
			#redirect to profile edit page
			frappe.local.response["home_page"] = "/edit-distributor-profile"
	else:
		# For other users, route to LMS if it's the default app
		default_app = frappe.db.get_single_value("System Settings", "default_app")
		if default_app == "lms":
			frappe.local.response["home_page"] = "/lms"

