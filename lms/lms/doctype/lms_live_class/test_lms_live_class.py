# Copyright (c) 2023, Frappe and Contributors
# See license.txt

from unittest.mock import MagicMock, patch

import frappe
from frappe.utils import add_days, nowdate

from lms.lms.test_helpers import BaseTestUtils

GOOGLE_CALENDAR_MODULE = "frappe.integrations.doctype.google_calendar.google_calendar"


class TestLMSLiveClass(BaseTestUtils):
	"""Tests for LMS Live Class including Google Meet integration."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		# Mock get_google_calendar_object to prevent Frappe's Event hooks
		# from calling the real Google Calendar API (no OAuth tokens in CI).
		mock_api = MagicMock()
		mock_api.events.return_value.insert.return_value.execute.return_value = {
			"id": "test-gcal-event-id",
			"hangoutLink": "https://meet.google.com/test-link",
			"status": "confirmed",
		}
		mock_api.events.return_value.update.return_value.execute.return_value = {
			"id": "test-gcal-event-id",
			"hangoutLink": "https://meet.google.com/test-link",
		}
		mock_api.events.return_value.patch.return_value.execute.return_value = {}
		mock_api.events.return_value.delete.return_value.execute.return_value = None

		cls.mock_api = mock_api
		gcal_patcher = patch(
			f"{GOOGLE_CALENDAR_MODULE}.get_google_calendar_object",
			return_value=(mock_api, MagicMock()),
		)
		gcal_patcher.start()
		cls.addClassCleanup(gcal_patcher.stop)

		cls.admin = cls._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator", "Batch Evaluator"]
		)
		cls.course = cls._create_course()
		cls._create_evaluator()
		cls.batch = cls._create_batch(cls.course.name)
		cls._setup_google_meet()

	@classmethod
	def _setup_google_meet(cls):
		"""Create Google Calendar and Google Meet Settings for testing."""
		google_settings = frappe.get_doc("Google Settings")
		google_settings.enable = 1
		google_settings.client_id = "test-client-id"
		google_settings.client_secret = "test-client-secret"
		google_settings.save(ignore_permissions=True)

		calendar = frappe.get_doc(
			{
				"doctype": "Google Calendar",
				"calendar_name": f"Test GCal {frappe.generate_hash(length=6)}",
				"user": "Administrator",
				"google_account": "test@gmail.com",
			}
		)
		calendar.insert(ignore_permissions=True)
		cls.google_calendar = calendar

		cls.google_meet_settings = frappe.get_doc(
			{
				"doctype": "LMS Google Meet Settings",
				"account_name": f"Test Meet {frappe.generate_hash(length=6)}",
				"member": "Administrator",
				"google_calendar": cls.google_calendar.name,
				"enabled": 1,
			}
		)
		# nosemgrep: lms-unjustified-ignore-permissions - test fixture setup
		cls.google_meet_settings.insert(ignore_permissions=True)

	def setUp(self):
		super().setUp()
		# Saving these shared docs leaves their in-memory `modified` ahead of the DB
		# row once the savepoint rolls the write back, tripping check_if_latest on
		# the next save. Reload so they always match the rolled-back row.
		self.batch.reload()
		self.google_meet_settings.reload()

	def _create_live_class(self, provider="Google Meet", **kwargs):
		"""Helper to create a live class for testing."""
		data = {
			"doctype": "LMS Live Class",
			"title": f"Test Class {frappe.generate_hash(length=6)}",
			"host": "Administrator",
			"date": add_days(nowdate(), 1),
			"time": "10:00:00",
			"duration": 60,
			"timezone": "Asia/Kolkata",
			"batch_name": self.batch.name,
			"conferencing_provider": provider,
		}
		if provider == "Google Meet":
			data["google_meet_account"] = self.google_meet_settings.name
		data.update(kwargs)

		live_class = frappe.get_doc(data)
		live_class.insert(ignore_permissions=True)
		return live_class

	# --- T9: Unit tests for Google Meet live class creation ---

	def test_google_meet_live_class_creates_event(self):
		"""Creating a Google Meet live class should create a linked Frappe Event."""
		live_class = self._create_live_class()
		live_class.reload()

		self.assertTrue(live_class.event)
		self.assertTrue(frappe.db.exists("Event", live_class.event))

		event = frappe.get_doc("Event", live_class.event)
		self.assertEqual(event.sync_with_google_calendar, 1)
		self.assertEqual(event.add_video_conferencing, 1)
		self.assertEqual(event.google_calendar, self.google_calendar.name)
		self.assertIn("10:00", str(event.starts_on))
		self.assertIn("11:00", str(event.ends_on))

	# --- #2800: calendar only for Google Meet, and no learner on the shared invite ---

	def _zoom_account(self):
		name = "Live Class Test Zoom"
		if not frappe.db.exists("LMS Zoom Settings", name):
			frappe.get_doc(
				{
					"doctype": "LMS Zoom Settings",
					"account_name": name,
					"account_id": "test-account",
					"client_id": "test-client",
					"client_secret": "test-secret",
					"member": "Administrator",
				}
			).insert(ignore_permissions=True)
		return name

	def _student(self):
		email = f"live-class-student-{frappe.generate_hash(length=6)}@example.com"
		self._create_user(email, "Live", "Student", ["LMS Student"])
		return email

	def _event_guests(self, live_class):
		return frappe.get_all(
			"Event Participants", {"parent": live_class.event, "parenttype": "Event"}, pluck="email"
		)

	def test_zoom_live_class_needs_no_calendar(self):
		"""A Zoom class brings its own link: it must not require or create a calendar event."""
		# With no enabled calendar anywhere, so the class cannot lean on one.
		calendars = frappe.get_all("Google Calendar", {"enable": 1}, pluck="name")
		for name in calendars:
			frappe.db.set_value("Google Calendar", name, "enable", 0)
		self.addCleanup(lambda: [frappe.db.set_value("Google Calendar", n, "enable", 1) for n in calendars])

		live_class = self._create_live_class(provider="Zoom", zoom_account=self._zoom_account())
		live_class.reload()

		self.assertFalse(live_class.event)

	def test_learners_are_invited_only_after_the_guest_list_is_hidden(self):
		"""Learners join the Meet from their invite, but must not see each other: the
		guest list is hidden on Google before any learner is added to the event."""
		student = self._student()
		self._create_batch_enrollment(student, self.batch.name)
		guests_when_hidden = []

		def capture_guests(**kwargs):
			# The mock gives every event one Google id, so read this test's event:
			# the newest one.
			event = frappe.get_all("Event", order_by="creation desc", limit=1, pluck="name")[0]
			guests_when_hidden.extend(frappe.get_all("Event Participants", {"parent": event}, pluck="email"))
			return MagicMock()

		patch_call = self.mock_api.events.return_value.patch
		patch_call.reset_mock()
		patch_call.side_effect = capture_guests
		self.addCleanup(setattr, patch_call, "side_effect", None)

		live_class = self._create_live_class()
		live_class.reload()

		self.assertEqual(
			patch_call.call_args.kwargs["body"],
			{"guestsCanSeeOtherGuests": False, "guestsCanInviteOthers": False},
		)
		self.assertNotIn(student, guests_when_hidden)
		self.assertIn(student, self._event_guests(live_class))

	def test_learners_stay_off_the_invite_when_the_guest_list_cannot_be_hidden(self):
		student = self._student()
		self._create_batch_enrollment(student, self.batch.name)
		patch_call = self.mock_api.events.return_value.patch
		patch_call.side_effect = Exception("Google said no")
		self.addCleanup(setattr, patch_call, "side_effect", None)

		live_class = self._create_live_class()
		live_class.reload()

		self.assertTrue(live_class.event)
		self.assertNotIn(student, self._event_guests(live_class))

	def test_a_late_learner_is_not_invited_when_the_guest_list_cannot_be_hidden(self):
		live_class = self._create_live_class()
		live_class.reload()
		patch_call = self.mock_api.events.return_value.patch
		patch_call.side_effect = Exception("Google said no")
		self.addCleanup(setattr, patch_call, "side_effect", None)

		student = self._student()
		self._create_batch_enrollment(student, self.batch.name)

		self.assertNotIn(student, self._event_guests(live_class))

	def test_a_late_learner_is_not_invited_to_an_old_zoom_event(self):
		"""Zoom classes made before this change still have events that were never hidden."""
		live_class = self._create_live_class()
		live_class.reload()
		frappe.db.set_value("LMS Live Class", live_class.name, "conferencing_provider", "Zoom")

		student = self._student()
		self._create_batch_enrollment(student, self.batch.name)

		self.assertNotIn(student, self._event_guests(live_class))

	def test_a_learner_enrolling_while_google_fails_still_enrolls_quietly(self):
		live_class = self._create_live_class()
		live_class.reload()
		update_call = self.mock_api.events.return_value.update
		update_call.return_value.execute.side_effect = Exception("Google is down")
		self.addCleanup(setattr, update_call.return_value.execute, "side_effect", None)
		frappe.local.message_log = []

		student = self._student()
		enrollment = self._create_batch_enrollment(student, self.batch.name)

		self.assertTrue(frappe.db.exists("LMS Batch Enrollment", enrollment.name))
		self.assertEqual(frappe.local.message_log, [])

	def test_a_learner_enrolling_later_is_invited(self):
		"""The old hook added the row but never saved the event, so Google never sent
		the late learner an invite."""
		live_class = self._create_live_class()
		live_class.reload()
		update_call = self.mock_api.events.return_value.update
		update_call.reset_mock()

		student = self._student()
		self._create_batch_enrollment(student, self.batch.name)

		self.assertIn(student, self._event_guests(live_class))
		self.assertTrue(update_call.called)

	def test_google_meet_event_is_private_without_frappe_reminder(self):
		"""A public event lands in every staff member's daily event digest."""
		live_class = self._create_live_class()
		live_class.reload()

		event = frappe.db.get_value("Event", live_class.event, ["event_type", "send_reminder"], as_dict=1)
		self.assertEqual(event.event_type, "Private")
		self.assertEqual(event.send_reminder, 0)

	def test_another_moderator_can_delete_a_class_and_its_private_event(self):
		"""The private event belongs to whoever scheduled the class, not to the deleter."""
		live_class = self._create_live_class()
		live_class.reload()
		event = live_class.event
		moderator = self._create_user(
			f"live-class-mod-{frappe.generate_hash(length=6)}@example.com",
			"Live",
			"Moderator",
			["Moderator"],
			user_type="System User",
		)

		frappe.set_user(moderator.name)
		try:
			frappe.delete_doc("LMS Live Class", live_class.name)
		finally:
			frappe.set_user("Administrator")

		self.assertFalse(frappe.db.exists("Event", event))

	def test_google_meet_disabled_account_raises_error(self):
		"""Creating a live class with a disabled Google Meet account should raise an error."""
		from lms.lms.doctype.lms_batch.lms_batch import create_google_meet_live_class

		self.google_meet_settings.enabled = 0
		self.google_meet_settings.save()

		with self.assertRaises(frappe.exceptions.ValidationError):
			create_google_meet_live_class(
				batch_name=self.batch.name,
				google_meet_account=self.google_meet_settings.name,
				title="Test Disabled",
				duration=30,
				date=add_days(nowdate(), 1),
				time="10:00:00",
				timezone="Asia/Kolkata",
			)

		self.google_meet_settings.enabled = 1
		self.google_meet_settings.save()

	def test_google_meet_missing_calendar_raises_error(self):
		"""Creating a live class with a Google Meet account without a calendar should raise an error."""
		from lms.lms.doctype.lms_batch.lms_batch import create_google_meet_live_class

		old_calendar = self.google_meet_settings.google_calendar
		self.google_meet_settings.google_calendar = ""
		self.google_meet_settings.flags.ignore_mandatory = True
		self.google_meet_settings.save()

		with self.assertRaises(frappe.exceptions.ValidationError):
			create_google_meet_live_class(
				batch_name=self.batch.name,
				google_meet_account=self.google_meet_settings.name,
				title="Test No Calendar",
				duration=30,
				date=add_days(nowdate(), 1),
				time="10:00:00",
				timezone="Asia/Kolkata",
			)

		self.google_meet_settings.google_calendar = old_calendar
		self.google_meet_settings.save()

	def test_updating_a_live_class_updates_its_event(self):
		def date_change(live_class):
			new_date = add_days(nowdate(), 5)
			live_class.date = new_date
			return lambda event: self.assertIn(str(new_date), str(event.starts_on))

		def time_change(live_class):
			live_class.time = "15:00:00"
			return lambda event: self.assertIn("15:00", str(event.starts_on))

		def title_change(live_class):
			live_class.title = "Updated Title"
			return lambda event: self.assertIn("Updated Title", event.subject)

		def duration_change(live_class):
			live_class.duration = 120
			return lambda event: self.assertIn("12:00", str(event.ends_on))

		cases = [
			("date", date_change),
			("time", time_change),
			("title", title_change),
			("duration", duration_change),
		]
		for case, mutate in cases:
			with self.subTest(case=case):
				live_class = self._create_live_class()
				live_class.reload()
				event_name = live_class.event

				check = mutate(live_class)
				live_class.save(ignore_permissions=True)

				check(frappe.get_doc("Event", event_name))

	def test_delete_live_class_deletes_event(self):
		"""Deleting a live class should delete the linked Frappe Event."""
		live_class = self._create_live_class()
		live_class.reload()
		event_name = live_class.event

		self.assertTrue(frappe.db.exists("Event", event_name))

		frappe.delete_doc("LMS Live Class", live_class.name, force=True)
		self.assertFalse(frappe.db.exists("Event", event_name))

	def test_batch_validation_google_meet_without_account(self):
		self.batch.conferencing_provider = "Google Meet"
		self.batch.google_meet_account = ""

		with self.assertRaises(frappe.exceptions.ValidationError):
			self.batch.save()

	def test_batch_validation_google_meet_with_valid_account(self):
		self.batch.conferencing_provider = "Google Meet"
		self.batch.google_meet_account = self.google_meet_settings.name

		self.batch.save()
		self.batch.reload()

		self.assertEqual(self.batch.conferencing_provider, "Google Meet")
		self.assertEqual(self.batch.google_meet_account, self.google_meet_settings.name)

	def test_batch_validation_zoom_without_account(self):
		self.batch.conferencing_provider = "Zoom"
		self.batch.zoom_account = ""

		with self.assertRaises(frappe.exceptions.ValidationError):
			self.batch.save()
