import frappe
import frappe.share
from frappe.client import delete as client_delete
from frappe.client import insert as client_insert
from frappe.client import set_value as client_set_value

from lms.lms.api import add_evaluator_slot
from lms.lms.test_helpers import BaseTestUtils

# The roles a self-signup account can end up holding without an administrator ever
# opening the Role Permissions Manager. Neither may administer evaluators.
SELF_SERVICE_ROLES = ("course_creator", "batch_evaluator")


def _ensure_user(email, first_name, roles):
	"""`throttle_user_creation` returns early under `in_import`, so a rerun never
	spends the 60-users-an-hour quota. Fixtures outlive a run, and a test may have
	stripped a role, so an existing one gets its roles put back."""
	if frappe.db.exists("User", email):
		user = frappe.get_doc("User", email)
		missing = [r for r in roles if r not in {d.role for d in user.roles}]
		if missing:
			user.add_roles(*missing)
		return

	user = frappe.new_doc("User")
	user.update(
		{
			"email": email,
			"first_name": first_name,
			"user_type": "Website User",
			"send_welcome_email": False,
		}
	)
	for role in roles:
		user.append("roles", {"role": role})

	original_in_import = frappe.flags.in_import
	frappe.flags.in_import = True
	try:
		user.insert(ignore_permissions=True)
	finally:
		frappe.flags.in_import = original_in_import


class TestEvaluatorSelfGrant(BaseTestUtils):
	"""Saving a `Course Evaluator` row grants its subject the `Batch Evaluator`
	role and trashing it revokes the role, so `create` and `delete` here were
	role assignment handed to two self-service roles."""

	USERS = {
		"course_creator": ("self-grant-cc@example.com", ["Course Creator"]),
		"batch_evaluator": ("self-grant-be@example.com", ["Batch Evaluator"]),
		"moderator": ("self-grant-mod@example.com", ["Moderator"]),
		"student": ("self-grant-stu@example.com", ["LMS Student"]),
		# Never mentioned by the actor under test: the point of the escalation is
		# that a role can grant standing to someone it has nothing to do with.
		"outsider": ("self-grant-outsider@example.com", ["LMS Student"]),
		# Owns a Course Evaluator row, so write/delete/share have a target.
		"target_evaluator": ("self-grant-target@example.com", ["Batch Evaluator"]),
	}

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		for attr, (email, roles) in cls.USERS.items():
			_ensure_user(email, attr, roles)
			setattr(cls, attr, email)

	@classmethod
	def tearDownClass(cls):
		for email, _roles in cls.USERS.values():
			if frappe.db.exists("Course Evaluator", email):
				frappe.delete_doc("Course Evaluator", email, force=True, ignore_permissions=True)
		super().tearDownClass()

	def setUp(self):
		super().setUp()
		for email, _roles in self.USERS.values():
			if frappe.db.exists("Course Evaluator", email):
				frappe.delete_doc("Course Evaluator", email, force=True, ignore_permissions=True)
		frappe.get_doc({"doctype": "Course Evaluator", "evaluator": self.target_evaluator}).insert(
			ignore_permissions=True
		)

	def _as(self, role_key):
		frappe.set_user(getattr(self, role_key))

	def test_the_shipped_docperms_grant_these_roles_nothing_but_read(self):
		"""The DocPerm table *is* the authorization here, so assert it directly.
		`read` and its portal-list companions stay: five Link fields search this
		doctype."""
		granted = {
			perm.role: {p for p in ("read", "write", "create", "delete", "share") if perm.get(p)}
			for perm in frappe.get_meta("Course Evaluator").permissions
		}
		self.assertEqual(granted["Batch Evaluator"], {"read"})
		self.assertEqual(granted["Course Creator"], {"read"})
		self.assertEqual(granted["Moderator"], {"read", "write", "create", "delete", "share"}, "the control")

	def test_neither_role_may_create_a_course_evaluator_row(self):
		for role_key in SELF_SERVICE_ROLES:
			with self.subTest(role=role_key):
				self._as(role_key)
				self.assertFalse(frappe.has_permission("Course Evaluator", "create"))
				with self.assertRaises(frappe.PermissionError):
					frappe.get_doc(
						{"doctype": "Course Evaluator", "evaluator": getattr(self, role_key)}
					).insert()

	def test_neither_role_may_create_one_through_the_rest_api(self):
		"""`frappe.client.insert` is what `POST /api/resource/Course Evaluator`
		calls. The single-doc path and this one fail apart when a check lives in
		the wrong place, so both are asserted."""
		for role_key in SELF_SERVICE_ROLES:
			with self.subTest(role=role_key):
				self._as(role_key)
				with self.assertRaises(frappe.PermissionError):
					client_insert({"doctype": "Course Evaluator", "evaluator": self.outsider})

	def test_a_refused_insert_grants_the_outsider_no_role(self):
		"""The escalation itself: inserting a row for an unrelated user used to hand
		that user the `Batch Evaluator` role, because every save runs
		`validate_evaluator_role`."""
		self.assertFalse(frappe.db.exists("Has Role", {"parent": self.outsider, "role": "Batch Evaluator"}))
		self._as("batch_evaluator")
		with self.assertRaises(frappe.PermissionError):
			client_insert({"doctype": "Course Evaluator", "evaluator": self.outsider})
		frappe.set_user("Administrator")
		self.assertFalse(frappe.db.exists("Has Role", {"parent": self.outsider, "role": "Batch Evaluator"}))

	def test_the_role_grant_still_happens_on_a_permitted_insert(self):
		"""The control the fix cannot move: the mechanism above is real, not a
		test that passes because nothing grants roles any more."""
		self._as("moderator")
		client_insert({"doctype": "Course Evaluator", "evaluator": self.outsider})
		frappe.set_user("Administrator")
		self.assertTrue(frappe.db.exists("Has Role", {"parent": self.outsider, "role": "Batch Evaluator"}))

	def test_neither_role_may_write_another_evaluators_row(self):
		for role_key in SELF_SERVICE_ROLES:
			with self.subTest(role=role_key):
				self._as(role_key)
				self.assertFalse(
					frappe.has_permission("Course Evaluator", "write", doc=self.target_evaluator)
				)
				with self.assertRaises(frappe.PermissionError):
					client_set_value(
						"Course Evaluator", self.target_evaluator, "unavailable_from", "2030-01-01"
					)
		frappe.set_user("Administrator")
		self.assertIsNone(frappe.db.get_value("Course Evaluator", self.target_evaluator, "unavailable_from"))

	def test_neither_role_may_delete_another_evaluators_row(self):
		"""Deleting the row revokes the target's `Batch Evaluator` role via
		`on_trash`, so `delete` here is denial of standing, not just data loss."""
		for role_key in SELF_SERVICE_ROLES:
			with self.subTest(role=role_key):
				self._as(role_key)
				with self.assertRaises(frappe.PermissionError):
					client_delete("Course Evaluator", self.target_evaluator)
		frappe.set_user("Administrator")
		self.assertTrue(frappe.db.exists("Course Evaluator", self.target_evaluator))
		self.assertTrue(
			frappe.db.exists("Has Role", {"parent": self.target_evaluator, "role": "Batch Evaluator"})
		)

	def test_neither_role_may_share_their_way_back_to_write(self):
		"""`share` survives a `write` removal and grants `write` back through a
		DocShare, so it has to go with the rest."""
		for role_key in SELF_SERVICE_ROLES:
			with self.subTest(role=role_key):
				self._as(role_key)
				with self.assertRaises(frappe.PermissionError):
					frappe.share.add(
						"Course Evaluator", self.target_evaluator, getattr(self, role_key), write=1, share=1
					)

	def test_both_roles_may_still_read_the_evaluator_list(self):
		"""The control: five Link fields search this doctype. A removal that took
		`read` with it would break course publishing, not secure it."""
		for role_key in SELF_SERVICE_ROLES:
			with self.subTest(role=role_key):
				self._as(role_key)
				names = frappe.get_list("Course Evaluator", pluck="name")
				self.assertIn(self.target_evaluator, names)

	def test_a_moderator_may_still_administer_evaluators(self):
		self._as("moderator")
		client_set_value("Course Evaluator", self.target_evaluator, "unavailable_from", "2030-01-01")
		self.assertEqual(
			frappe.db.get_value("Course Evaluator", self.target_evaluator, "unavailable_from"),
			frappe.utils.getdate("2030-01-01"),
		)
		client_delete("Course Evaluator", self.target_evaluator)
		self.assertFalse(frappe.db.exists("Course Evaluator", self.target_evaluator))

	def test_an_evaluator_may_still_set_up_their_own_availability(self):
		"""The supported path. `lms.lms.api.add_evaluator_slot` provisions the
		caller's own row with `ignore_permissions` behind `enforce_evaluator_access`,
		so it never depended on the DocPerm this change removed."""
		self._as("batch_evaluator")
		add_evaluator_slot(
			evaluator=self.batch_evaluator, day="Monday", start_time="10:00:00", end_time="11:00:00"
		)
		frappe.set_user("Administrator")
		self.assertTrue(frappe.db.exists("Course Evaluator", self.batch_evaluator))

	def test_a_student_and_a_guest_are_still_refused_everything(self):
		"""Neither `LMS Student` nor `Guest` ever held anything here. Asserted so
		the removal above cannot be read as having introduced the refusal."""
		for user in (self.student, "Guest"):
			frappe.set_user(user)
			for ptype in ("create", "write", "delete", "share", "read"):
				with self.subTest(user=user, ptype=ptype):
					self.assertFalse(frappe.has_permission("Course Evaluator", ptype))
