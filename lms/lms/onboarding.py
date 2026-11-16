import frappe
from frappe import _

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


def needs_password_setup() -> bool:
	"""A Frappe Cloud site owner arrives signed in but with no password; on a framework that knows
	the case, the setup flow asks for one first."""
	try:
		from frappe.core.doctype.user.user import needs_password_setup as framework_says
	except ImportError:
		return False
	return bool(framework_says())


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
