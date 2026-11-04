from unittest.mock import patch

import frappe
from frappe.tests import UnitTestCase

from lms.lms.email_account import create_email_account


class TestCreateEmailAccount(UnitTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	# --- input validation ---------------------------------------------------

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

	def test_presets_are_applied_for_the_chosen_service(self):
		cases = [
			(
				"gmail_service_presets",
				{
					"service": "GMail",
					"email_account_name": "Support",
					"email_id": "support@example.com",
					"password": "app-pass",
					"enable_outgoing": 1,
				},
				"Support",
				{
					"service": "GMail",
					"smtp_server": "smtp.gmail.com",
					"email_server": "imap.gmail.com",
					"enable_outgoing": 1,
				},
			),
			(
				"generic_imap_defaults",
				{
					"service": "GMail",
					"email_account_name": "Support",
					"email_id": "support@example.com",
					"password": "app-pass",
				},
				"Support",
				{"use_imap": 1, "use_tls": 1, "smtp_port": 587, "email_sync_option": "ALL"},
			),
		]
		for case, payload, doc_name, expected in cases:
			with self.subTest(case=case):
				with (
					patch("frappe.model.document.Document.save"),
					patch("lms.lms.email_account.frappe.get_doc") as mock_get_doc,
				):
					mock_get_doc.return_value.name = doc_name
					create_email_account(payload)
					built = mock_get_doc.call_args[0][0]
					for key, value in expected.items():
						self.assertEqual(built[key], value)

	# --- incoming / imap_folder --------------------------------------------

	def test_imap_folder_is_appended_only_when_incoming_is_enabled(self):
		cases = [
			("incoming_appends_imap_folder", {"enable_incoming": 1}, True),
			("outgoing_only_skips_imap_folder", {"enable_outgoing": 1}, False),
		]
		for case, extra, expect_append in cases:
			with self.subTest(case=case):
				with (
					patch("frappe.model.document.Document.save"),
					patch("lms.lms.email_account.frappe.get_doc") as mock_get_doc,
				):
					doc = mock_get_doc.return_value
					doc.name = "Support"
					create_email_account(
						{
							"service": "GMail",
							"email_account_name": "Support",
							"email_id": "support@example.com",
							"password": "app-pass",
							**extra,
						}
					)
					if expect_append:
						built = mock_get_doc.call_args[0][0]
						self.assertEqual(built["enable_incoming"], 1)
						doc.append.assert_called_once_with(
							"imap_folder",
							{"append_to": "Communication", "folder_name": "INBOX"},
						)
					else:
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
