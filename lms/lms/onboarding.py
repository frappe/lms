import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import today

ONBOARDING_ROLES = ("System Manager", "Moderator")


@frappe.whitelist()
def get_first_course() -> str | None:
	frappe.only_for(ONBOARDING_ROLES)
	course = frappe.get_all(
		"LMS Course",
		fields=["name"],
		order_by="creation",
		limit=1,
	)
	return course[0].name if course else None


# The goal an admin picks in setup orders their getting-started checklist.
FIRST_GOAL = "lms_first_goal"
# The choices the setup page offers, as `setupQuestions.js` names them.
FIRST_GOALS = (
	"Publish my first course",
	"Onboard my existing learners",
	"Award my first certificate",
	"Launch a paid course",
	"Just exploring",
)


@frappe.whitelist()
def get_setup_state() -> dict:
	"""Whether to send this admin to setup, and the goal they picked there."""
	frappe.only_for(ONBOARDING_ROLES)
	from lms.lms.telemetry import DEMO_COURSE_TITLE

	if not frappe.is_setup_complete():
		from frappe.desk.page.setup_wizard.setup_wizard import get_setup_wizard_url

		return {"needs_setup": True, "setup_url": get_setup_wizard_url()}

	asked = frappe.db.get_single_value("LMS Settings", "persona_captured")
	has_courses = frappe.db.count("LMS Course", {"title": ["!=", DEMO_COURSE_TITLE]})
	needs_password = needs_password_setup()
	needs_questions = not asked and not has_courses
	return {
		"needs_setup": needs_password or needs_questions,
		"needs_password": needs_password,
		"needs_questions": needs_questions,
		"first_goal": frappe.db.get_default(FIRST_GOAL),
		"can_send_email": can_send_email(),
	}


def needs_password_setup(user: str | None = None) -> bool:
	"""A Frappe Cloud site owner arrives signed in but with no password, and the setup flow asks
	for one first. Frappe's own check skips Frappe Cloud v2 and sites with email login links,
	which is every trial site, so Learning asks wherever a password can be used to sign in."""
	from frappe.utils.password import has_password

	user = user or frappe.session.user
	if user in ("Administrator", "Guest") or has_password(user):
		return False
	if frappe.get_system_settings("disable_user_pass_login"):
		return False
	if frappe.db.get_single_value("LDAP Settings", "enabled"):
		return False
	return not frappe.db.exists(
		"User Social Login",
		{"parenttype": "User", "parent": user, "provider": ["!=", "frappe"], "userid": ["is", "set"]},
	)


@frappe.whitelist(methods=["POST"])
@rate_limit(limit=5, seconds=60)
def set_first_password(new_password: str) -> None:
	"""Frappe's set_first_password with Learning's check, so the framework's password step saves
	on the sites Frappe's own check skips. hooks.py points the framework's method here."""
	from frappe.core.doctype.user.user import handle_password_test_fail, test_password_strength
	from frappe.utils.password import update_password

	try:
		from frappe.utils.password import MAX_PASSWORD_SIZE
	except ImportError:
		from frappe.auth import MAX_PASSWORD_SIZE

	if frappe.request and frappe.get_request_header("Authorization"):
		frappe.throw(_("Set your first password from a signed-in browser."), frappe.PermissionError)
	if not new_password or not new_password.strip():
		frappe.throw(_("Enter a password."), title=_("Invalid Password"))
	if len(new_password) > MAX_PASSWORD_SIZE:
		frappe.throw(_("{0} size exceeded the maximum allowed size.").format(_("New Password")))
	if not needs_password_setup():
		frappe.throw(_("You already have a password. Change it from your settings."), frappe.PermissionError)
	user = frappe.get_doc("User", frappe.session.user)
	feedback = test_password_strength(
		new_password,
		user_data=(user.first_name, user.middle_name, user.last_name, user.email, user.birth_date),
	)
	if feedback and not feedback.get("feedback", {}).get("password_policy_validation_passed", False):
		handle_password_test_fail(feedback)
	update_password(user.name, new_password, logout_all_sessions=False)
	frappe.db.set_value("User", user.name, {"last_password_reset_date": today(), "reset_password_key": ""})


def can_send_email() -> bool:
	from frappe.email.doctype.email_account.email_account import EmailAccount

	return bool(EmailAccount.find_default_outgoing())


@frappe.whitelist(methods=["POST"])
def save_setup(first_goal: str | None = None) -> None:
	"""Mark setup as answered, and keep the goal for the checklist."""
	frappe.only_for("System Manager")
	if first_goal and first_goal not in FIRST_GOALS:
		frappe.throw(_("Pick one of the goals shown in setup."))
	if first_goal:
		frappe.db.set_default(FIRST_GOAL, first_goal)
	frappe.db.set_single_value("LMS Settings", "persona_captured", 1)
