import frappe
from frappe.installer import add_to_installed_apps, remove_from_installed_apps


def execute():

	if "school" in frappe.db.get_global("installed_apps"):
		remove_from_installed_apps("school")
		add_to_installed_apps("lms")
