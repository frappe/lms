import frappe

from lms.lms.api import (
	add_evaluator_slot,
	delete_evaluator_slot,
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
		"student": ("availability-stu@example.com", ["LMS Student"]),
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
