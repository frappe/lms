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

# A server with no preset: the account carries the host, port and encryption the
# user typed. Not a key in EMAIL_SERVICE_CONFIG, because there is nothing to
# preset — it is the absence of one, and Email Account stores it as a blank
# `service`.
CUSTOM_SERVICE = "Custom"

_STRING_FIELDS = (
	"email_id",
	"email_account_name",
	"password",
	"api_key",
	"api_secret",
	"frappe_mail_site",
	"email_server",
	"smtp_server",
	"login",
)

_PORT_FIELDS = ("incoming_port", "smtp_port")

_DEFAULT_FIELDS = {"incoming": "default_incoming", "outgoing": "default_outgoing"}
_ENABLED_FIELDS = {"incoming": "enable_incoming", "outgoing": "enable_outgoing"}

# The role that owns Settings > Communication > Email Accounts. Core Email
# Account grants read to System Manager and Inbox User and to nobody else, so a
# Moderator who is not a System Manager saw an empty page. Widening that DocPerm
# would hand every Moderator the site's whole mail configuration, including the
# accounts other apps own, so the page is fronted by the endpoints below and the
# role is checked here instead. Same shape as Settings > Users
# (lms.lms.api.get_members).
SETTINGS_ROLE = "Moderator"

# One page of accounts. The settings panel steps `start` by the length of what
# came back, and offers Load More while a page arrives full, so this is the
# number the page reads a full answer as — keep it equal to
# EMAIL_ACCOUNTS_PAGE_LENGTH in the frontend's emailAccounts.ts.
EMAIL_ACCOUNTS_PAGE_LENGTH = 13

# What the settings page is given back, and nothing else. The caller holds no
# permission on Email Account, so a field absent here is a field they cannot
# read at all.
#
# The three credentials are absent on purpose. `password` and `api_secret` are
# Password fields, whose column holds `'*' * len(secret)` — a mask that still
# reports the secret's length — and `api_key` is a credential stored in the
# clear. None of the three is needed to render the page: an existing account's
# credential is only ever replaced, never shown.
ACCOUNT_READ_FIELDS = (
	"name",
	"email_account_name",
	"email_id",
	"service",
	"frappe_mail_site",
	"enable_incoming",
	"enable_outgoing",
	"default_incoming",
	"default_outgoing",
	"email_server",
	"incoming_port",
	"smtp_server",
	"smtp_port",
	"use_imap",
	"use_ssl",
	"use_ssl_for_outgoing",
	"login_id",
	"login_id_is_different",
)

_SEARCH_FIELDS = ("email_account_name", "email_id")

# The accounts frappe ships as examples are not accounts anyone here set up, and
# they cannot be edited into working ones. The page has always hidden them; the
# filter lives here now because a method-backed list has no get_list filters of
# its own to carry it.
_EXAMPLE_ACCOUNTS = ("email_id", "not like", "%example%")

# The fields update_email_account will write, by how each one is checked. A
# fieldname absent from all four is refused: the caller reaches a doctype they
# hold no permission on, so the write set is an allowlist rather than whatever
# they send.
_WRITABLE_STRING_FIELDS = (
	"email_id",
	"email_server",
	"smtp_server",
	"frappe_mail_site",
	"login_id",
)

_WRITABLE_CHECK_FIELDS = (
	"enable_incoming",
	"enable_outgoing",
	"default_incoming",
	"default_outgoing",
	"use_imap",
	"use_ssl",
	"use_ssl_for_outgoing",
	"use_tls",
	"login_id_is_different",
)

_WRITABLE_PORT_FIELDS = _PORT_FIELDS

# Written only when one arrives non-blank. The page no longer reads any of the
# three back, so every save of an untouched form carries them empty — and an
# empty Password field is not "leave it alone" to frappe: `_save_passwords`
# reads it as a clear and deletes the stored secret.
_WRITABLE_CREDENTIAL_FIELDS = ("password", "api_key", "api_secret")


def _validate_input(data: dict) -> str:
	if not isinstance(data, dict):
		frappe.throw(_("data must be an object"))
	service = data.get("service", "")
	if not isinstance(service, str):
		frappe.throw(_("service must be a string"))
	if service not in EMAIL_SERVICE_CONFIG and service != CUSTOM_SERVICE:
		frappe.throw(_("Email service {0} is not supported").format(service or "''"))
	for field in _STRING_FIELDS:
		value = data.get(field)
		if value is not None and not isinstance(value, str):
			frappe.throw(_("{0} must be a string").format(field))
	for field in _PORT_FIELDS:
		_validate_port(field, data.get(field))
	return service


def _validate_port(field: str, value) -> None:
	"""A port reaches this as a string from a form control or as an int from a
	test, and blank means "use the preset"."""
	if value is None or value == "":
		return
	# bool is an int subclass, so it would otherwise pass as a port number.
	if isinstance(value, bool) or not isinstance(value, int | str):
		frappe.throw(_("{0} must be a port number").format(field))
	if not str(value).isdigit() or not 1 <= int(value) <= 65535:
		frappe.throw(_("{0} must be a port number between 1 and 65535").format(field))


def _apply_custom_server(email_doc, data: dict) -> None:
	"""The host, port and encryption a preset would otherwise have supplied."""
	email_doc.email_server = data.get("email_server")
	email_doc.incoming_port = data.get("incoming_port") or None
	email_doc.smtp_server = data.get("smtp_server")
	email_doc.smtp_port = data.get("smtp_port") or 587
	email_doc.use_imap = 1 if data.get("use_imap") else 0
	email_doc.use_ssl = 1 if data.get("use_ssl") else 0
	email_doc.use_ssl_for_outgoing = 1 if data.get("use_ssl_for_outgoing") else 0
	# Implicit SSL (465) and STARTTLS (587) are the two ways out, and they are
	# exclusive — a server asked for both refuses the handshake.
	email_doc.use_tls = 0 if email_doc.use_ssl_for_outgoing else 1

	# A login that is not the address itself is what login_id is for.
	login = data.get("login")
	if login and login != data.get("email_id"):
		email_doc.login_id_is_different = 1
		email_doc.login_id = login


@frappe.whitelist()
def create_email_account(data: dict) -> str:
	frappe.only_for(SETTINGS_ROLE)
	service = _validate_input(data)
	service_config = EMAIL_SERVICE_CONFIG.get(service, {})

	try:
		email_doc = frappe.get_doc(
			{
				"doctype": "Email Account",
				"email_id": data.get("email_id"),
				"email_account_name": data.get("email_account_name"),
				# Email Account's `service` Select has no Custom option; a hand-entered
				# server is stored as no service at all.
				"service": "" if service == CUSTOM_SERVICE else service,
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
			if service == CUSTOM_SERVICE:
				_apply_custom_server(email_doc, data)

			if data.get("enable_incoming"):
				email_doc.append(
					"imap_folder",
					{"append_to": "Communication", "folder_name": "INBOX"},
				)
			email_doc.password = data.get("password")

		# ignore_permissions because the role check above is the authorization
		# boundary: the caller holds no DocPerm on Email Account. Frappe still
		# validates the credentials against the live server on save.
		# nosemgrep: lms-unjustified-ignore-permissions - the role check above is the authorization
		email_doc.save(ignore_permissions=True)
		return email_doc.name
	except Exception as e:
		frappe.throw(str(e))


@frappe.whitelist()
def set_default_email_account(email_account: str = "", kind: str = "") -> dict:
	"""Move the site-wide default inbox or default sender onto one account.

	An empty `email_account` clears that default instead of moving it.
	"""
	frappe.only_for(SETTINGS_ROLE)

	if not isinstance(email_account, str) or not isinstance(kind, str):
		frappe.throw(_("email_account and kind must be strings"))
	if kind not in _DEFAULT_FIELDS:
		frappe.throw(_("kind must be 'incoming' or 'outgoing'"))

	field = _DEFAULT_FIELDS[kind]

	if email_account:
		_require_account(email_account)
		if not frappe.db.get_value("Email Account", email_account, _ENABLED_FIELDS[kind]):
			frappe.throw(_("Enable {0} on {1} before making it the default.").format(kind, email_account))

	# set_value rather than a doc save: Email Account revalidates its credentials
	# against the live server on save, so writing a flag would demand a working
	# mailbox for every account that already holds the default.
	#
	# A filter dict for `dn` is one bulk UPDATE against every matching row,
	# not a set_value per account — frappe.db.set_value does the looping
	# server-side when handed filters instead of a single document name.
	clear_filters = {field: 1}
	if email_account:
		clear_filters["name"] = ["!=", email_account]
	frappe.db.set_value("Email Account", clear_filters, field, 0)

	if email_account:
		frappe.db.set_value("Email Account", email_account, field, 1)

	return {"email_account": email_account, "kind": kind}


def _validate_name(value, label: str = "name") -> str:
	if not isinstance(value, str):
		frappe.throw(_("{0} must be a string").format(label))
	name = value.strip()
	if not name:
		frappe.throw(_("{0} is required").format(label))
	return name


def _require_account(name: str) -> str:
	"""The account this call names, or the error the caller can act on.

	frappe.db.set_value and frappe.db.get_value both answer a name that does not
	exist by doing nothing at all, so without this a typo — or a row someone
	else deleted between the list and the save — reports success.
	"""
	name = _validate_name(name, "email_account")
	if not frappe.db.exists("Email Account", name):
		frappe.throw(
			_("Email Account {0} does not exist").format(name),
			frappe.DoesNotExistError,
		)
	return name


def _validate_check(field: str, value) -> int:
	"""A checkbox is 0 or 1. A form control sends it as a bool or a string."""
	if isinstance(value, bool):
		return int(value)
	if isinstance(value, int) and value in (0, 1):
		return value
	if isinstance(value, str) and value.strip() in ("0", "1"):
		return int(value.strip())
	frappe.throw(_("{0} must be 0 or 1").format(field))


def _validate_service(value) -> str:
	"""The service a write may name, as the document stores it.

	A hand-entered server has no preset and Email Account's own Select has no
	option for one, so it is stored as no service at all — which is what both
	the blank and the client's `Custom` mean here.
	"""
	if not isinstance(value, str):
		frappe.throw(_("service must be a string"))
	if value in ("", CUSTOM_SERVICE):
		return ""
	if value not in EMAIL_SERVICE_CONFIG:
		frappe.throw(_("Email service {0} is not supported").format(value))
	return value


def _validated_update(data: dict) -> tuple[dict, dict]:
	"""Split the page's payload into the fields to write and the credentials.

	The two are kept apart because a blank means opposite things: a blank
	`email_server` is the user clearing the host, while a blank `password` is a
	form that was never given one to show.
	"""
	if not isinstance(data, dict):
		frappe.throw(_("data must be an object"))

	allowed = {
		*_WRITABLE_STRING_FIELDS,
		*_WRITABLE_CHECK_FIELDS,
		*_WRITABLE_PORT_FIELDS,
		*_WRITABLE_CREDENTIAL_FIELDS,
		"service",
	}
	unknown = sorted(field for field in data if field not in allowed)
	if unknown:
		frappe.throw(_("Email accounts cannot be updated through {0}").format(", ".join(unknown)))

	values = {}
	for field in _WRITABLE_STRING_FIELDS:
		if field not in data:
			continue
		value = data[field]
		if value is not None and not isinstance(value, str):
			frappe.throw(_("{0} must be a string").format(field))
		values[field] = value or ""

	for field in _WRITABLE_CHECK_FIELDS:
		if field in data:
			values[field] = _validate_check(field, data[field])

	for field in _WRITABLE_PORT_FIELDS:
		if field not in data:
			continue
		_validate_port(field, data[field])
		values[field] = data[field] or None

	if "service" in data:
		values["service"] = _validate_service(data["service"])

	credentials = {}
	for field in _WRITABLE_CREDENTIAL_FIELDS:
		if field not in data:
			continue
		value = data[field]
		if value is not None and not isinstance(value, str):
			frappe.throw(_("{0} must be a string").format(field))
		if value:
			credentials[field] = value

	return values, credentials


def _account_row(name: str) -> dict:
	return frappe.db.get_value("Email Account", name, list(ACCOUNT_READ_FIELDS), as_dict=True)


@frappe.whitelist()
def get_email_accounts(search: str = "", start: int = 0) -> list[dict]:
	"""One page of the accounts Settings > Communication > Email Accounts shows.

	frappe.get_all rather than get_list: the role check above is the
	authorization boundary, and the caller holds no DocPerm on Email Account.
	"""
	frappe.only_for(SETTINGS_ROLE)

	if not isinstance(search, str):
		frappe.throw(_("search must be a string"))
	if isinstance(start, bool) or not isinstance(start, int | str):
		frappe.throw(_("start must be a number"))
	if not str(start).isdigit():
		frappe.throw(_("start must be a number"))

	or_filters = {}
	term = search.strip()
	if term:
		for field in _SEARCH_FIELDS:
			or_filters[field] = ["like", f"%{term}%"]

	return frappe.get_all(
		"Email Account",
		filters=[list(_EXAMPLE_ACCOUNTS)],
		or_filters=or_filters,
		fields=list(ACCOUNT_READ_FIELDS),
		order_by="email_account_name asc",
		start=int(start),
		page_length=EMAIL_ACCOUNTS_PAGE_LENGTH,
	)


@frappe.whitelist()
def get_email_account(name: str) -> dict:
	"""One account, for the record form behind a list row.

	The example accounts the list hides are readable here: the filter is what
	the page shows, not what it may open, and a deep link to one would
	otherwise answer as though the account did not exist.
	"""
	frappe.only_for(SETTINGS_ROLE)

	return _account_row(_require_account(name))


@frappe.whitelist(methods=["POST"])
def update_email_account(name: str, data: dict) -> dict:
	"""Write the record form's fields onto one account.

	A credential that arrives blank is left as it is rather than cleared: the
	form is never given the stored one to show, so every save of an untouched
	account carries an empty password.
	"""
	frappe.only_for(SETTINGS_ROLE)

	account = _require_account(name)
	values, credentials = _validated_update(data)

	doc = frappe.get_doc("Email Account", account)
	doc.update(values)
	for field, secret in credentials.items():
		doc.set(field, secret)

	# Frappe validates the credentials against the live server on save, which is
	# what makes a wrong password an error the form can report.
	# nosemgrep: lms-unjustified-ignore-permissions - the caller is gated on Moderator above
	doc.save(ignore_permissions=True)

	return _account_row(doc.name)


@frappe.whitelist(methods=["POST"])
def rename_email_account(name: str, new_name: str) -> str:
	"""Move an account to a new account name.

	Email Account autonames from `email_account_name`, so the name IS the
	document id and changing it is a rename rather than a field write.
	"""
	frappe.only_for(SETTINGS_ROLE)

	account = _require_account(name)
	target = _validate_name(new_name, "new_name")
	if target == account:
		return account

	# frappe.rename_doc is the whitelisted wrapper and takes no
	# ignore_permissions, so the underlying one is what this calls: the caller
	# holds no DocPerm on Email Account, and the role check above is the gate.
	from frappe.model.rename_doc import rename_doc

	# nosemgrep: lms-unjustified-ignore-permissions - the rename is gated on the role check above; the inner rename_doc is the one that takes the flag
	return rename_doc("Email Account", old=account, new=target, ignore_permissions=True)


@frappe.whitelist(methods=["POST"])
def delete_email_account(name: str) -> str:
	frappe.only_for(SETTINGS_ROLE)

	account = _require_account(name)
	# nosemgrep: lms-unjustified-ignore-permissions - the caller is gated on Moderator above
	frappe.delete_doc("Email Account", account, ignore_permissions=True)
	return account
