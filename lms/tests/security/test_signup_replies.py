# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

from unittest.mock import patch

import frappe
from frappe.utils import set_request

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.user import sign_up

OUTGOING = "frappe.email.doctype.email_account.email_account.EmailAccount.find_default_outgoing"


class TestSignupReplies(BaseTestUtils):
	"""A guest signing up learns nothing about other accounts: every address gets
	the same reply, whether it is new, registered or disabled."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.hash = hash
		cls.enabled = cls._create_user(f"su-enabled-{hash}@example.com", "Ena", "Bled", ["LMS Student"]).name
		cls.disabled = cls._create_user(
			f"su-disabled-{hash}@example.com", "Dis", "Abled", ["LMS Student"]
		).name
		frappe.db.set_value("User", cls.disabled, "enabled", 0)

	def setUp(self):
		super().setUp()
		frappe.db.set_single_value("Website Settings", "disable_signup", 0)
		frappe.clear_document_cache("Website Settings", "Website Settings")
		frappe.set_user("Guest")

	def _sign_up(self, email):
		return sign_up(email, "Some One", True, "")

	def _replies(self):
		return {
			"new": self._sign_up(f"su-new-{frappe.generate_hash(length=6)}@example.com"),
			"registered": self._sign_up(self.enabled),
			"disabled": self._sign_up(self.disabled),
		}

	def test_every_address_gets_the_same_reply_with_mail(self):
		with patch(OUTGOING, return_value=frappe._dict(name="Outgoing")), patch("frappe.sendmail"):
			replies = self._replies()
		self.assertEqual(len(set(replies.values())), 1, replies)
		self.assertEqual(replies["new"][0], 1)

	def test_every_address_gets_the_same_reply_without_mail(self):
		with patch(OUTGOING, return_value=None):
			replies = self._replies()
		self.assertEqual(len(set(replies.values())), 1, replies)
		self.assertEqual(replies["new"][0], 2)

	def test_the_reply_names_no_account_state(self):
		with patch(OUTGOING, return_value=None):
			for reply in self._replies().values():
				self.assertNotIn("Registered", reply[1])
				self.assertNotIn("disabled", reply[1])

	def test_an_existing_address_gets_no_mail_and_no_new_user(self):
		"""No reset link either: that would let the sign-up limit, far looser than
		the reset limit, flood an inbox and rotate the owner's reset key."""
		before = frappe.db.count("User")
		with (
			patch(OUTGOING, return_value=frappe._dict(name="Outgoing")),
			patch("frappe.sendmail") as sendmail,
		):
			self._sign_up(self.enabled)
			self._sign_up(self.disabled)
		sendmail.assert_not_called()
		self.assertEqual(frappe.db.count("User"), before)

	def test_a_new_address_creates_the_user(self):
		email = f"su-created-{self.hash}@example.com"
		with patch(OUTGOING, return_value=None):
			self._sign_up(email)
		self.assertTrue(frappe.db.exists("User", email))

	def test_the_hourly_cap_answers_before_the_lookup(self):
		with (
			patch("frappe.db.get_creation_count", return_value=10**6),
			patch("frappe.db.get") as lookup,
		):
			with self.assertRaises(frappe.RateLimitExceededError):
				self._sign_up(self.enabled)
			lookup.assert_not_called()

	def test_sign_up_refused_when_disabled(self):
		frappe.db.set_single_value("Website Settings", "disable_signup", 1)
		frappe.clear_document_cache("Website Settings", "Website Settings")
		with self.assertRaises(frappe.ValidationError):
			self._sign_up(f"su-off-{self.hash}@example.com")

	def test_sign_up_is_rate_limited_per_minute(self):
		"""The limiter counts only inside a request; a sign-up page call is one."""
		frappe.db.set_single_value("Website Settings", "max_signups_per_minute", 2)
		frappe.clear_document_cache("Website Settings", "Website Settings")
		set_request(method="POST", path="/api/method/lms.lms.user.sign_up")
		frappe.local.request_ip = f"10.0.0.{frappe.generate_hash(length=2)}"
		try:
			with patch(OUTGOING, return_value=None):
				self._sign_up(self.enabled)
				self._sign_up(self.enabled)
				# The decorator's own error, or the global limiter's, whichever trips.
				with self.assertRaises((frappe.RateLimitExceededError, frappe.TooManyRequestsError)):
					self._sign_up(self.enabled)
		finally:
			del frappe.local.request
