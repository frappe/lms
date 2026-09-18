# Copyright (c) 2026, Frappe and Contributors
# See license.txt

import frappe
from frappe.tests import UnitTestCase


class UnitTestLMSGoogleMeetSettings(UnitTestCase):
	"""
	Unit tests for LMSGoogleMeetSettings.
	Use this class for testing individual functions and methods.
	"""

	def test_calendar_and_member_are_both_required(self):
		# TestLMSLiveClass::test_google_meet_missing_calendar_raises_error looks like
		# it covers this, but it sets flags.ignore_mandatory to get a calendar-less
		# row saved, so it exercises the live-class path and not the reqd docfields.
		meta = frappe.get_meta("LMS Google Meet Settings")

		for fieldname in ("google_calendar", "member"):
			with self.subTest(fieldname=fieldname):
				self.assertTrue(
					meta.get_field(fieldname).reqd,
					f"{fieldname} must stay mandatory: a settings row without it only fails "
					"later, when someone tries to create a live class",
				)
