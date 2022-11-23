import frappe
from frappe import _
from lms.lms.utils import has_course_moderator_role


def get_context(context):

	if not has_course_moderator_role():
		message = "Only Moderators have access to this page."
		if frappe.session.user == "Guest":
			message = "Please login to access this page."

		raise frappe.PermissionError(_(message))
