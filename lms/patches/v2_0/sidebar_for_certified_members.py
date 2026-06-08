import frappe
from frappe.utils import cint


def execute():
	lms_settings = frappe.db.get_singles_dict("LMS Settings")
	certified_participant_field_exists = "certified_participants" in lms_settings
	if certified_participant_field_exists:
		show_certified_members = lms_settings.get("certified_participants")

	if certified_participant_field_exists and cint(show_certified_members):
		frappe.db.set_single_value("LMS Settings", "certified_members", 1)
