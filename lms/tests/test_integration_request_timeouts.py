# Copyright (c) 2026, Frappe and Contributors
# See license.txt

"""Regression: Zoom and Unsplash calls had no timeout, so a stalled upstream held
the web worker until gunicorn killed it. Guards that each call passes `timeout`."""

from unittest.mock import MagicMock, patch

import frappe
from frappe.tests import UnitTestCase

from lms.lms.doctype.lms_batch.lms_batch import (
	ZOOM_REQUEST_TIMEOUT_SECONDS,
	authenticate,
	create_live_class,
	delete_zoom_meeting,
)
from lms.lms.doctype.lms_live_class.lms_live_class import get_attendance


class TestZoomRequestTimeouts(UnitTestCase):
	def test_authenticate_passes_timeout(self):
		zoom = frappe._dict(
			enabled=1,
			account_id="acct",
			client_id="cid",
			get_password=lambda **kwargs: "secret",
		)
		with (
			patch("frappe.get_doc", return_value=zoom),
			patch(
				"lms.lms.doctype.lms_batch.lms_batch.requests.request",
				return_value=MagicMock(json=lambda: {"access_token": "tok"}),
			) as mock_request,
		):
			self.assertEqual(authenticate("any-account"), "tok")

		self.assertIn("timeout", mock_request.call_args.kwargs)

	def test_create_live_class_passes_timeout(self):
		# A non-201 makes create_live_class throw before it builds a doc, so the
		# timeout assertion does not need a real batch or Zoom account.
		with (
			patch("lms.lms.doctype.lms_batch.lms_batch.authenticate", return_value="tok"),
			patch("lms.lms.doctype.lms_batch.lms_batch.check_can_schedule_live_class"),
			patch("lms.lms.doctype.lms_live_class.lms_live_class.check_class_can_use_account"),
			patch("lms.lms.doctype.lms_live_class.lms_live_class.get_live_class_calendar"),
			patch(
				"lms.lms.doctype.lms_batch.lms_batch.requests.post",
				return_value=MagicMock(status_code=500, text="upstream down"),
			) as mock_post,
		):
			with self.assertRaises(frappe.exceptions.ValidationError):
				create_live_class(
					batch_name="any-batch",
					zoom_account="any-account",
					title="Class",
					duration=30,
					date="2026-08-04",
					time="10:00:00",
					timezone="Asia/Kolkata",
					auto_recording="No Recording",
				)

		self.assertIn("timeout", mock_post.call_args.kwargs)

	def test_get_attendance_passes_timeout(self):
		live_class = frappe._dict(zoom_account="any-account", uuid="abc/==")
		with (
			patch("lms.lms.doctype.lms_live_class.lms_live_class.authenticate", return_value="tok"),
			patch(
				"lms.lms.doctype.lms_live_class.lms_live_class.requests.get",
				return_value=MagicMock(status_code=200, json=lambda: {"participants": []}),
			) as mock_get,
		):
			get_attendance(live_class)

		self.assertIn("timeout", mock_get.call_args.kwargs)


class TestUnsplashRequestTimeout(UnitTestCase):
	def test_delete_zoom_meeting_uses_the_shared_timeout(self):
		with patch(
			"lms.lms.doctype.lms_batch.lms_batch.requests.delete",
			return_value=MagicMock(ok=True),
		) as mock_delete:
			delete_zoom_meeting("123", {})

		self.assertEqual(mock_delete.call_args.kwargs["timeout"], ZOOM_REQUEST_TIMEOUT_SECONDS)

	def test_unsplash_request_passes_timeout(self):
		from lms.unsplash import make_unsplash_request

		# unsplash.py imports requests inside the function, so patch it at source.
		with (
			patch("frappe.db.get_single_value", return_value="access-key"),
			patch(
				"requests.get",
				return_value=MagicMock(raise_for_status=lambda: None, json=lambda: {"results": []}),
			) as mock_get,
		):
			make_unsplash_request("/photos")

		self.assertIn("timeout", mock_get.call_args.kwargs)

	def test_unconfigured_site_makes_no_request(self):
		from lms.unsplash import make_unsplash_request

		with (
			patch("frappe.db.get_single_value", return_value=None),
			patch("requests.get") as mock_get,
		):
			self.assertIsNone(make_unsplash_request("/photos"))

		mock_get.assert_not_called()
