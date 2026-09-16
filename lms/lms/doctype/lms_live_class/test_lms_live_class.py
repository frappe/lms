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
