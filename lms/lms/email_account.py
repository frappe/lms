import frappe
from frappe import _

# Host/port presets per service (Frappe does not auto-apply these to API-created
# accounts). Ported from Helpdesk's email_service_config; keys match the
# Email Account `service` field options exactly.
EMAIL_SERVICE_CONFIG: dict[str, dict] = {
	"Frappe Mail": {
		"use_imap": 0,
		"use_ssl": 0,
		"validate_ssl_certificate": 0,
		"use_starttls": 0,
		"email_server": None,
		"incoming_port": 0,
		"always_use_account_email_id_as_sender": 1,
		"use_tls": 0,
		"use_ssl_for_outgoing": 0,
		"smtp_server": None,
		"smtp_port": None,
		"no_smtp_authentication": 0,
	},
	"GMail": {
		"email_server": "imap.gmail.com",
		"use_ssl": 1,
		"smtp_server": "smtp.gmail.com",
	},
	"Outlook.com": {
		"email_server": "imap-mail.outlook.com",
		"use_ssl": 1,
		"smtp_server": "smtp-mail.outlook.com",
	},
	"Sendgrid": {"smtp_server": "smtp.sendgrid.net", "smtp_port": 587},
	"SparkPost": {"smtp_server": "smtp.sparkpostmail.com"},
	"Yahoo Mail": {
		"email_server": "imap.mail.yahoo.com",
		"use_ssl": 1,
		"smtp_server": "smtp.mail.yahoo.com",
		"smtp_port": 587,
	},
	"Yandex.Mail": {
		"email_server": "imap.yandex.com",
		"use_ssl": 1,
		"smtp_server": "smtp.yandex.com",
		"smtp_port": 587,
	},
}

_STRING_FIELDS = (
	"email_id",
	"email_account_name",
	"password",
	"api_key",
	"api_secret",
	"frappe_mail_site",
)


def _validate_input(data: dict) -> str:
	if not isinstance(data, dict):
		frappe.throw(_("data must be an object"))
	service = data.get("service", "")
	if not isinstance(service, str):
		frappe.throw(_("service must be a string"))
	if service not in EMAIL_SERVICE_CONFIG:
		frappe.throw(_("Email service {0} is not supported").format(service or "''"))
	for field in _STRING_FIELDS:
		value = data.get(field)
		if value is not None and not isinstance(value, str):
			frappe.throw(_("{0} must be a string").format(field))
	return service


@frappe.whitelist()
def create_email_account(data: dict) -> str:
	frappe.has_permission("Email Account", "create", throw=True)
	service = _validate_input(data)
	service_config = EMAIL_SERVICE_CONFIG[service]

	try:
		email_doc = frappe.get_doc(
			{
				"doctype": "Email Account",
				"email_id": data.get("email_id"),
				"email_account_name": data.get("email_account_name"),
				"service": service,
				"enable_incoming": data.get("enable_incoming"),
				"enable_outgoing": data.get("enable_outgoing"),
				"default_incoming": data.get("default_incoming"),
				"default_outgoing": data.get("default_outgoing"),
				"email_sync_option": "ALL",
				"initial_sync_count": 100,
				"track_email_status": 1,
				"use_tls": 1,
				"use_imap": 1,
				"smtp_port": 587,
				**service_config,
			}
		)
		if service == "Frappe Mail":
			email_doc.api_key = data.get("api_key")
			email_doc.api_secret = data.get("api_secret")
			email_doc.frappe_mail_site = data.get("frappe_mail_site")
		else:
			if data.get("enable_incoming"):
				email_doc.append(
					"imap_folder",
					{"append_to": "Communication", "folder_name": "INBOX"},
				)
			email_doc.password = data.get("password")

		email_doc.save()  # Frappe validates credentials on save
		return email_doc.name
	except Exception as e:
		frappe.throw(str(e))
