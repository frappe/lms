from unittest.mock import MagicMock, patch

import frappe

from lms.lms.api import (
	EVALUATOR_CALENDAR_CACHE,
	add_evaluator_slot,
	authorize_evaluator_calendar,
	delete_evaluator_slot,
	ensure_evaluator_calendar,
	get_evaluator_details,
	google_calendar_callback,
	save_evaluator_availability,
	set_evaluator_unavailability,
	update_evaluator_calendar,
	update_evaluator_slot,
)
from lms.lms.test_helpers import BaseTestUtils


class TestEvaluatorAvailability(BaseTestUtils):
	"""`ProfileEvaluator.vue` writes availability through `lms.lms.api`, not raw
	`frappe.client.*` (would fall back to `Course Evaluator`'s role perms; see
	`test_evaluator_self_grant.py`). Rule: edit your own, a Moderator edits anyone's.
	"""

	# Users are made once for the class: frappe throttles User creation, and
	# re-creating five of them per test method trips it.
	USERS = {
		"evaluator": ("availability-eval@example.com", ["Batch Evaluator", "LMS Student"]),
		"other_evaluator": ("availability-eval2@example.com", ["Batch Evaluator", "LMS Student"]),
		"course_creator": ("availability-cc@example.com", ["Course Creator"]),
		"moderator": ("availability-mod@example.com", ["Moderator"]),
		# A Moderator with no Batch Evaluator role: not bookable, so they have
		# no availability for anyone to read or write.
		"plain_moderator": ("availability-mod2@example.com", ["Moderator"]),
		"student": ("availability-stu@example.com", ["LMS Student"]),
		# Holds the role but has never saved a slot, so no Course Evaluator row.
		"fresh_evaluator": ("availability-eval3@example.com", ["Batch Evaluator"]),
	}

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		# `throttle_user_creation` refuses more than 60 Users an hour.
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
					# Already on the site, and a test may have stripped a role to
					# set up its own state. Put the fixture's roles back.
					user = frappe.get_doc("User", email)
					missing = [r for r in roles if r not in {d.role for d in user.roles}]
					if missing:
						user.add_roles(*missing)
				setattr(cls, attr, frappe._dict(email=email))
		finally:
			frappe.flags.in_import = original_in_import

	def setUp(self):
		super().setUp()
		self.schedule = self._reset_evaluator_doc(self.evaluator.email)
		self._other_schedule = None

		self.original_user = frappe.session.user
		self.addCleanup(self._restore_user)

	def _restore_user(self):
		frappe.session.user = self.original_user

	@property
	def other_schedule(self):
		# Only 2 of the 37 tests need a second evaluator's calendar, and building
		# one is a full doc.save(); build it on first use instead of for every test.
		if self._other_schedule is None:
			self._other_schedule = self._reset_evaluator_doc(self.other_evaluator.email)
		return self._other_schedule

	def _reset_evaluator_doc(self, evaluator):
		"""One known slot per test. The tests add, edit and delete rows."""
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

	def test_writing_someone_elses_calendar_is_refused(self):
		"""The probe that found this: a Course Creator, who cannot even open
		the Slots tab, could write to any evaluator's calendar; neither can a
		peer evaluator or a student."""
		cases = [
			(
				"course_creator_add_slot",
				self.course_creator.email,
				lambda: add_evaluator_slot(self.evaluator.email, "Wednesday", "09:00:00", "10:00:00"),
			),
			(
				"course_creator_set_unavailability",
				self.course_creator.email,
				lambda: set_evaluator_unavailability(self.evaluator.email, "unavailable_to", "2026-09-01"),
			),
			(
				"peer_evaluator_add_slot",
				self.other_evaluator.email,
				lambda: add_evaluator_slot(self.evaluator.email, "Thursday", "09:00:00", "10:00:00"),
			),
			(
				"student_add_slot",
				self.student.email,
				lambda: add_evaluator_slot(self.evaluator.email, "Friday", "09:00:00", "10:00:00"),
			),
		]
		for case, caller, action in cases:
			with self.subTest(case=case):
				frappe.session.user = caller
				try:
					with self.assertRaises(frappe.PermissionError):
						action()
				finally:
					frappe.session.user = self.original_user

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

	def test_writes_reject_malformed_fieldnames_and_values(self):
		frappe.session.user = self.evaluator.email
		slot = self._slot_of(self.schedule)
		cases = [
			(
				"slot_fieldname_outside_allowlist",
				frappe.ValidationError,
				lambda: update_evaluator_slot(self.evaluator.email, slot, "parent", "x"),
			),
			(
				"unavailability_fieldname_outside_allowlist",
				frappe.ValidationError,
				lambda: set_evaluator_unavailability(self.evaluator.email, "evaluator", "someone@else.com"),
			),
			(
				"unknown_slot",
				(frappe.DoesNotExistError, frappe.PermissionError),
				lambda: update_evaluator_slot(self.evaluator.email, "does-not-exist", "day", "Monday"),
			),
			(
				"invalid_day",
				frappe.ValidationError,
				lambda: add_evaluator_slot(self.evaluator.email, "Noonday", "09:00:00", "10:00:00"),
			),
			(
				"malformed_time_on_update",
				frappe.ValidationError,
				lambda: update_evaluator_slot(self.evaluator.email, slot, "start_time", "25:99"),
			),
			(
				"malformed_unavailability_date",
				frappe.ValidationError,
				lambda: set_evaluator_unavailability(self.evaluator.email, "unavailable_from", "garbage"),
			),
		]
		for case, expected, action in cases:
			with self.subTest(case=case):
				with self.assertRaises(expected):
					action()

	def test_non_string_evaluator_is_rejected(self):
		frappe.session.user = self.evaluator.email
		for bad in (["a"], {"b": 1}, 7, ""):
			with self.subTest(bad=bad):
				with self.assertRaises((frappe.ValidationError, frappe.exceptions.FrappeTypeError)):
					add_evaluator_slot(bad, "Monday", "09:00:00", "10:00:00")

	# --- reading must not write ------------------------------------------

	def _reset_target(self, evaluator, drop_role=True):
		"""A pre-fix run leaves the record (and the granted role) behind.

		`drop_role` stays off for a fixture that is *meant* to hold Batch
		Evaluator. Deleting the record strips the role (`on_trash`), so it is
		put back. Runs as the test's own user: a subtest leaves the last caller set.
		"""
		frappe.session.user = self.original_user
		if frappe.db.exists("Course Evaluator", evaluator):
			frappe.delete_doc("Course Evaluator", evaluator, force=True, ignore_permissions=True)
		if drop_role:
			frappe.db.delete("Has Role", {"parent": evaluator, "role": "Batch Evaluator"})
		else:
			frappe.get_doc("User", evaluator).add_roles("Batch Evaluator")
		frappe.clear_cache(user=evaluator)

	def test_reading_details_does_not_create_a_record_for_the_target(self):
		"""`get_evaluator_details` used to insert a Course Evaluator for whoever
		it was asked about, and the resource fires on the Slots tab's mount."""
		self._reset_target(self.fresh_evaluator.email, drop_role=False)
		frappe.session.user = self.moderator.email

		get_evaluator_details(self.fresh_evaluator.email)

		self.assertFalse(
			frappe.db.exists("Course Evaluator", self.fresh_evaluator.email),
			"reading availability created a Course Evaluator",
		)

	def test_reading_details_does_not_grant_the_target_the_evaluator_role(self):
		"""Saving a Course Evaluator runs validate_evaluator_role, which adds
		`Batch Evaluator` to the target. The grant only lands when the *caller*
		may write User docs (a portal Moderator's role write is silently
		dropped), so an admin-level reader is what made this an escalation."""
		self._reset_target(self.plain_moderator.email)
		frappe.session.user = "Administrator"

		with self.assertRaises(frappe.PermissionError):
			get_evaluator_details(self.plain_moderator.email)

		frappe.clear_cache(user=self.plain_moderator.email)
		self.assertFalse(
			frappe.db.exists("Has Role", {"parent": self.plain_moderator.email, "role": "Batch Evaluator"}),
			"reading availability granted Batch Evaluator",
		)

	def test_reading_details_of_a_new_evaluator_returns_an_empty_schedule(self):
		"""The UI iterates `slots.schedule` unguarded, so the empty case still
		has to come back shaped like a Course Evaluator."""
		self._reset_target(self.fresh_evaluator.email, drop_role=False)
		frappe.session.user = self.moderator.email

		details = get_evaluator_details(self.fresh_evaluator.email)

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

	def test_existing_availability_reads_back_for_owner_and_moderator(self):
		cases = [
			("owner", self.evaluator.email),
			("moderator", self.moderator.email),
		]
		for case, caller in cases:
			with self.subTest(case=case):
				frappe.session.user = caller
				details = get_evaluator_details(self.evaluator.email)
				self.assertEqual([row["day"] for row in details["slots"]["schedule"]], ["Monday"])

	def test_adding_a_slot_creates_the_evaluator_record_on_demand(self):
		"""Creation moves to the write path, so an evaluator with no record yet
		can still be given slots. It just takes a deliberate write."""
		for case, caller in (("moderator", self.moderator.email), ("owner", self.fresh_evaluator.email)):
			with self.subTest(case=case):
				self._reset_target(self.fresh_evaluator.email, drop_role=False)
				frappe.session.user = caller

				add_evaluator_slot(self.fresh_evaluator.email, "Monday", "09:00:00", "10:00:00")

				doc = frappe.get_doc("Course Evaluator", self.fresh_evaluator.email)
				self.assertEqual([row.day for row in doc.schedule], ["Monday"])

	# --- the target must be able to evaluate -------------------------------

	def test_a_moderator_cannot_make_someone_an_evaluator_by_adding_a_slot(self):
		"""Only a Batch Evaluator is bookable, so a slot for anyone else is a role
		grant through the back door. The Roles tab is the way in."""
		self._reset_target(self.plain_moderator.email)
		frappe.session.user = self.moderator.email

		with self.assertRaises(frappe.PermissionError):
			add_evaluator_slot(self.plain_moderator.email, "Monday", "09:00:00", "10:00:00")

		self.assertFalse(frappe.db.exists("Course Evaluator", self.plain_moderator.email))
		self.assertFalse(
			frappe.db.exists("Has Role", {"parent": self.plain_moderator.email, "role": "Batch Evaluator"})
		)

	def test_a_non_evaluator_target_is_refused_on_every_endpoint(self):
		"""Includes a Moderator acting on their own profile: being a Moderator
		lets you edit evaluators, not be one."""
		cases = [
			("read", lambda: get_evaluator_details(self.plain_moderator.email)),
			("add", lambda: add_evaluator_slot(self.plain_moderator.email, "Monday", "09:00:00", "10:00:00")),
			("update", lambda: update_evaluator_slot(self.plain_moderator.email, 1, "day", "Monday")),
			("delete", lambda: delete_evaluator_slot(self.plain_moderator.email, 1)),
			(
				"unavailability",
				lambda: set_evaluator_unavailability(self.plain_moderator.email, "unavailable_from", None),
			),
		]
		for caller in (self.moderator.email, self.plain_moderator.email):
			for case, action in cases:
				with self.subTest(caller=caller, case=case):
					self._reset_target(self.plain_moderator.email)
					frappe.session.user = caller

					with self.assertRaises(frappe.PermissionError):
						action()

	def test_a_moderator_who_cannot_evaluate_gets_no_evaluator_calendar(self):
		frappe.db.delete("Google Calendar", {"user": self.plain_moderator.email})
		self._reset_target(self.plain_moderator.email)
		frappe.session.user = self.plain_moderator.email

		with self.assertRaises(frappe.PermissionError):
			ensure_evaluator_calendar()

		self.assertFalse(frappe.db.exists("Google Calendar", {"user": self.plain_moderator.email}))

	# --- the caller must be an evaluator in the first place ---------------

	def test_a_student_cannot_make_themselves_an_evaluator(self):
		"""Ownership alone is not a gate: naming yourself passes it, and the
		first write provisions a Course Evaluator with ignore_permissions,
		which grants Batch Evaluator. The caller needs the role already."""
		self._reset_target(self.student.email)
		frappe.session.user = self.student.email

		with self.assertRaises(frappe.PermissionError):
			add_evaluator_slot(self.student.email, "Monday", "09:00:00", "10:00:00")

		self.assertFalse(frappe.db.exists("Course Evaluator", self.student.email))
		self.assertFalse(
			frappe.db.exists("Has Role", {"parent": self.student.email, "role": "Batch Evaluator"})
		)

	def test_a_course_creator_cannot_make_themselves_an_evaluator(self):
		frappe.session.user = self.course_creator.email

		with self.assertRaises(frappe.PermissionError):
			add_evaluator_slot(self.course_creator.email, "Monday", "09:00:00", "10:00:00")

	def test_a_student_cannot_read_their_own_availability_either(self):
		frappe.session.user = self.student.email

		with self.assertRaises(frappe.PermissionError):
			get_evaluator_details(self.student.email)

	# --- reads are owner-gated too ----------------------------------------

	def test_an_evaluator_cannot_read_another_evaluators_schedule(self):
		"""`only_for` is a role gate, not an owner gate. Every Batch Evaluator
		could read every other one's schedule, unavailability and calendar."""
		frappe.session.user = self.evaluator.email

		with self.assertRaises(frappe.PermissionError):
			get_evaluator_details(self.other_evaluator.email)

	# --- no record means no write ------------------------------------------

	def test_a_write_to_a_missing_record_is_refused_not_created(self):
		"""A no-op write used to create the record for an evaluator who had
		never set any availability."""
		cases = [
			(
				"unavailability",
				lambda: set_evaluator_unavailability(self.fresh_evaluator.email, "unavailable_from", None),
			),
			("delete_slot", lambda: delete_evaluator_slot(self.fresh_evaluator.email, 1)),
		]
		for case, action in cases:
			with self.subTest(case=case):
				self._reset_target(self.fresh_evaluator.email, drop_role=False)
				frappe.session.user = self.moderator.email

				with self.assertRaises(frappe.DoesNotExistError):
					action()

				self.assertFalse(frappe.db.exists("Course Evaluator", self.fresh_evaluator.email))

	# --- value validation ---------------------------------------------------

	def test_a_malformed_time_is_a_validation_error_not_a_500(self):
		frappe.session.user = self.evaluator.email

		for bad in ("25:99", "not-a-time", "", None, 7):
			with self.subTest(bad=bad):
				with self.assertRaises((frappe.ValidationError, frappe.exceptions.FrappeTypeError)):
					add_evaluator_slot(self.evaluator.email, "Monday", bad, "10:00:00")

	def test_clearing_unavailability_is_still_allowed(self):
		frappe.session.user = self.evaluator.email

		set_evaluator_unavailability(self.evaluator.email, "unavailable_from", None)

		self.assertIsNone(frappe.db.get_value("Course Evaluator", self.evaluator.email, "unavailable_from"))

	# --- calendar provisioning ---------------------------------------------

	def test_reading_details_does_not_create_a_google_calendar(self):
		"""Provisioning moved to ensure_evaluator_calendar: a GET of the profile
		page must not write a Google Calendar document either."""
		frappe.db.delete("Google Calendar", {"user": self.evaluator.email})
		frappe.session.user = self.evaluator.email

		get_evaluator_details(self.evaluator.email)

		self.assertFalse(frappe.db.exists("Google Calendar", {"user": self.evaluator.email}))

	def test_a_student_cannot_provision_a_calendar(self):
		frappe.session.user = self.student.email

		with self.assertRaises(frappe.PermissionError):
			ensure_evaluator_calendar()

	def test_a_write_for_an_unknown_user_is_still_refused(self):
		frappe.session.user = self.moderator.email

		with self.assertRaises(frappe.DoesNotExistError):
			add_evaluator_slot("no-such-user@example.com", "Monday", "09:00:00", "10:00:00")

	# --- one save for the whole week -----------------------------------------

	WEEK = [
		{"day": "Monday", "start_time": "09:00", "end_time": "12:00"},
		{"day": "Monday", "start_time": "14:00", "end_time": "17:00"},
		{"day": "Wednesday", "start_time": "10:00", "end_time": "11:00"},
	]

	def _schedule_of(self, evaluator):
		doc = frappe.get_doc("Course Evaluator", evaluator)
		return [(row.day, str(row.start_time), str(row.end_time)) for row in doc.schedule]

	def test_replaces_the_week_and_the_time_off(self):
		frappe.session.user = self.evaluator.email

		details = save_evaluator_availability(self.WEEK, "2030-01-01", "2030-01-05")

		self.assertEqual(
			self._schedule_of(self.evaluator.email),
			[
				("Monday", "9:00:00", "12:00:00"),
				("Monday", "14:00:00", "17:00:00"),
				("Wednesday", "10:00:00", "11:00:00"),
			],
		)
		doc = frappe.get_doc("Course Evaluator", self.evaluator.email)
		self.assertEqual(str(doc.unavailable_from), "2030-01-01")
		self.assertEqual(str(doc.unavailable_to), "2030-01-05")
		self.assertEqual(len(details["slots"]["schedule"]), 3)

	def test_an_empty_week_and_no_time_off_clear_everything(self):
		frappe.session.user = self.evaluator.email

		save_evaluator_availability([], None, None)

		self.assertEqual(self._schedule_of(self.evaluator.email), [])
		self.assertIsNone(frappe.db.get_value("Course Evaluator", self.evaluator.email, "unavailable_from"))

	def test_a_new_evaluator_gets_their_record_on_first_save(self):
		self._reset_target(self.fresh_evaluator.email, drop_role=False)
		frappe.session.user = self.fresh_evaluator.email

		save_evaluator_availability(self.WEEK[:1])

		self.assertEqual(self._schedule_of(self.fresh_evaluator.email), [("Monday", "9:00:00", "12:00:00")])

	def test_overlapping_ranges_on_one_day_are_refused(self):
		"""The controller still validates a whole-week save, not just the client."""
		frappe.session.user = self.evaluator.email
		overlapping = [
			{"day": "Friday", "start_time": "09:00", "end_time": "12:00"},
			{"day": "Friday", "start_time": "11:00", "end_time": "13:00"},
		]

		with self.assertRaises(frappe.ValidationError):
			save_evaluator_availability(overlapping)

		self.assertEqual(self._schedule_of(self.evaluator.email), [("Monday", "9:00:00", "10:00:00")])

	def test_the_same_times_on_different_days_do_not_overlap(self):
		frappe.session.user = self.evaluator.email
		week = [{"day": day, "start_time": "09:00", "end_time": "10:00"} for day in ("Monday", "Tuesday")]

		save_evaluator_availability(week)

		self.assertEqual(len(self._schedule_of(self.evaluator.email)), 2)

	def test_invalid_values_are_refused_and_nothing_changes(self):
		frappe.session.user = self.evaluator.email
		cases = [
			("schedule_not_a_list", "Monday", None, None),
			("schedule_a_dict", {"day": "Monday"}, None, None),
			("row_not_a_dict", ["Monday"], None, None),
			("bad_day", [{"day": "Noonday", "start_time": "09:00", "end_time": "10:00"}], None, None),
			("bad_time", [{"day": "Monday", "start_time": "25:99", "end_time": "10:00"}], None, None),
			("missing_time", [{"day": "Monday", "start_time": "09:00"}], None, None),
			("end_before_start", [{"day": "Monday", "start_time": "11:00", "end_time": "10:00"}], None, None),
			(
				"too_many_rows",
				[{"day": "Monday", "start_time": "09:00", "end_time": "10:00"}] * 101,
				None,
				None,
			),
			("half_time_off", [], "2030-01-01", None),
			("time_off_out_of_order", [], "2030-01-05", "2030-01-01"),
			("bad_date", [], "garbage", "2030-01-01"),
			("date_not_a_string", [], ["2030-01-01"], "2030-01-02"),
		]
		for case, schedule, from_date, to_date in cases:
			with self.subTest(case=case):
				with self.assertRaises((frappe.ValidationError, frappe.exceptions.FrappeTypeError)):
					save_evaluator_availability(schedule, from_date, to_date)
				self.assertEqual(self._schedule_of(self.evaluator.email), [("Monday", "9:00:00", "10:00:00")])

	def test_callers_who_cannot_evaluate_are_refused(self):
		cases = [
			("guest", "Guest"),
			("student", self.student.email),
			("course_creator", self.course_creator.email),
			("moderator_without_the_role", self.plain_moderator.email),
		]
		for case, caller in cases:
			with self.subTest(case=case):
				if caller != "Guest":
					self._reset_target(caller)
				frappe.session.user = caller

				with self.assertRaises(frappe.PermissionError):
					save_evaluator_availability(self.WEEK)

				frappe.session.user = self.original_user
				self.assertFalse(frappe.db.exists("Course Evaluator", caller))

	def test_it_only_ever_writes_the_callers_own_record(self):
		"""There is no evaluator parameter, so a peer's record is out of reach."""
		self.other_schedule
		frappe.session.user = self.evaluator.email

		save_evaluator_availability(self.WEEK)

		self.assertEqual(self._schedule_of(self.other_evaluator.email), [("Monday", "9:00:00", "10:00:00")])

	def test_details_say_whether_evaluation_invites_are_on(self):
		setting = ("LMS Settings", "send_calendar_invite_for_evaluations")
		original = frappe.db.get_single_value(*setting)
		self.addCleanup(frappe.db.set_single_value, *setting, original)
		frappe.session.user = self.evaluator.email
		for value in (0, 1):
			with self.subTest(value=value):
				frappe.db.set_single_value(*setting, value)
				details = get_evaluator_details(self.evaluator.email)
				self.assertIs(details["evaluation_invites"], bool(value))


class TestEvaluatorCalendarSettings(BaseTestUtils):
	"""The Slots tab is where a portal evaluator manages their Google Calendar:
	they have no Settings modal and no desk write permission on Google Calendar,
	and Frappe's authorize_access needs that permission. These endpoints manage
	the caller's own calendar only."""

	EVALUATOR = "calendar-eval@example.com"
	OTHER = "calendar-eval2@example.com"
	STUDENT = "calendar-stu@example.com"

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		original_in_import = frappe.flags.in_import
		frappe.flags.in_import = True
		try:
			for email, role in (
				(cls.EVALUATOR, "Batch Evaluator"),
				(cls.OTHER, "Batch Evaluator"),
				(cls.STUDENT, "LMS Student"),
			):
				# nosemgrep: lms-exists-then-insert - test fixture setup
				if not frappe.db.exists("User", email):
					user = frappe.new_doc("User")
					user.update(
						{
							"email": email,
							"first_name": email.split("@")[0],
							"user_type": "Website User",
							"send_welcome_email": False,
						}
					)
					user.append("roles", {"role": role})
					# nosemgrep: lms-unjustified-ignore-permissions - test fixture setup
					user.insert(ignore_permissions=True)
		finally:
			frappe.flags.in_import = original_in_import

		settings = frappe.get_doc("Google Settings")
		settings.enable = 1
		settings.client_id = "test-client-id"
		settings.client_secret = "test-client-secret"
		# nosemgrep: lms-unjustified-ignore-permissions - test fixture setup
		settings.save(ignore_permissions=True)

	def setUp(self):
		super().setUp()
		frappe.db.delete("Google Calendar", {"user": ("in", [self.EVALUATOR, self.OTHER])})
		frappe.cache.delete_value(f"{EVALUATOR_CALENDAR_CACHE}:{self.EVALUATOR}")
		self.original_user = frappe.session.user
		self.addCleanup(setattr, frappe.session, "user", self.original_user)
		frappe.local.response = frappe._dict()
		frappe.local.flags.commit = False
		self.addCleanup(setattr, frappe.local.flags, "commit", False)
		# The real URI is built from the request, which tests don't have.
		uri = patch(
			"lms.lms.api.google_callback_uri",
			return_value="https://lms.test/?cmd=frappe.integrations.doctype.google_calendar.google_calendar.google_callback",
		)
		uri.start()
		self.addCleanup(uri.stop)

	def _calendar_of(self, user):
		return frappe.db.get_value("Google Calendar", {"user": user}, "name")

	def test_details_show_the_calendar_settings(self):
		frappe.session.user = self.EVALUATOR
		update_evaluator_calendar("calendar_name", "Eva's classes")

		calendar = get_evaluator_details(self.EVALUATOR)["calendar"]

		self.assertEqual(calendar.calendar_name, "Eva's classes")
		self.assertEqual(calendar.enable, 1)
		self.assertEqual(calendar.push_to_google_calendar, 1)
		self.assertFalse(calendar.is_authorized)
		self.assertNotIn("refresh_token", calendar)

	def test_an_authorization_code_alone_is_not_authorized(self):
		"""The code is saved before the token swap, so it is left behind when
		the swap fails. Only a refresh token sends invites."""
		frappe.session.user = self.EVALUATOR
		name = ensure_evaluator_calendar()
		calendar = frappe.get_doc("Google Calendar", name)
		calendar.authorization_code = "left-behind"
		# nosemgrep: lms-unjustified-ignore-permissions - test fixture setup
		calendar.save(ignore_permissions=True)

		self.assertFalse(get_evaluator_details(self.EVALUATOR)["calendar"].is_authorized)

	def test_evaluator_can_change_their_own_calendar(self):
		frappe.session.user = self.EVALUATOR
		update_evaluator_calendar("push_to_google_calendar", 0)
		update_evaluator_calendar("enable", "0")

		values = frappe.db.get_value(
			"Google Calendar", {"user": self.EVALUATOR}, ["push_to_google_calendar", "enable"], as_dict=1
		)
		self.assertEqual(values, {"push_to_google_calendar": 0, "enable": 0})

	def test_a_change_never_reaches_another_users_calendar(self):
		frappe.session.user = self.OTHER
		update_evaluator_calendar("calendar_name", "Other's classes")

		frappe.session.user = self.EVALUATOR
		update_evaluator_calendar("calendar_name", "Mine")

		self.assertEqual(
			frappe.db.get_value("Google Calendar", {"user": self.OTHER}, "calendar_name"), "Other's classes"
		)

	def test_only_the_shown_fields_can_change(self):
		frappe.session.user = self.EVALUATOR
		for fieldname in ("user", "refresh_token", "google_calendar_id", "sync_as_public"):
			with self.assertRaises(frappe.ValidationError):
				update_evaluator_calendar(fieldname, "x")

	def test_a_calendar_name_taken_by_someone_else_is_refused(self):
		frappe.session.user = self.OTHER
		update_evaluator_calendar("calendar_name", "Taken name")

		frappe.session.user = self.EVALUATOR
		with self.assertRaises(frappe.ValidationError):
			update_evaluator_calendar("calendar_name", "Taken name")

	def test_the_calendar_name_cannot_be_blank(self):
		frappe.session.user = self.EVALUATOR
		with self.assertRaises(frappe.ValidationError):
			update_evaluator_calendar("calendar_name", "   ")

	def test_a_student_cannot_manage_a_calendar_here(self):
		frappe.session.user = self.STUDENT
		with self.assertRaises(frappe.PermissionError):
			update_evaluator_calendar("enable", 1)
		with self.assertRaises(frappe.PermissionError):
			authorize_evaluator_calendar()

	def test_without_google_settings_the_error_says_who_can_fix_it(self):
		frappe.session.user = self.EVALUATOR
		with patch("lms.lms.api.is_google_calendar_enabled", return_value=False):
			with self.assertRaises(frappe.ValidationError) as error:
				update_evaluator_calendar("enable", 1)
		self.assertIn("site administrator", str(error.exception))

	def test_sign_in_remembers_the_callers_calendar(self):
		frappe.session.user = self.EVALUATOR
		result = authorize_evaluator_calendar()

		self.assertIn("accounts.google.com", result["url"])
		self.assertIn("google_calendar.google_callback", result["url"])
		pending = frappe.cache.get_value(f"{EVALUATOR_CALENDAR_CACHE}:{self.EVALUATOR}")
		self.assertEqual(pending["calendar"], self._calendar_of(self.EVALUATOR))
		self.assertIn(f"&state={pending['state']}", result["url"])

	def _state(self):
		return frappe.cache.get_value(f"{EVALUATOR_CALENDAR_CACHE}:{self.EVALUATOR}")["state"]

	def _token_response(self, body):
		response = MagicMock()
		response.json.return_value = body
		return patch("requests.post", return_value=response)

	def test_callback_saves_the_token_and_returns_to_the_slots_tab(self):
		frappe.session.user = self.EVALUATOR
		authorize_evaluator_calendar()

		with self._token_response({"refresh_token": "fresh"}):
			google_calendar_callback(code="one-time-code", state=self._state())

		calendar = frappe.get_doc("Google Calendar", self._calendar_of(self.EVALUATOR))
		self.assertEqual(calendar.get_password("refresh_token"), "fresh")
		self.assertEqual(frappe.local.response["type"], "redirect")
		self.assertTrue(frappe.local.response["location"].endswith("/slots"))
		self.assertIsNone(frappe.cache.get_value(f"{EVALUATOR_CALENDAR_CACHE}:{self.EVALUATOR}"))
		# Google comes back with a GET, which Frappe rolls back unless told to commit.
		self.assertTrue(frappe.local.flags.commit)

	def test_callback_says_so_when_google_gives_no_token(self):
		frappe.session.user = self.EVALUATOR
		authorize_evaluator_calendar()

		with self._token_response({"error": "invalid_grant"}):
			google_calendar_callback(code="stale-code", state=self._state())

		self.assertTrue(frappe.local.response["location"].endswith("/slots?calendar=failed"))
		self.assertFalse(get_evaluator_details(self.EVALUATOR)["calendar"].is_authorized)
		self.assertFalse(frappe.local.flags.commit)

	def test_a_code_from_another_sign_in_is_refused(self):
		"""Someone sends the evaluator the callback link with a code for their own
		Google account while the evaluator's sign-in is pending."""
		frappe.session.user = self.EVALUATOR
		authorize_evaluator_calendar()
		key = f"{EVALUATOR_CALENDAR_CACHE}:{self.EVALUATOR}"
		pending = frappe.cache.get_value(key)

		for state in (None, "forged-state"):
			with self._token_response({"refresh_token": "attackers"}) as token_request:
				with self.assertRaises(frappe.PermissionError):
					google_calendar_callback(code="attackers-code", state=state)
			token_request.assert_not_called()

		self.assertFalse(get_evaluator_details(self.EVALUATOR)["calendar"].is_authorized)
		self.assertFalse(frappe.local.flags.commit)
		# The real sign-in can still finish.
		self.assertEqual(frappe.cache.get_value(key), pending)

	def test_a_sign_in_from_before_state_is_refused_cleanly(self):
		"""Stored as the calendar name alone, before `state` existed."""
		frappe.session.user = self.EVALUATOR
		frappe.cache.set_value(f"{EVALUATOR_CALENDAR_CACHE}:{self.EVALUATOR}", ensure_evaluator_calendar())

		with self.assertRaises(frappe.PermissionError):
			google_calendar_callback(code="code", state="s")
		update_evaluator_calendar("calendar_name", "Renamed after deploy")
		self.assertEqual(self._calendar_of(self.EVALUATOR), "Renamed after deploy")

	def test_a_desk_sign_in_keeps_frappes_own_callback(self):
		frappe.session.user = "Administrator"
		with patch(
			"frappe.integrations.doctype.google_calendar.google_calendar.google_callback"
		) as frappe_callback:
			google_calendar_callback(code="desk-code")
		frappe_callback.assert_called_once_with("desk-code")

	def test_a_portal_user_never_reaches_frappes_callback(self):
		"""Frappe's callback saves the code onto whichever calendar a desk user last
		started authorising, before it checks permission. auth.py lets portal users
		reach this URL for the Slots tab sign-in only."""
		frappe.session.user = self.EVALUATOR
		with patch(
			"frappe.integrations.doctype.google_calendar.google_calendar.google_callback"
		) as frappe_callback:
			with self.assertRaises(frappe.PermissionError):
				google_calendar_callback(code="someone-elses-code")
		frappe_callback.assert_not_called()

	def _connected_calendar(self):
		frappe.session.user = self.EVALUATOR
		calendar = frappe.get_doc("Google Calendar", ensure_evaluator_calendar())
		calendar.google_calendar_id = "eva@group.calendar.google.com"
		calendar.refresh_token = "token"
		# nosemgrep: lms-unjustified-ignore-permissions - test fixture setup
		calendar.save(ignore_permissions=True)
		return calendar.name

	def test_a_rename_reaches_google(self):
		"""Frappe names the Google calendar only when it creates it."""
		self._connected_calendar()
		google = MagicMock()
		with patch(
			"frappe.integrations.doctype.google_calendar.google_calendar.get_google_calendar_object",
			return_value=(google, MagicMock()),
		):
			update_evaluator_calendar("calendar_name", "Evaluations")

		google.calendars.return_value.patch.assert_called_once_with(
			calendarId="eva@group.calendar.google.com", body={"summary": "Evaluations"}
		)
		self.assertEqual(self._calendar_of(self.EVALUATOR), "Evaluations")

	def test_a_rename_google_refuses_changes_nothing(self):
		name = self._connected_calendar()
		with patch(
			"frappe.integrations.doctype.google_calendar.google_calendar.get_google_calendar_object",
			side_effect=Exception("Google is down"),
		):
			with self.assertRaises(frappe.ValidationError):
				update_evaluator_calendar("calendar_name", "Evaluations")

		self.assertEqual(self._calendar_of(self.EVALUATOR), name)

	def test_a_pending_sign_in_follows_a_rename(self):
		frappe.session.user = self.EVALUATOR
		key = f"{EVALUATOR_CALENDAR_CACHE}:{self.EVALUATOR}"
		frappe.cache.set_value(key, {"calendar": ensure_evaluator_calendar(), "state": "s"})

		update_evaluator_calendar("calendar_name", "Renamed mid sign-in")

		self.assertEqual(frappe.cache.get_value(key), {"calendar": "Renamed mid sign-in", "state": "s"})

	def test_callback_refuses_a_calendar_that_is_not_the_callers(self):
		frappe.session.user = self.OTHER
		other_calendar = ensure_evaluator_calendar()
		frappe.session.user = self.EVALUATOR
		frappe.cache.set_value(
			f"{EVALUATOR_CALENDAR_CACHE}:{self.EVALUATOR}", {"calendar": other_calendar, "state": "s"}
		)

		with self.assertRaises(frappe.PermissionError):
			google_calendar_callback(code="code", state="s")
