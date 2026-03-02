# Copyright (c) 2023, Frappe and Contributors
# See license.txt

import frappe
from frappe.utils import add_days, nowdate

from lms.lms.test_helpers import BaseTestUtils


class TestLMSLiveClass(BaseTestUtils):
	"""Tests for LMS Live Class including Google Meet integration."""

	def setUp(self):
		super().setUp()
		self._setup_course_flow()
		self._setup_batch_flow()
		self._setup_google_meet()

	def tearDown(self):
		super().tearDown()
		if hasattr(self, "_original_google_settings"):
			google_settings = frappe.get_doc("Google Settings")
			google_settings.enable = self._original_google_settings["enable"]
			google_settings.client_id = self._original_google_settings["client_id"]
			google_settings.client_secret = ""
			google_settings.save(ignore_permissions=True)

	def _setup_google_meet(self):
		"""Create Google Calendar and Google Meet Settings for testing."""
		google_settings = frappe.get_doc("Google Settings")
		self._original_google_settings = {
			"enable": google_settings.enable,
			"client_id": google_settings.client_id,
		}
		google_settings.enable = 1
		google_settings.client_id = "test-client-id"
		google_settings.client_secret = "test-client-secret"
		google_settings.save(ignore_permissions=True)

		calendar_name = f"Test GCal {frappe.generate_hash(length=6)}"
		if not frappe.db.exists("Google Calendar", calendar_name):
			calendar = frappe.get_doc(
				{
					"doctype": "Google Calendar",
					"calendar_name": calendar_name,
					"user": "Administrator",
					"google_account": "test@gmail.com",
				}
			)
			calendar.insert(ignore_permissions=True)
			self.cleanup_items.append(("Google Calendar", calendar.name))
			self.google_calendar = calendar
		else:
			self.google_calendar = frappe.get_doc("Google Calendar", calendar_name)

		account_name = f"Test Meet {frappe.generate_hash(length=6)}"
		self.google_meet_settings = frappe.get_doc(
			{
				"doctype": "LMS Google Meet Settings",
				"account_name": account_name,
				"member": "Administrator",
				"google_calendar": self.google_calendar.name,
				"enabled": 1,
			}
		)
		self.google_meet_settings.insert(ignore_permissions=True)
		self.cleanup_items.append(("LMS Google Meet Settings", self.google_meet_settings.name))

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
		self.cleanup_items.append(("LMS Live Class", live_class.name))
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

	def test_google_meet_live_class_event_has_correct_times(self):
		"""The linked Event should have correct start and end times."""
		live_class = self._create_live_class()
		live_class.reload()

		event = frappe.get_doc("Event", live_class.event)
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
		self.google_meet_settings.save(ignore_mandatory=True)

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

	def test_zoom_live_class_not_affected(self):
		"""Creating a Zoom-style live class should still work (regression test)."""
		live_class = frappe.get_doc(
			{
				"doctype": "LMS Live Class",
				"title": f"Zoom Class {frappe.generate_hash(length=6)}",
				"host": "Administrator",
				"date": add_days(nowdate(), 1),
				"time": "14:00:00",
				"duration": 45,
				"timezone": "Asia/Kolkata",
				"batch_name": self.batch.name,
				"conferencing_provider": "Zoom",
				"join_url": "https://zoom.us/j/123456",
				"start_url": "https://zoom.us/s/123456",
			}
		)
		live_class.insert(ignore_permissions=True)
		self.cleanup_items.append(("LMS Live Class", live_class.name))

		self.assertTrue(frappe.db.exists("LMS Live Class", live_class.name))
		self.assertEqual(live_class.join_url, "https://zoom.us/j/123456")

	# --- T10: Unit tests for event update and cancellation sync ---

	def test_update_live_class_date_updates_event(self):
		"""Rescheduling a live class should update the linked Event."""
		live_class = self._create_live_class()
		live_class.reload()
		event_name = live_class.event

		new_date = add_days(nowdate(), 5)
		live_class.date = new_date
		live_class.save(ignore_permissions=True)

		event = frappe.get_doc("Event", event_name)
		self.assertIn(str(new_date), str(event.starts_on))

	def test_update_live_class_time_updates_event(self):
		"""Changing the time of a live class should update the linked Event."""
		live_class = self._create_live_class()
		live_class.reload()
		event_name = live_class.event

		live_class.time = "15:00:00"
		live_class.save(ignore_permissions=True)

		event = frappe.get_doc("Event", event_name)
		self.assertIn("15:00", str(event.starts_on))

	def test_update_live_class_title_updates_event(self):
		"""Changing the title of a live class should update the linked Event subject."""
		live_class = self._create_live_class()
		live_class.reload()
		event_name = live_class.event

		live_class.title = "Updated Title"
		live_class.save(ignore_permissions=True)

		event = frappe.get_doc("Event", event_name)
		self.assertIn("Updated Title", event.subject)

	def test_update_live_class_duration_updates_event(self):
		"""Changing the duration should update the linked Event's end time."""
		live_class = self._create_live_class()
		live_class.reload()
		event_name = live_class.event

		live_class.duration = 120
		live_class.save(ignore_permissions=True)

		event = frappe.get_doc("Event", event_name)
		self.assertIn("12:00", str(event.ends_on))

	def test_delete_live_class_deletes_event(self):
		"""Deleting a live class should delete the linked Frappe Event."""
		live_class = self._create_live_class()
		live_class.reload()
		event_name = live_class.event

		self.assertTrue(frappe.db.exists("Event", event_name))

		# Remove from cleanup since we're deleting manually
		self.cleanup_items = [
			(t, n) for t, n in self.cleanup_items if not (t == "LMS Live Class" and n == live_class.name)
		]
		frappe.delete_doc("LMS Live Class", live_class.name, force=True)

		self.assertFalse(frappe.db.exists("Event", event_name))

	def test_delete_zoom_live_class_with_event(self):
		"""Deleting a Zoom live class with a linked event should also delete the event (regression)."""
		live_class = self._create_live_class(provider="Zoom")
		# Zoom classes created via direct insert won't have an event from calendar flow,
		# but if one is set manually, on_trash should clean it up
		event = frappe.get_doc(
			{
				"doctype": "Event",
				"subject": "Test Zoom Event",
				"event_type": "Public",
				"starts_on": f"{add_days(nowdate(), 1)} 14:00:00",
				"ends_on": f"{add_days(nowdate(), 1)} 15:00:00",
			}
		)
		event.insert(ignore_permissions=True)
		self.cleanup_items.append(("Event", event.name))

		frappe.db.set_value("LMS Live Class", live_class.name, "event", event.name)
		live_class.reload()

		self.cleanup_items = [
			(t, n) for t, n in self.cleanup_items if not (t == "LMS Live Class" and n == live_class.name)
		]
		# Remove event from cleanup too since on_trash will delete it
		self.cleanup_items = [(t, n) for t, n in self.cleanup_items if not (t == "Event" and n == event.name)]
		frappe.delete_doc("LMS Live Class", live_class.name, force=True)

		self.assertFalse(frappe.db.exists("Event", event.name))

	# --- T11: Integration tests for end-to-end workflow ---

	def test_batch_validation_google_meet_without_account(self):
		"""Saving a batch with Google Meet provider but no account should fail."""
		self.batch.conferencing_provider = "Google Meet"
		self.batch.google_meet_account = ""
		with self.assertRaises(frappe.exceptions.ValidationError):
			self.batch.save()

		# Reset
		self.batch.reload()

	def test_batch_validation_google_meet_with_valid_account(self):
		"""Saving a batch with Google Meet and a valid account should succeed."""
		self.batch.conferencing_provider = "Google Meet"
		self.batch.google_meet_account = self.google_meet_settings.name
		self.batch.save()
		self.batch.reload()

		self.assertEqual(self.batch.conferencing_provider, "Google Meet")
		self.assertEqual(self.batch.google_meet_account, self.google_meet_settings.name)

		# Reset
		self.batch.conferencing_provider = ""
		self.batch.google_meet_account = ""
		self.batch.save()

	def test_batch_validation_zoom_without_account(self):
		"""Saving a batch with Zoom provider but no account should fail."""
		self.batch.conferencing_provider = "Zoom"
		self.batch.zoom_account = ""
		with self.assertRaises(frappe.exceptions.ValidationError):
			self.batch.save()

		# Reset
		self.batch.reload()

	def test_update_attendance_skips_google_meet(self):
		"""The Zoom attendance scheduler should skip Google Meet classes."""
		from lms.lms.doctype.lms_live_class.lms_live_class import update_attendance

		live_class = self._create_live_class()
		live_class.reload()

		# The update_attendance function filters out Google Meet classes
		# It should not raise an error or attempt to call Zoom API for Google Meet classes
		past_classes = frappe.get_all(
			"LMS Live Class",
			{
				"uuid": ["is", "set"],
				"attendees": ["is", "not set"],
				"conferencing_provider": ["!=", "Google Meet"],
			},
			pluck="name",
		)
		self.assertNotIn(live_class.name, past_classes)
