"""Copilot used to ship as the separate ``lms_copilot`` app (module "LMS Copilot").

It now lives in this app as the "Copilot" module. Keep the existing tables and records:
re-home the DocTypes before the model sync, and drop the old app from the site so its
hooks and DocType definitions never load next to ours.
"""

import frappe

OLD_MODULE = "LMS Copilot"
NEW_MODULE = "Copilot"


def execute():
	if not frappe.db.exists("Module Def", NEW_MODULE):
		frappe.get_doc({"doctype": "Module Def", "module_name": NEW_MODULE, "app_name": "lms"}).insert(
			ignore_permissions=True
		)
	frappe.db.set_value("DocType", {"module": OLD_MODULE}, "module", NEW_MODULE, update_modified=False)
	for doctype in ("Report", "Page", "Workspace", "Print Format"):
		if frappe.db.has_column(doctype, "module"):
			frappe.db.set_value(doctype, {"module": OLD_MODULE}, "module", NEW_MODULE, update_modified=False)
	if frappe.db.exists("Module Def", OLD_MODULE):
		frappe.delete_doc("Module Def", OLD_MODULE, force=True, ignore_permissions=True)

	installed = frappe.get_installed_apps()
	if "lms_copilot" in installed:
		frappe.db.set_global("installed_apps", frappe.as_json([app for app in installed if app != "lms_copilot"]))
		frappe.db.delete("Installed Application", {"app_name": "lms_copilot"})
		frappe.clear_cache()
