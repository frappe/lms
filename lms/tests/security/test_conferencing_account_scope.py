# Copyright (c) 2026, Frappe and Contributors
# See license.txt

"""A live class can only use the batch's own Zoom or Google Meet account, the caller's
own account, or one the caller can read anyway (a Moderator)."""

import json
from unittest.mock import MagicMock, patch

import frappe
from frappe.utils import add_days, nowdate

from lms.lms.doctype.lms_batch import lms_batch
from lms.lms.doctype.lms_live_class.lms_live_class import LMSLiveClass
from lms.lms.permissions import can_use_conferencing_account
from lms.lms.test_helpers import BaseTestUtils

LIVE_CLASS_MODULE = "lms.lms.doctype.lms_live_class.lms_live_class"


class TestConferencingAccountScope(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		hash = frappe.generate_hash(length=6)
		cls.jannat = cls._create_user(f"cas-jannat-{hash}@example.com", "Jannat", "Owner", ["Course Creator"])
		cls.ashley = cls._create_user(f"cas-ashley-{hash}@example.com", "Ashley", "Co", ["Course Creator"])
		cls.olivia = cls._create_user(f"cas-olivia-{hash}@example.com", "Olivia", "Other", ["Course Creator"])
		cls.outsider = cls._create_user(f"cas-out-{hash}@example.com", "Otto", "Out", ["Course Creator"])
		cls.evaluator = cls._create_user(f"cas-eval-{hash}@example.com", "Eva", "Eval", ["Batch Evaluator"])
		cls.moderator = cls._create_user(f"cas-mod-{hash}@example.com", "Mia", "Mod", ["Moderator"])
		cls._create_evaluator(cls.evaluator.name)

		course = cls._create_course(title=f"CAS Course {hash}", instructor=cls.jannat.name).name
		cls.batch = cls._create_batch(
			course=course, instructor=cls.jannat.name, title=f"CAS Batch {hash}", evaluator=cls.evaluator.name
		)
		cls.batch.append("instructors", {"instructor": cls.ashley.name})
		cls.batch.save()
		cls.batch = cls.batch.name
		cls.outsider_batch = cls._create_batch(
			course=course,
			instructor=cls.outsider.name,
			title=f"CAS Outsider Batch {hash}",
			evaluator=cls.evaluator.name,
		).name
		cls.jannat_batch = cls._create_batch(
			course=course,
			instructor=cls.jannat.name,
			title=f"CAS Jannat Batch {hash}",
			evaluator=cls.evaluator.name,
		).name

		cls.jannat_zoom = cls._account("LMS Zoom Settings", f"CAS Jannat Zoom {hash}", cls.jannat.name)
		cls.olivia_zoom = cls._account("LMS Zoom Settings", f"CAS Olivia Zoom {hash}", cls.olivia.name)
		cls.jannat_meet = cls._account("LMS Google Meet Settings", f"CAS Jannat Meet {hash}", cls.jannat.name)
		cls.olivia_meet = cls._account("LMS Google Meet Settings", f"CAS Olivia Meet {hash}", cls.olivia.name)
		frappe.db.set_value(
			"LMS Batch", cls.batch, {"zoom_account": cls.jannat_zoom, "google_meet_account": cls.jannat_meet}
		)

	@classmethod
	def _account(cls, doctype, account_name, member):
		account = {"doctype": doctype, "account_name": account_name, "member": member, "enabled": 1}
		if doctype == "LMS Zoom Settings":
			account.update({"account_id": "acc-id", "client_id": "client-id", "client_secret": "secret"})
		else:
			account["google_calendar"] = "test-calendar"
		# Made by Administrator, so the member gets no read through owning the record.
		frappe.get_doc(account).db_insert()
		return account_name

	def _create_zoom_class(self, batch, zoom_account):
		"""Zoom's HTTP calls and the class's calendar event are stubbed; the account check is not."""
		token = MagicMock(**{"json.return_value": {"access_token": "test-token"}})
		meeting = MagicMock(
			status_code=201,
			text=json.dumps(
				{"start_url": "https://zoom.us/s/1", "join_url": "https://zoom.us/j/1", "id": "1"}
			),
		)
		with (
			patch.object(lms_batch.requests, "request", return_value=token) as token_call,
			patch.object(lms_batch.requests, "post", return_value=meeting) as meeting_call,
			patch.object(LMSLiveClass, "create_calendar_event"),
			patch(f"{LIVE_CLASS_MODULE}.get_live_class_calendar", return_value="test-calendar"),
		):
			try:
				return lms_batch.create_live_class(
					batch_name=batch,
					zoom_account=zoom_account,
					title="Zoom Class",
					duration=30,
					date=add_days(nowdate(), 1),
					time="10:00:00",
					timezone="Asia/Kolkata",
					auto_recording="No Recording",
				)
			finally:
				self.zoom_calls = token_call.call_count + meeting_call.call_count

	def _create_meet_class(self, batch, google_meet_account):
		with (
			patch.object(LMSLiveClass, "create_calendar_event") as calendar_call,
			patch(f"{LIVE_CLASS_MODULE}.ensure_calendar_can_send_invites"),
		):
			try:
				return lms_batch.create_google_meet_live_class(
					batch_name=batch,
					google_meet_account=google_meet_account,
					title="Meet Class",
					duration=30,
					date=add_days(nowdate(), 1),
					time="10:00:00",
					timezone="Asia/Kolkata",
				)
			finally:
				self.calendar_calls = calendar_call.call_count

	def _refused_message(self, create, *args):
		with self.assertRaises(frappe.PermissionError) as refused:
			create(*args)
		return str(refused.exception)

	def test_a_co_instructor_can_use_the_batch_account_owned_by_another_instructor(self):
		frappe.set_user(self.ashley.name)
		zoom_class = self._create_zoom_class(self.batch, self.jannat_zoom)
		meet_class = self._create_meet_class(self.batch, self.jannat_meet)

		self.assertEqual(zoom_class.zoom_account, self.jannat_zoom)
		self.assertEqual(meet_class.google_meet_account, self.jannat_meet)

	def test_an_instructor_cannot_use_another_members_zoom_account(self):
		for user in (self.ashley.name, self.evaluator.name):
			with self.subTest(user=user):
				frappe.set_user(user)
				with self.assertRaises(frappe.PermissionError):
					self._create_zoom_class(self.batch, self.olivia_zoom)
				self.assertEqual(self.zoom_calls, 0)

	def test_an_instructor_cannot_use_another_members_google_meet_account(self):
		for user in (self.ashley.name, self.evaluator.name):
			with self.subTest(user=user):
				frappe.set_user(user)
				with self.assertRaises(frappe.PermissionError):
					self._create_meet_class(self.batch, self.olivia_meet)
				self.assertEqual(self.calendar_calls, 0)

	def test_an_instructor_of_another_batch_cannot_use_the_batch_account(self):
		frappe.set_user(self.outsider.name)
		with self.assertRaises(frappe.PermissionError):
			self._create_zoom_class(self.outsider_batch, self.jannat_zoom)
		self.assertEqual(self.zoom_calls, 0)

		with self.assertRaises(frappe.PermissionError):
			self._create_meet_class(self.outsider_batch, self.jannat_meet)
		self.assertEqual(self.calendar_calls, 0)

	def test_a_missing_account_and_a_refused_one_give_the_same_error(self):
		frappe.set_user(self.ashley.name)
		self.assertEqual(
			self._refused_message(self._create_zoom_class, self.batch, "No Such Zoom Account"),
			self._refused_message(self._create_zoom_class, self.batch, self.olivia_zoom),
		)
		self.assertEqual(
			self._refused_message(self._create_meet_class, self.batch, "No Such Meet Account"),
			self._refused_message(self._create_meet_class, self.batch, self.olivia_meet),
		)

	def test_a_live_class_saved_directly_cannot_name_another_members_account(self):
		frappe.set_user(self.ashley.name)
		live_class = frappe.get_doc(
			{
				"doctype": "LMS Live Class",
				"title": "Direct Class",
				"batch_name": self.batch,
				"date": add_days(nowdate(), 1),
				"time": "10:00:00",
				"duration": 30,
				"timezone": "Asia/Kolkata",
				"host": self.ashley.name,
				"conferencing_provider": "Zoom",
				"zoom_account": self.olivia_zoom,
			}
		)
		with patch.object(LMSLiveClass, "create_calendar_event"):
			with self.assertRaisesRegex(frappe.PermissionError, "this batch's live classes"):
				live_class.insert()

			live_class.zoom_account = self.jannat_zoom
			live_class.insert()

			live_class.zoom_account = self.olivia_zoom
			with self.assertRaises(frappe.PermissionError):
				live_class.save()

	def test_a_batch_cannot_be_given_another_members_account(self):
		frappe.set_user(self.ashley.name)
		batch = frappe.get_doc("LMS Batch", self.batch)
		batch.zoom_account = self.olivia_zoom
		with self.assertRaisesRegex(frappe.PermissionError, "You can't set this account on the batch"):
			batch.save()

	def test_the_owner_can_use_their_own_account_on_any_batch_they_teach(self):
		frappe.set_user(self.jannat.name)
		zoom_class = self._create_zoom_class(self.jannat_batch, self.jannat_zoom)
		meet_class = self._create_meet_class(self.jannat_batch, self.jannat_meet)

		self.assertEqual(zoom_class.zoom_account, self.jannat_zoom)
		self.assertEqual(meet_class.google_meet_account, self.jannat_meet)

	def test_a_moderator_can_use_any_account(self):
		frappe.set_user(self.moderator.name)
		zoom_class = self._create_zoom_class(self.batch, self.olivia_zoom)
		meet_class = self._create_meet_class(self.batch, self.olivia_meet)

		self.assertEqual(zoom_class.zoom_account, self.olivia_zoom)
		self.assertEqual(meet_class.google_meet_account, self.olivia_meet)

	def test_a_class_with_no_account_asks_for_one(self):
		frappe.set_user(self.ashley.name)
		with self.assertRaisesRegex(frappe.ValidationError, "Please select a Zoom account"):
			self._create_zoom_class(self.batch, "")
		self.assertEqual(self.zoom_calls, 0)
		with self.assertRaisesRegex(frappe.ValidationError, "Please select a Google Meet account"):
			self._create_meet_class(self.batch, "")

	def test_each_account_is_checked_once_per_class(self):
		frappe.set_user(self.ashley.name)
		with patch(
			f"{LIVE_CLASS_MODULE}.can_use_conferencing_account", wraps=can_use_conferencing_account
		) as check:
			self._create_zoom_class(self.batch, self.jannat_zoom)
		self.assertEqual(check.call_count, 1)

	def test_the_attendance_job_loads_the_account_of_any_class(self):
		"""authenticate checks nothing: the scheduler calls it for every class, with no batch."""
		frappe.set_user(self.ashley.name)
		token = MagicMock(**{"json.return_value": {"access_token": "test-token"}})
		with patch.object(lms_batch.requests, "request", return_value=token):
			self.assertEqual(lms_batch.authenticate(self.olivia_zoom), "test-token")
