"""Permission-matrix tests for the moderator-gated Email Account API.

`lms/lms/email_account.py` fronts core Email Account (a doctype Moderator holds
no DocPerm on at all) with `frappe.only_for("Moderator")`-gated endpoints, the
same shape as `lms.lms.api.get_members`. Per
specs/tests/permission-and-security-tests.md, the DocPerm table is not the
authorization boundary here -- the role check inside each endpoint is -- so it
has to be asserted directly for every endpoint that carries one.
"""

import frappe
from frappe.tests import UnitTestCase

from lms.lms.email_account import (
	ACCOUNT_READ_FIELDS,
	create_email_account,
	delete_email_account,
	get_email_account,
	get_email_accounts,
	rename_email_account,
	update_email_account,
)
from lms.lms.test_helpers import BaseTestUtils


class TestEmailAccountEndpointPermissions(BaseTestUtils, UnitTestCase):
	"""Anonymous and wrong-role callers for every Moderator-gated endpoint.

	Before this suite, only `create_email_account` (anonymous only) and
	`set_default_email_account` (anonymous only) had any caller-permission
	coverage at all -- none of the six endpoints here had a wrong-role test,
	and five of the six had no anonymous test either.
	"""

	def setUp(self):
		super().setUp()
		self.hash = frappe.generate_hash(length=6)
		self.student = self._create_user(
			f"eaperm-student-{self.hash}@example.com", "Perm", "Student", ["LMS Student"]
		)
		self.account = self._create_email_account(f"Perm Account {self.hash}")

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _create_email_account(self, name):
		# frappe.in_test short-circuits Email Account's live-server validation
		# (email_account.py:176 in apps/frappe), so a fixture like this never
		# touches the network even with enable_incoming/enable_outgoing set.
		# The domain deliberately avoids "example": get_email_accounts filters
		# out `%example%` email_ids as the seeded demo accounts, and a fixture
		# that matched would silently vanish from its own assertions.
		doc = frappe.get_doc(
			{
				"doctype": "Email Account",
				"email_account_name": name,
				"email_id": f"{frappe.scrub(name)}@perm-test.invalid",
				"service": "GMail",
				"enable_incoming": 0,
				"enable_outgoing": 1,
				"smtp_server": "smtp.gmail.com",
				"password": "app-pass",
			}
		)
		doc.insert(ignore_permissions=True)
		self.cleanup_items.append(("Email Account", doc.name))
		return doc.name

	def _calls(self):
		return {
			"create_email_account": lambda: create_email_account(
				{
					"service": "GMail",
					"email_id": f"eaperm-new-{self.hash}@example.com",
					"password": "x",
				}
			),
			"get_email_accounts": lambda: get_email_accounts(),
			"get_email_account": lambda: get_email_account(self.account),
			"update_email_account": lambda: update_email_account(
				self.account, {"email_id": f"eaperm-changed-{self.hash}@example.com"}
			),
			"rename_email_account": lambda: rename_email_account(self.account, f"Renamed {self.hash}"),
			"delete_email_account": lambda: delete_email_account(self.account),
		}

	def test_every_endpoint_refuses_an_anonymous_caller(self):
		frappe.set_user("Guest")
		for name, call in self._calls().items():
			with self.subTest(endpoint=name):
				with self.assertRaises(frappe.PermissionError):
					call()

	def test_every_endpoint_refuses_a_non_moderator(self):
		frappe.set_user(self.student.name)
		for name, call in self._calls().items():
			with self.subTest(endpoint=name):
				with self.assertRaises(frappe.PermissionError):
					call()

	def test_the_account_survives_every_refused_call(self):
		"""An exception type alone does not prove nothing was written."""
		for user in ("Guest", self.student.name):
			frappe.set_user(user)
			for call in self._calls().values():
				with self.assertRaises(frappe.PermissionError):
					call()
			frappe.set_user("Administrator")
		self.assertTrue(frappe.db.exists("Email Account", self.account))
		self.assertFalse(
			frappe.db.exists("Email Account", f"Renamed {self.hash}"),
			"a refused rename must not have taken effect",
		)

	def test_the_permission_check_runs_before_input_validation(self):
		"""An unauthorised caller must not learn the input contract.

		If this raised ValidationError instead, the endpoint would be leaking
		its schema (valid `service` values, field types) to anyone who can
		call it, before ever checking who they are.
		"""
		frappe.set_user(self.student.name)
		with self.assertRaises(frappe.PermissionError):
			create_email_account({"service": "not-a-real-service"})
		with self.assertRaises(frappe.PermissionError):
			update_email_account(self.account, {"unknown_field": "x"})

	def test_a_moderator_who_is_not_a_system_manager_may_use_the_read_endpoints(self):
		"""The control: the gate is the role check, not something blocking
		every caller regardless of role.

		Scoped to the read-only/non-destructive endpoints so this control does
		not also delete or rename the fixture the other tests in this class
		rely on -- `create_email_account`/`update_email_account`/
		`rename_email_account`/`delete_email_account`'s own write paths are
		already covered for the Moderator role by TestCreateEmailAccount and
		by fe0ca903c's coverage of EmailAccountForm.vue's caller.
		"""
		moderator = self._create_user(
			f"eaperm-moderator-{self.hash}@example.com", "Perm", "Moderator", ["Moderator"]
		)
		self.assertNotIn(
			"System Manager",
			frappe.get_roles(moderator.name),
			"fixture must not be accidentally privileged, or this proves nothing",
		)
		frappe.set_user(moderator.name)

		found = get_email_accounts(search=f"Perm Account {self.hash}")
		self.assertEqual([row.name for row in found], [self.account])

		row = get_email_account(self.account)
		self.assertEqual(row.name, self.account)

	def test_the_read_endpoints_never_carry_a_credential_field(self):
		"""The allowlist, asserted by exact key set -- not just "password is
		missing" -- so a future field added to ACCOUNT_READ_FIELDS is a
		deliberate, reviewed act, not a silent widening that ships a secret.
		"""
		moderator = self._create_user(
			f"eaperm-moderator2-{self.hash}@example.com", "Perm", "Moderator", ["Moderator"]
		)
		frappe.set_user(moderator.name)

		row = get_email_account(self.account)
		self.assertEqual(set(row.keys()), set(ACCOUNT_READ_FIELDS))
		for credential_field in ("password", "api_key", "api_secret"):
			self.assertNotIn(credential_field, row)
