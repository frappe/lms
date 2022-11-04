import frappe
from frappe.installer import add_to_installed_apps, remove_from_installed_apps


def execute():

	if "community" in frappe.db.get_global("installed_apps"):
		remove_from_installed_apps("community")
		add_to_installed_apps("school")
