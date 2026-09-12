from unittest.mock import patch

import frappe
from frappe.exceptions import FrappeTypeError
from frappe.tests import UnitTestCase

from lms.lms.email_account import create_email_account, set_default_email_account


class TestCreateEmailAccount(UnitTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	# --- input validation ---------------------------------------------------

	def test_rejects_non_dict_data(self):
		# the @frappe.whitelist() `data: dict` type hint rejects non-dicts at the
		# wrapper layer before _validate_input even runs
		with self.assertRaises(FrappeTypeError):
			create_email_account("not-a-dict")

	def test_rejects_non_string_service(self):
		with self.assertRaises(frappe.ValidationError):
			create_email_account({"service": 123})

	def test_rejects_unsupported_service(self):
		with self.assertRaises(frappe.ValidationError):
			create_email_account({"service": "Hotmail", "email_id": "a@b.com"})

	def test_rejects_non_string_credential_field(self):
		with self.assertRaises(frappe.ValidationError):
			create_email_account({"service": "GMail", "email_id": "a@b.com", "password": ["x"]})

	# --- permissions --------------------------------------------------------

	def test_anonymous_user_blocked(self):
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			create_email_account({"service": "GMail", "email_id": "a@b.com"})
		frappe.set_user("Administrator")

	# --- presets / defaults -------------------------------------------------

	@patch("frappe.model.document.Document.save")
	def test_creates_gmail_with_presets(self, mock_save):
		with patch("lms.lms.email_account.frappe.get_doc") as mock_get_doc:
			doc = mock_get_doc.return_value
			doc.name = "Support"
			create_email_account(
				{
					"service": "GMail",
					"email_account_name": "Support",
					"email_id": "support@example.com",
					"password": "app-pass",
					"enable_outgoing": 1,
				}
			)
			built = mock_get_doc.call_args[0][0]
			self.assertEqual(built["service"], "GMail")
			self.assertEqual(built["smtp_server"], "smtp.gmail.com")
			self.assertEqual(built["email_server"], "imap.gmail.com")
			self.assertEqual(built["enable_outgoing"], 1)

	@patch("frappe.model.document.Document.save")
	def test_applies_imap_defaults(self, mock_save):
		with patch("lms.lms.email_account.frappe.get_doc") as mock_get_doc:
			mock_get_doc.return_value.name = "Support"
			create_email_account(
				{
					"service": "GMail",
					"email_account_name": "Support",
					"email_id": "support@example.com",
					"password": "app-pass",
				}
			)
			built = mock_get_doc.call_args[0][0]
			self.assertEqual(built["use_imap"], 1)
			self.assertEqual(built["use_tls"], 1)
			self.assertEqual(built["smtp_port"], 587)
			self.assertEqual(built["email_sync_option"], "ALL")

	# --- incoming / imap_folder --------------------------------------------

	@patch("frappe.model.document.Document.save")
	def test_incoming_appends_imap_folder(self, mock_save):
		with patch("lms.lms.email_account.frappe.get_doc") as mock_get_doc:
			doc = mock_get_doc.return_value
			doc.name = "Support"
			create_email_account(
				{
					"service": "GMail",
					"email_account_name": "Support",
					"email_id": "support@example.com",
					"password": "app-pass",
					"enable_incoming": 1,
				}
			)
			built = mock_get_doc.call_args[0][0]
			self.assertEqual(built["enable_incoming"], 1)
			doc.append.assert_called_once_with(
				"imap_folder",
				{"append_to": "Communication", "folder_name": "INBOX"},
			)

	@patch("frappe.model.document.Document.save")
	def test_outgoing_only_skips_imap_folder(self, mock_save):
		with patch("lms.lms.email_account.frappe.get_doc") as mock_get_doc:
			doc = mock_get_doc.return_value
			doc.name = "Support"
			create_email_account(
				{
					"service": "GMail",
					"email_account_name": "Support",
					"email_id": "support@example.com",
					"password": "app-pass",
					"enable_outgoing": 1,
				}
			)
			doc.append.assert_not_called()

	# --- credential routing -------------------------------------------------

	@patch("frappe.model.document.Document.save")
	def test_password_set_for_non_frappe_mail(self, mock_save):
		with patch("lms.lms.email_account.frappe.get_doc") as mock_get_doc:
			doc = mock_get_doc.return_value
			doc.name = "Support"
			create_email_account(
				{
					"service": "GMail",
					"email_account_name": "Support",
					"email_id": "support@example.com",
					"password": "app-pass",
				}
			)
			self.assertEqual(doc.password, "app-pass")

	@patch("frappe.model.document.Document.save")
	def test_frappe_mail_uses_api_credentials(self, mock_save):
		with patch("lms.lms.email_account.frappe.get_doc") as mock_get_doc:
			doc = mock_get_doc.return_value
			doc.name = "Frappe"
			create_email_account(
				{
					"service": "Frappe Mail",
					"email_account_name": "Frappe",
					"email_id": "support@example.com",
					"api_key": "key-123",
					"api_secret": "secret-456",
					"frappe_mail_site": "https://frappemail.com",
					"enable_incoming": 1,
				}
			)
			self.assertEqual(doc.api_key, "key-123")
			self.assertEqual(doc.api_secret, "secret-456")
			self.assertEqual(doc.frappe_mail_site, "https://frappemail.com")
			# Frappe Mail never appends an imap_folder, even with incoming on
			doc.append.assert_not_called()

	# --- double insertion / spam-create backstop ----------------------------

	@patch("frappe.model.document.Document.save")
	def test_duplicate_insert_propagates_error(self, mock_save):
		"""A second account with the same name must surface the DB error, not
		silently succeed. The whitelisted method inserts and lets the unique
		autoname reject the duplicate (no exists()-then-insert race)."""
		with patch("lms.lms.email_account.frappe.get_doc") as mock_get_doc:
			doc = mock_get_doc.return_value
			doc.name = "Support"
			doc.save.side_effect = Exception("Duplicate entry 'Support' for key 'PRIMARY'")
			with self.assertRaises(frappe.ValidationError):
				create_email_account(
					{
						"service": "GMail",
						"email_account_name": "Support",
						"email_id": "support@example.com",
						"password": "app-pass",
					}
				)

	# --- custom server ------------------------------------------------------

	@patch("frappe.model.document.Document.save")
	def test_custom_service_is_stored_as_no_service(self, mock_save):
		"""Email Account's `service` Select has no Custom option — a
		hand-entered server is stored with no service at all."""
		with patch("lms.lms.email_account.frappe.get_doc") as mock_get_doc:
			mock_get_doc.return_value.name = "Relay"
			create_email_account(
				{
					"service": "Custom",
					"email_account_name": "Relay",
					"email_id": "relay@example.com",
					"password": "app-pass",
					"smtp_server": "smtp.acme.com",
				}
			)
			self.assertEqual(mock_get_doc.call_args[0][0]["service"], "")

	@patch("frappe.model.document.Document.save")
	def test_custom_server_carries_host_port_and_encryption(self, mock_save):
		with patch("lms.lms.email_account.frappe.get_doc") as mock_get_doc:
			doc = mock_get_doc.return_value
			doc.name = "Relay"
			create_email_account(
				{
					"service": "Custom",
					"email_account_name": "Relay",
					"email_id": "relay@example.com",
					"password": "app-pass",
					"email_server": "imap.acme.com",
					"incoming_port": "993",
					"smtp_server": "smtp.acme.com",
					"smtp_port": "465",
					"use_imap": 1,
					"use_ssl": 1,
					"use_ssl_for_outgoing": 1,
				}
			)
			self.assertEqual(doc.email_server, "imap.acme.com")
			self.assertEqual(doc.incoming_port, "993")
			self.assertEqual(doc.smtp_server, "smtp.acme.com")
			self.assertEqual(doc.smtp_port, "465")
			self.assertEqual(doc.use_ssl, 1)
			# Implicit SSL and STARTTLS are exclusive.
			self.assertEqual(doc.use_ssl_for_outgoing, 1)
			self.assertEqual(doc.use_tls, 0)

	@patch("frappe.model.document.Document.save")
	def test_custom_server_falls_back_to_the_submission_port(self, mock_save):
		with patch("lms.lms.email_account.frappe.get_doc") as mock_get_doc:
			doc = mock_get_doc.return_value
			doc.name = "Relay"
			create_email_account(
				{
					"service": "Custom",
					"email_account_name": "Relay",
					"email_id": "relay@example.com",
					"password": "app-pass",
					"smtp_server": "smtp.acme.com",
				}
			)
			self.assertEqual(doc.smtp_port, 587)
			self.assertEqual(doc.use_tls, 1)

	@patch("frappe.model.document.Document.save")
	def test_custom_login_maps_to_login_id(self, mock_save):
		with patch("lms.lms.email_account.frappe.get_doc") as mock_get_doc:
			doc = mock_get_doc.return_value
			doc.name = "Relay"
			create_email_account(
				{
					"service": "Custom",
					"email_account_name": "Relay",
					"email_id": "relay@example.com",
					"password": "app-pass",
					"smtp_server": "smtp.acme.com",
					"login": "relay-login",
				}
			)
			self.assertEqual(doc.login_id, "relay-login")
			self.assertEqual(doc.login_id_is_different, 1)

	def test_rejects_a_port_that_is_not_a_port(self):
		for port in ("smtp", "0", "70000", -1):
			with self.assertRaises(frappe.ValidationError):
				create_email_account(
					{
						"service": "Custom",
						"email_id": "relay@example.com",
						"smtp_port": port,
					}
				)


class TestSetDefaultEmailAccount(UnitTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def test_rejects_an_unknown_kind(self):
		with self.assertRaises(frappe.ValidationError):
			set_default_email_account("Support", "sideways")

	def test_rejects_a_non_string_account(self):
		with self.assertRaises((frappe.ValidationError, FrappeTypeError)):
			set_default_email_account(["Support"], "incoming")

	def test_anonymous_user_blocked(self):
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			set_default_email_account("Support", "incoming")
		frappe.set_user("Administrator")

	def test_rejects_an_account_that_does_not_exist(self):
		# frappe.db.set_value answers a name that does not exist by doing nothing,
		# so without the check this reports success and writes nothing.
		with self.assertRaises(frappe.DoesNotExistError):
			set_default_email_account("No Such Account", "incoming")

	def test_rejects_a_disabled_direction(self):
		# A default with its direction off resolves nowhere downstream: both the
		# default and enabled flags are required, so setting one without the
		# other silently breaks mail instead of throwing here.
		with (
			patch("lms.lms.email_account.frappe.db.exists", return_value="Support"),
			patch("lms.lms.email_account.frappe.db.get_value", return_value=0),
			patch("lms.lms.email_account.frappe.db.set_value") as mock_set_value,
		):
			with self.assertRaises(frappe.ValidationError):
				set_default_email_account("Support", "outgoing")

		mock_set_value.assert_not_called()

	def test_moves_the_default_off_whichever_account_held_it(self):
		with (
			patch("lms.lms.email_account.frappe.db.exists", return_value="Support"),
			patch("lms.lms.email_account.frappe.db.get_value", return_value=1),
			patch("lms.lms.email_account.frappe.db.set_value") as mock_set_value,
		):
			result = set_default_email_account("Support", "outgoing")

		# One bulk clear against every OTHER holder, not a set_value per row.
		self.assertEqual(
			mock_set_value.call_args_list[0][0],
			(
				"Email Account",
				{"default_outgoing": 1, "name": ["!=", "Support"]},
				"default_outgoing",
				0,
			),
		)
		self.assertEqual(
			mock_set_value.call_args_list[1][0],
			("Email Account", "Support", "default_outgoing", 1),
		)
		self.assertEqual(result, {"email_account": "Support", "kind": "outgoing"})

	def test_leaves_the_account_that_already_holds_it_alone(self):
		with (
			patch("lms.lms.email_account.frappe.db.exists", return_value="Support"),
			patch("lms.lms.email_account.frappe.db.get_value", return_value=1),
			patch("lms.lms.email_account.frappe.db.set_value") as mock_set_value,
		):
			set_default_email_account("Support", "incoming")

		# The bulk clear excludes Support by name, so its own row is never
		# touched by the clear -- only the final set writes it, to 1.
		self.assertEqual(
			mock_set_value.call_args_list[1][0],
			("Email Account", "Support", "default_incoming", 1),
		)

	def test_naming_no_account_clears_the_default(self):
		with patch("lms.lms.email_account.frappe.db.set_value") as mock_set_value:
			set_default_email_account("", "incoming")

		self.assertEqual(len(mock_set_value.call_args_list), 1)
		self.assertEqual(
			mock_set_value.call_args_list[0][0],
			("Email Account", {"default_incoming": 1}, "default_incoming", 0),
		)
