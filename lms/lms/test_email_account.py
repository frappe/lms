from unittest.mock import patch

import frappe
from frappe.exceptions import FrappeTypeError
from frappe.tests import UnitTestCase

from lms.lms.email_account import create_email_account


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
		silently succeed — the whitelisted method inserts and lets the unique
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
