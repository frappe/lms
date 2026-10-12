# Copyright (c) 2023, Frappe and Contributors
# See license.txt

from unittest.mock import MagicMock, patch

import frappe
from frappe.utils import add_days, nowdate

from lms.lms.doctype.lms_live_class.lms_live_class import GoogleCalendarMissingError
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
				"refresh_token": "test-refresh-token",
				"push_to_google_calendar": 1,
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

	# --- #2800: no learner sees another on the shared invite ---

	def _zoom_account(self):
		return (
			frappe.get_doc(
				{
					"doctype": "LMS Zoom Settings",
					"account_name": f"Live Class Test Zoom {frappe.generate_hash(length=6)}",
					"account_id": "test-account",
					"client_id": "test-client",
					"client_secret": "test-secret",
					"member": "Administrator",
					"enabled": 1,
				}
			)
			.insert()
			.name
		)

	def _only_the_fixture_calendar(self):
		"""Zoom classes use the scheduler's enabled calendar; leave just this class's
		own, so a calendar left behind by another run cannot stand in for it."""
		others = frappe.get_all(
			"Google Calendar", {"enable": 1, "name": ["!=", self.google_calendar.name]}, pluck="name"
		)
		for name in others:
			frappe.db.set_value("Google Calendar", name, "enable", 0)
		self.addCleanup(lambda: [frappe.db.set_value("Google Calendar", n, "enable", 1) for n in others])

	def _student(self):
		email = f"live-class-student-{frappe.generate_hash(length=6)}@example.com"
		self._create_user(email, "Live", "Student", ["LMS Student"])
		return email

	def _event_guests(self, live_class):
		return frappe.get_all(
			"Event Participants", {"parent": live_class.event, "parenttype": "Event"}, pluck="email"
		)

	def test_zoom_live_class_without_a_calendar_raises_error(self):
		"""Google Calendar sends a Zoom class's invites, so it is still required."""
		calendars = frappe.get_all("Google Calendar", {"enable": 1}, pluck="name")
		for name in calendars:
			frappe.db.set_value("Google Calendar", name, "enable", 0)
		self.addCleanup(lambda: [frappe.db.set_value("Google Calendar", n, "enable", 1) for n in calendars])

		with self.assertRaisesRegex(GoogleCalendarMissingError, "Google Calendar connection is needed"):
			self._create_live_class(provider="Zoom", zoom_account=self._zoom_account())

	def test_scheduling_a_zoom_class_without_a_calendar_makes_no_zoom_meeting(self):
		"""The save would fail for want of a calendar; a meeting made first is orphaned."""
		from lms.lms.doctype.lms_batch.lms_batch import create_live_class

		calendars = frappe.get_all("Google Calendar", {"enable": 1}, pluck="name")
		for name in calendars:
			frappe.db.set_value("Google Calendar", name, "enable", 0)
		self.addCleanup(lambda: [frappe.db.set_value("Google Calendar", n, "enable", 1) for n in calendars])

		zoom = "lms.lms.doctype.lms_batch.lms_batch.requests"
		token = MagicMock(**{"json.return_value": {"access_token": "test-token"}})
		with patch(f"{zoom}.request", return_value=token), patch(f"{zoom}.post") as zoom_call:
			with self.assertRaises(frappe.exceptions.ValidationError):
				create_live_class(
					batch_name=self.batch.name,
					zoom_account=self._zoom_account(),
					title="No calendar",
					duration=60,
					date=add_days(nowdate(), 1),
					time="10:00:00",
					timezone="Asia/Kolkata",
					auto_recording="No Recording",
				)
		zoom_call.assert_not_called()

	def test_a_zoom_meeting_is_deleted_when_its_class_fails_to_save(self):
		"""The calendar can be set up yet unusable (never authorised, say); the class
		then fails to save after the Zoom meeting exists, which must not be left behind."""
		from lms.lms.doctype.lms_batch.lms_batch import create_live_class
		from lms.lms.doctype.lms_live_class.lms_live_class import LMSLiveClass

		zoom = "lms.lms.doctype.lms_batch.lms_batch.requests"
		token = MagicMock(**{"json.return_value": {"access_token": "test-token"}})
		meeting = MagicMock(status_code=201, text='{"id": 4242, "join_url": "https://zoom.us/j/4242"}')
		with (
			patch(f"{zoom}.request", return_value=token),
			patch(f"{zoom}.post", return_value=meeting),
			patch(f"{zoom}.delete") as delete_call,
			patch.object(
				LMSLiveClass,
				"create_calendar_event",
				side_effect=frappe.ValidationError("Google Calendar is not authorised"),
			),
		):
			with self.assertRaises(frappe.ValidationError):
				create_live_class(
					batch_name=self.batch.name,
					zoom_account=self._zoom_account(),
					title="Unsynced calendar",
					duration=60,
					date=add_days(nowdate(), 1),
					time="10:00:00",
					timezone="Asia/Kolkata",
					auto_recording="No Recording",
				)
		self.assertIn("/meetings/4242", delete_call.call_args.args[0])

	def test_an_unauthorised_calendar_is_reported_before_the_class_is_made(self):
		"""Never authorised, the sync would fail midway; say what to fix up front."""
		self._only_the_fixture_calendar()
		self.google_calendar.reload()
		token = self.google_calendar.get_password("refresh_token", raise_exception=False)
		from frappe.utils.password import remove_encrypted_password, set_encrypted_password

		remove_encrypted_password("Google Calendar", self.google_calendar.name, "refresh_token")
		self.addCleanup(
			set_encrypted_password, "Google Calendar", self.google_calendar.name, token, "refresh_token"
		)

		with self.assertRaisesRegex(GoogleCalendarMissingError, "Authorise your Google Calendar"):
			self._create_live_class(provider="Zoom", zoom_account=self._zoom_account())

	def test_a_calendar_that_does_not_push_to_google_is_reported(self):
		"""With push off nothing reaches Google, so no learner would be invited."""
		self._only_the_fixture_calendar()
		frappe.db.set_value("Google Calendar", self.google_calendar.name, "push_to_google_calendar", 0)
		self.addCleanup(
			frappe.db.set_value, "Google Calendar", self.google_calendar.name, "push_to_google_calendar", 1
		)

		with self.assertRaisesRegex(GoogleCalendarMissingError, "Push to Google Calendar"):
			self._create_live_class(provider="Zoom", zoom_account=self._zoom_account())

	def test_a_late_learner_is_not_added_to_an_old_public_event(self):
		"""Events from before were Public: any staff member could read their guests."""
		live_class = self._create_live_class()
		live_class.reload()
		frappe.db.set_value("Event", live_class.event, "event_type", "Public")

		student = self._student()
		self._create_batch_enrollment(student, self.batch.name)

		self.assertNotIn(student, self._event_guests(live_class))

	def test_a_zoom_meeting_that_cannot_be_deleted_is_logged(self):
		from lms.lms.doctype.lms_batch.lms_batch import delete_zoom_meeting

		refused = MagicMock(ok=False, status_code=404, text="no such meeting")
		with (
			patch("lms.lms.doctype.lms_batch.lms_batch.requests.delete", return_value=refused),
			patch("lms.lms.doctype.lms_batch.lms_batch.frappe.log_error") as log_error,
		):
			delete_zoom_meeting(4242, {})

		self.assertIn("404", log_error.call_args.kwargs["message"])
		self.assertTrue(log_error.call_args.kwargs["defer_insert"])

	def test_zoom_live_class_invites_learners_with_the_guest_list_hidden(self):
		self._only_the_fixture_calendar()
		student = self._student()
		self._create_batch_enrollment(student, self.batch.name)
		patch_call = self.mock_api.events.return_value.patch
		patch_call.reset_mock()

		live_class = self._create_live_class(provider="Zoom", zoom_account=self._zoom_account())
		live_class.reload()

		self.assertTrue(live_class.event)
		self.assertEqual(
			patch_call.call_args.kwargs["body"],
			{"guestsCanSeeOtherGuests": False, "guestsCanInviteOthers": False},
		)
		self.assertIn(student, self._event_guests(live_class))
		self.assertEqual(frappe.db.get_value("Event", live_class.event, "add_video_conferencing"), 0)

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

	def _fail_hiding_the_guest_list(self):
		patch_call = self.mock_api.events.return_value.patch
		patch_call.side_effect = Exception("Google said no")
		self.addCleanup(setattr, patch_call, "side_effect", None)
		return patch_call

	def _invite_state(self, live_class):
		return frappe.db.get_value(
			"LMS Live Class", live_class.name, ["invite_status", "invite_attempts"], as_dict=True
		)

	def test_learners_are_invited_on_a_retry_once_google_recovers(self):
		from lms.lms.doctype.lms_live_class.lms_live_class import retry_pending_invites

		student = self._student()
		self._create_batch_enrollment(student, self.batch.name)
		patch_call = self._fail_hiding_the_guest_list()

		live_class = self._create_live_class()
		live_class.reload()
		self.assertEqual(self._invite_state(live_class), {"invite_status": "Retrying", "invite_attempts": 1})

		patch_call.side_effect = None
		retry_pending_invites()

		self.assertIn(student, self._event_guests(live_class))
		self.assertEqual(self._invite_state(live_class), {"invite_status": "", "invite_attempts": 0})

	def test_a_failed_invite_leaves_no_guest_rows_behind(self):
		"""Rows left behind would make the learners look invited, so the retry would
		skip them and Google would never send their invites."""
		student = self._student()
		self._create_batch_enrollment(student, self.batch.name)
		update = self.mock_api.events.return_value.update.return_value.execute
		update.side_effect = Exception("Google rejected the update")
		self.addCleanup(setattr, update, "side_effect", None)

		live_class = self._create_live_class(provider="Zoom", zoom_account=self._zoom_account())
		live_class.reload()

		self.assertNotIn(student, self._event_guests(live_class))
		self.assertEqual(self._invite_state(live_class).invite_status, "Retrying")

	def test_the_hosts_are_told_once_the_retries_run_out(self):
		from lms.lms.doctype.lms_live_class.lms_live_class import (
			MAX_INVITE_ATTEMPTS,
			retry_pending_invites,
		)

		self._create_batch_enrollment(self._student(), self.batch.name)
		self._fail_hiding_the_guest_list()
		live_class = self._create_live_class()
		live_class.reload()

		for _attempt in range(MAX_INVITE_ATTEMPTS + 2):
			retry_pending_invites()

		self.assertEqual(
			self._invite_state(live_class),
			{"invite_status": "Failed", "invite_attempts": MAX_INVITE_ATTEMPTS},
		)
		notices = frappe.get_all(
			"Notification Log",
			{"document_type": "LMS Live Class", "document_name": live_class.name},
			pluck="for_user",
		)
		# Once each. The class's host and owner are Administrator, who Frappe never
		# notifies of their own doing, so here only the batch's instructors are told.
		instructors = frappe.get_all(
			"Course Instructor", {"parenttype": "LMS Batch", "parent": self.batch.name}, pluck="instructor"
		)
		self.assertCountEqual(notices, instructors)

	def test_retry_invites_a_failed_class_and_clears_it(self):
		from lms.lms.doctype.lms_live_class.lms_live_class import retry_invites

		student = self._student()
		self._create_batch_enrollment(student, self.batch.name)
		patch_call = self._fail_hiding_the_guest_list()
		live_class = self._create_live_class()
		live_class.reload()
		frappe.db.set_value("LMS Live Class", live_class.name, "invite_status", "Failed")

		self.assertFalse(retry_invites(live_class.name))
		self.assertEqual(self._invite_state(live_class).invite_status, "Failed")

		patch_call.side_effect = None
		self.assertTrue(retry_invites(live_class.name))
		self.assertIn(student, self._event_guests(live_class))
		self.assertEqual(self._invite_state(live_class).invite_status, "")

	def test_a_learner_cannot_retry_a_class_invite(self):
		from lms.lms.doctype.lms_live_class.lms_live_class import retry_invites

		live_class = self._create_live_class()
		student = self._student()
		self._create_batch_enrollment(student, self.batch.name)

		frappe.set_user(student)
		self.addCleanup(frappe.set_user, "Administrator")
		with self.assertRaises(frappe.PermissionError):
			retry_invites(live_class.name)

	def test_enrollments_during_an_outage_do_not_use_up_the_tries(self):
		"""A burst of enrollments while Google is briefly down must leave the class
		to the scheduler's retries, not mark it Failed before they run."""
		self._fail_hiding_the_guest_list()
		live_class = self._create_live_class()
		live_class.reload()

		for _student in range(6):
			self._create_batch_enrollment(self._student(), self.batch.name)

		self.assertEqual(self._invite_state(live_class), {"invite_status": "Retrying", "invite_attempts": 1})

	def test_one_broken_class_does_not_stop_the_retries(self):
		from lms.lms.doctype.lms_live_class import lms_live_class

		first = self._create_live_class()
		second = self._create_live_class()
		for live_class in (first, second):
			frappe.db.set_value("LMS Live Class", live_class.name, "invite_status", "Retrying")
		tried = []

		def send(live_class):
			tried.append(live_class)
			if live_class == first.name:
				raise frappe.QueryTimeoutError("lock wait timeout")

		with patch.object(lms_live_class, "send_learner_invites", side_effect=send):
			lms_live_class.retry_pending_invites()

		self.assertIn(first.name, tried)
		self.assertIn(second.name, tried)

	def test_a_class_whose_event_was_deleted_stops_retrying(self):
		from lms.lms.doctype.lms_live_class.lms_live_class import send_learner_invites

		live_class = self._create_live_class()
		live_class.reload()
		frappe.db.set_value("LMS Live Class", live_class.name, "invite_status", "Retrying")
		frappe.db.delete("Event", live_class.event)

		self.assertTrue(send_learner_invites(live_class.name))
		self.assertEqual(self._invite_state(live_class).invite_status, "")

	def test_an_enrolling_learner_never_sees_google_errors(self):
		"""Frappe's Google helpers report through frappe.throw, which logs the
		message before raising; hiding the guest list must be muted too."""
		live_class = self._create_live_class()
		live_class.reload()
		frappe.local.message_log = []

		with patch(
			f"{GOOGLE_CALENDAR_MODULE}.get_google_calendar_object",
			side_effect=lambda *args: frappe.throw("Google Calendar - Could not find Calendar"),
		):
			self._create_batch_enrollment(self._student(), self.batch.name)

		self.assertEqual(frappe.local.message_log, [])
		self.assertEqual(self._invite_state(live_class).invite_status, "Retrying")

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

	def test_the_guest_list_stays_hidden_through_later_updates(self):
		"""Frappe's sync rewrites the Google event on every save. It must carry the
		hidden guest list over, on a late invite and on an edit of the class."""
		live_class = self._create_live_class()
		live_class.reload()
		hidden = {"guestsCanSeeOtherGuests": False, "guestsCanInviteOthers": False}
		events = self.mock_api.events.return_value
		events.get.return_value.execute.side_effect = lambda: {**hidden, "status": "confirmed"}
		self.addCleanup(setattr, events.get.return_value.execute, "side_effect", None)
		events.update.reset_mock()

		self._create_batch_enrollment(self._student(), self.batch.name)
		live_class.reload()
		live_class.title = f"{live_class.title} (moved)"
		live_class.save(ignore_permissions=True)

		bodies = [call.kwargs["body"] for call in events.update.call_args_list]
		self.assertGreaterEqual(len(bodies), 2)
		for body in bodies:
			self.assertFalse(body["guestsCanSeeOtherGuests"])
			self.assertFalse(body["guestsCanInviteOthers"])

	def test_a_class_is_kept_when_inviting_its_learners_fails(self):
		"""Failing the class here would leave its Google event, already synced, with
		nothing in LMS pointing at it. A Zoom class, so the learners' invite is the
		only Google update: a Meet class also updates the event for its link."""
		self._only_the_fixture_calendar()
		self._create_batch_enrollment(self._student(), self.batch.name)
		update = self.mock_api.events.return_value.update.return_value.execute
		update.side_effect = Exception("Google rejected the update")
		self.addCleanup(setattr, update, "side_effect", None)

		live_class = self._create_live_class(provider="Zoom", zoom_account=self._zoom_account())
		live_class.reload()

		self.assertTrue(frappe.db.exists("LMS Live Class", live_class.name))
		self.assertTrue(live_class.event)

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

	def test_google_meet_unauthorised_calendar_is_reported_before_the_class_is_made(self):
		"""The Meet path checks its calendar as the Zoom path does, not only that
		one is set."""
		from frappe.utils.password import remove_encrypted_password, set_encrypted_password

		from lms.lms.doctype.lms_batch.lms_batch import create_google_meet_live_class

		token = self.google_calendar.get_password("refresh_token", raise_exception=False)
		remove_encrypted_password("Google Calendar", self.google_calendar.name, "refresh_token")
		self.addCleanup(
			set_encrypted_password, "Google Calendar", self.google_calendar.name, token, "refresh_token"
		)
		classes_before = frappe.db.count("LMS Live Class")

		with self.assertRaisesRegex(GoogleCalendarMissingError, "Authorise your Google Calendar"):
			create_google_meet_live_class(
				batch_name=self.batch.name,
				google_meet_account=self.google_meet_settings.name,
				title="Test Unauthorised Calendar",
				duration=30,
				date=add_days(nowdate(), 1),
				time="10:00:00",
				timezone="Asia/Kolkata",
			)
		self.assertEqual(frappe.db.count("LMS Live Class"), classes_before)

	def test_google_meet_missing_calendar_raises_error(self):
		"""Creating a live class with a Google Meet account without a calendar should raise an error."""
		from lms.lms.doctype.lms_batch.lms_batch import create_google_meet_live_class

		old_calendar = self.google_meet_settings.google_calendar
		self.google_meet_settings.google_calendar = ""
		self.google_meet_settings.flags.ignore_mandatory = True
		self.google_meet_settings.save()

		with self.assertRaisesRegex(GoogleCalendarMissingError, "Add a Google Calendar"):
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
