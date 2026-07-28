import frappe

from lms.lms.api import (
	add_evaluator_slot,
	delete_evaluator_slot,
	get_evaluator_details,
	set_evaluator_unavailability,
	update_evaluator_slot,
)
from lms.lms.test_helpers import BaseTestUtils


class TestEvaluatorAvailability(BaseTestUtils):
	"""`ProfileEvaluator.vue` used to write availability through raw
	`frappe.client.insert` / `set_value` / `delete`, which fall back to plain
	doctype role permissions. `Course Evaluator` grants full write to Moderator,
	Batch Evaluator *and* Course Creator with no row-level owner condition, so
	any of them could add slots to, edit, or mark unavailability on any other
	evaluator's calendar — a Course Creator can't even open the Slots tab, yet
	could still write to it through the API.

	The rule these endpoints enforce: you may edit your own availability, and a
	Moderator may edit anyone's.
	"""

	# Users are made once for the class: frappe throttles User creation, and
	# re-creating five of them per test method trips it.
	USERS = {
		"evaluator": ("availability-eval@example.com", ["Batch Evaluator", "LMS Student"]),
		"other_evaluator": ("availability-eval2@example.com", ["Batch Evaluator", "LMS Student"]),
		"course_creator": ("availability-cc@example.com", ["Course Creator"]),
		"moderator": ("availability-mod@example.com", ["Moderator"]),
		# A Moderator with no Batch Evaluator role: the Slots tab renders for
		# them, so they are the reachable target of a read-that-writes.
		"plain_moderator": ("availability-mod2@example.com", ["Moderator"]),
		"student": ("availability-stu@example.com", ["LMS Student"]),
		# Holds the role but has never saved a slot, so no Course Evaluator row.
		"fresh_evaluator": ("availability-eval3@example.com", ["Batch Evaluator"]),
	}

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		# `throttle_user_creation` refuses more than 60 Users an hour. These
		# fixtures have stable names and are reused across runs, so the flag only
		# matters the first time a site sees them.
		original_in_import = frappe.flags.in_import
		frappe.flags.in_import = True
		try:
			for attr, (email, roles) in cls.USERS.items():
				if not frappe.db.exists("User", email):
					user = frappe.new_doc("User")
					user.update(
						{
							"email": email,
							"first_name": attr,
							"user_type": "Website User",
							"send_welcome_email": False,
						}
					)
					for role in roles:
						user.append("roles", {"role": role})
					user.insert(ignore_permissions=True)
				else:
					# Reused across runs, and a test may have stripped a role to
					# set up its own state — put the fixture's roles back.
					user = frappe.get_doc("User", email)
					missing = [r for r in roles if r not in {d.role for d in user.roles}]
					if missing:
						user.add_roles(*missing)
				setattr(cls, attr, frappe._dict(email=email))
		finally:
			frappe.flags.in_import = original_in_import
		frappe.db.commit()

	@classmethod
	def tearDownClass(cls):
		# Only the availability rows are test state; the users stay put so reruns
		# don't churn through the creation quota.
		for email, _roles in cls.USERS.values():
			if frappe.db.exists("Course Evaluator", email):
				frappe.delete_doc("Course Evaluator", email, force=True, ignore_permissions=True)
		frappe.db.commit()
		super().tearDownClass()

	def setUp(self):
		super().setUp()
		self.schedule = self._reset_evaluator_doc(self.evaluator.email)
		self.other_schedule = self._reset_evaluator_doc(self.other_evaluator.email)

		self.original_user = frappe.session.user
		self.addCleanup(self._restore_user)

	def _restore_user(self):
		frappe.session.user = self.original_user

	def _reset_evaluator_doc(self, evaluator):
		"""One known slot per test — the tests add, edit and delete rows."""
		if frappe.db.exists("Course Evaluator", evaluator):
			doc = frappe.get_doc("Course Evaluator", evaluator)
			doc.schedule = []
		else:
			doc = frappe.new_doc("Course Evaluator")
			doc.evaluator = evaluator
		doc.unavailable_from = None
		doc.unavailable_to = None
		doc.append("schedule", {"day": "Monday", "start_time": "09:00:00", "end_time": "10:00:00"})
		doc.save(ignore_permissions=True)
		return doc

	def _slot_of(self, doc):
		return frappe.get_doc("Course Evaluator", doc.name).schedule[0].name

	# --- own availability ------------------------------------------------

	def test_evaluator_can_add_their_own_slot(self):
		frappe.session.user = self.evaluator.email
		add_evaluator_slot(self.evaluator.email, "Tuesday", "11:00:00", "12:00:00")

		days = [row.day for row in frappe.get_doc("Course Evaluator", self.evaluator.email).schedule]
		self.assertIn("Tuesday", days)

	def test_evaluator_can_update_their_own_slot(self):
		frappe.session.user = self.evaluator.email
		update_evaluator_slot(self.evaluator.email, self._slot_of(self.schedule), "day", "Friday")

		self.assertEqual(frappe.get_doc("Course Evaluator", self.evaluator.email).schedule[0].day, "Friday")

	def test_evaluator_can_delete_their_own_slot(self):
		frappe.session.user = self.evaluator.email
		delete_evaluator_slot(self.evaluator.email, self._slot_of(self.schedule))

		self.assertEqual(len(frappe.get_doc("Course Evaluator", self.evaluator.email).schedule), 0)

	def test_evaluator_can_set_their_own_unavailability(self):
		frappe.session.user = self.evaluator.email
		set_evaluator_unavailability(self.evaluator.email, "unavailable_from", "2026-08-01")

		self.assertEqual(
			str(frappe.db.get_value("Course Evaluator", self.evaluator.email, "unavailable_from")),
			"2026-08-01",
		)

	# --- other people's availability -------------------------------------

	def test_course_creator_cannot_add_a_slot_for_someone_else(self):
		"""The probe that found this: a Course Creator, who cannot even open the
		Slots tab, could write to any evaluator's calendar."""
		frappe.session.user = self.course_creator.email
		with self.assertRaises(frappe.PermissionError):
			add_evaluator_slot(self.evaluator.email, "Wednesday", "09:00:00", "10:00:00")

	def test_course_creator_cannot_set_someone_elses_unavailability(self):
		frappe.session.user = self.course_creator.email
		with self.assertRaises(frappe.PermissionError):
			set_evaluator_unavailability(self.evaluator.email, "unavailable_to", "2026-09-01")

	def test_evaluator_cannot_write_a_peers_availability(self):
		frappe.session.user = self.other_evaluator.email
		with self.assertRaises(frappe.PermissionError):
			add_evaluator_slot(self.evaluator.email, "Thursday", "09:00:00", "10:00:00")

	def test_student_cannot_write_availability(self):
		frappe.session.user = self.student.email
		with self.assertRaises(frappe.PermissionError):
			add_evaluator_slot(self.evaluator.email, "Friday", "09:00:00", "10:00:00")

	def test_moderator_may_edit_anyones_availability(self):
		frappe.session.user = self.moderator.email
		add_evaluator_slot(self.evaluator.email, "Saturday", "09:00:00", "10:00:00")

		days = [row.day for row in frappe.get_doc("Course Evaluator", self.evaluator.email).schedule]
		self.assertIn("Saturday", days)

	# --- redirected writes ------------------------------------------------

	def test_slot_write_cannot_be_redirected_at_another_evaluators_row(self):
		"""Passing your own name but someone else's slot must not slip through
		the ownership check."""
		frappe.session.user = self.evaluator.email
		foreign_slot = self._slot_of(self.other_schedule)

		with self.assertRaises(frappe.PermissionError):
			update_evaluator_slot(self.evaluator.email, foreign_slot, "day", "Sunday")

	def test_slot_delete_cannot_be_redirected_at_another_evaluators_row(self):
		frappe.session.user = self.evaluator.email
		foreign_slot = self._slot_of(self.other_schedule)

		with self.assertRaises(frappe.PermissionError):
			delete_evaluator_slot(self.evaluator.email, foreign_slot)

	# --- input validation --------------------------------------------------

	def test_fieldname_outside_the_allowlist_is_rejected(self):
		frappe.session.user = self.evaluator.email
		with self.assertRaises(frappe.ValidationError):
			update_evaluator_slot(self.evaluator.email, self._slot_of(self.schedule), "parent", "x")

	def test_unavailability_fieldname_outside_the_allowlist_is_rejected(self):
		frappe.session.user = self.evaluator.email
		with self.assertRaises(frappe.ValidationError):
			set_evaluator_unavailability(self.evaluator.email, "evaluator", "someone@else.com")

	def test_non_string_evaluator_is_rejected(self):
		frappe.session.user = self.evaluator.email
		for bad in (["a"], {"b": 1}, 7, ""):
			with self.assertRaises((frappe.ValidationError, frappe.exceptions.FrappeTypeError)):
				add_evaluator_slot(bad, "Monday", "09:00:00", "10:00:00")

	def test_unknown_slot_is_rejected(self):
		frappe.session.user = self.evaluator.email
		with self.assertRaises((frappe.DoesNotExistError, frappe.PermissionError)):
			update_evaluator_slot(self.evaluator.email, "does-not-exist", "day", "Monday")

	def test_invalid_day_is_rejected(self):
		frappe.session.user = self.evaluator.email
		with self.assertRaises(frappe.ValidationError):
			add_evaluator_slot(self.evaluator.email, "Noonday", "09:00:00", "10:00:00")

	# --- reading must not write ------------------------------------------

	def _reset_target(self, evaluator, drop_role=True):
		"""A pre-fix run leaves the record — and the granted role — behind.

		`drop_role` stays off for a fixture that is *meant* to hold Batch
		Evaluator: stripping it would make the caller fail `only_for`.
		"""
		if frappe.db.exists("Course Evaluator", evaluator):
			frappe.delete_doc("Course Evaluator", evaluator, force=True, ignore_permissions=True)
		if drop_role:
			frappe.db.delete("Has Role", {"parent": evaluator, "role": "Batch Evaluator"})
		frappe.clear_cache(user=evaluator)

	def test_reading_details_does_not_create_a_record_for_the_target(self):
		"""`get_evaluator_details` used to insert a Course Evaluator for whoever
		it was asked about. The Slots tab renders for any profile holding
		Moderator, and the resource fires on mount — before the client-side
		redirect — so opening another moderator's profile wrote to their name."""
		self._reset_target(self.plain_moderator.email)
		frappe.session.user = self.moderator.email

		get_evaluator_details(self.plain_moderator.email)

		self.assertFalse(
			frappe.db.exists("Course Evaluator", self.plain_moderator.email),
			"reading availability created a Course Evaluator",
		)

	def test_reading_details_does_not_grant_the_target_the_evaluator_role(self):
		"""Saving a Course Evaluator runs validate_evaluator_role, which adds
		`Batch Evaluator` to the target. The grant only lands when the *caller*
		may write User docs — a portal Moderator's role write is silently
		dropped — so an admin-level reader is what made this an escalation."""
		self._reset_target(self.plain_moderator.email)
		frappe.session.user = "Administrator"

		get_evaluator_details(self.plain_moderator.email)

		frappe.clear_cache(user=self.plain_moderator.email)
		self.assertFalse(
			frappe.db.exists("Has Role", {"parent": self.plain_moderator.email, "role": "Batch Evaluator"}),
			"reading availability granted Batch Evaluator",
		)

	def test_reading_details_of_a_new_evaluator_returns_an_empty_schedule(self):
		"""The UI iterates `slots.schedule` unguarded, so the empty case still
		has to come back shaped like a Course Evaluator."""
		self._reset_target(self.plain_moderator.email)
		frappe.session.user = self.moderator.email

		details = get_evaluator_details(self.plain_moderator.email)

		self.assertEqual(details["slots"]["schedule"], [])
		self.assertIsNone(details["slots"]["unavailable_from"])
		self.assertIsNone(details["slots"]["unavailable_to"])

	def test_reading_your_own_details_still_does_not_write(self):
		"""A Batch Evaluator who has never set a slot has no Course Evaluator
		record; opening their own Slots tab must not conjure one either."""
		self._reset_target(self.fresh_evaluator.email, drop_role=False)
		frappe.session.user = self.fresh_evaluator.email

		get_evaluator_details(self.fresh_evaluator.email)

		self.assertFalse(frappe.db.exists("Course Evaluator", self.fresh_evaluator.email))

	def test_existing_availability_still_reads_back(self):
		frappe.session.user = self.evaluator.email

		details = get_evaluator_details(self.evaluator.email)

		self.assertEqual([row["day"] for row in details["slots"]["schedule"]], ["Monday"])

	def test_adding_a_slot_creates_the_evaluator_record_on_demand(self):
		"""Creation moves to the write path, so an evaluator with no record yet
		can still be given slots — it just takes a deliberate write."""
		self._reset_target(self.plain_moderator.email)
		frappe.session.user = self.moderator.email

		add_evaluator_slot(self.plain_moderator.email, "Monday", "09:00:00", "10:00:00")

		doc = frappe.get_doc("Course Evaluator", self.plain_moderator.email)
		self.assertEqual([row.day for row in doc.schedule], ["Monday"])

	def test_a_write_for_an_unknown_user_is_still_refused(self):
		frappe.session.user = self.moderator.email

		with self.assertRaises(frappe.DoesNotExistError):
			add_evaluator_slot("no-such-user@example.com", "Monday", "09:00:00", "10:00:00")
