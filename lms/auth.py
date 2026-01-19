import frappe

ALLOWED_PATHS = [
	"/api/method/ping",
	"/api/method/login",
	"/api/method/logout",
	"/api/method/frappe.core.doctype.communication.email.mark_email_as_seen",
	"/api/method/frappe.realtime.get_user_info",
	"/api/method/frappe.realtime.can_subscribe_doc",
	"/api/method/frappe.realtime.can_subscribe_doctype",
	"/api/method/frappe.realtime.has_permission",
	"/api/method/frappe.integrations.oauth2.authorize",
	"/api/method/frappe.integrations.oauth2.approve",
	"/api/method/frappe.integrations.oauth2.get_token",
	"/api/method/frappe.integrations.oauth2.openid_profile",
	"/api/method/frappe.website.doctype.web_page_view.web_page_view.make_view_log",
	"/api/method/upload_file",
	"/api/method/frappe.search.web_search",
	"/api/method/frappe.email.queue.unsubscribe",
	"/api/method/frappe.website.doctype.web_form.web_form.accept",
	"/api/method/frappe.core.doctype.user.user.test_password_strength",
	"/api/method/frappe.core.doctype.user.user.update_password",
	"/api/method/frappe.utils.telemetry.pulse.client.is_enabled",
	"/api/method/frappe.client.get_value",
	"/api/method/frappe.client.get_count",
	"/api/method/frappe.client.get",
	"/api/method/frappe.client.insert",
	"/api/method/frappe.client.set_value",
	"/api/method/frappe.client.delete",
	"/api/method/frappe.client.get_list",
	"/api/method/frappe.client.rename_doc",
	"/api/method/frappe.onboarding.get_onboarding_status",
	"/api/method/frappe.utils.print_format.download_pdf",
	"/api/method/frappe.desk.search.search_link",
	"/api/method/frappe.core.doctype.communication.email.make",
]


def authenticate():
	if frappe.form_dict.cmd:
		path = f"/api/method/{frappe.form_dict.cmd}"
	else:
		path = frappe.request.path

	user_type = frappe.db.get_value("User", frappe.session.user, "user_type")
	if user_type == "System User":
		return

	if not path.startswith("/api/"):
		return
	print("path", path)
	if path.startswith("/lms") or path.startswith("/api/method/lms."):
		return

	if path in ALLOWED_PATHS:
		return
	frappe.throw(f"Access not allowed for this URL: {path}", frappe.PermissionError)
