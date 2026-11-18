# Copyright (c) 2022, Frappe and Contributors
# See license.txt

from unittest.mock import MagicMock, patch

import frappe
from frappe.utils import add_days, getdate

from lms.lms.doctype.lms_certificate_request.lms_certificate_request import (
	get_unscheduled_evaluations,
	schedule_evals,
	setup_calendar_event,
)
from lms.lms.test_helpers import BaseTestUtils, MemberOwnershipTestMixin

GOOGLE_CALENDAR_MODULE = "frappe.integrations.doctype.google_calendar.google_calendar"


class TestLMSCertificateRequest(MemberOwnershipTestMixin, BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.student_a = cls._create_user("rtv.cr.student.a@example.com", "Student", "Alpha", ["LMS Student"])
		cls.student_b = cls._create_user("rtv.cr.student.b@example.com", "Student", "Bravo", ["LMS Student"])
		cls.moderator = cls._create_user("rtv.cr.moderator@example.com", "Mod", "Erator", ["Moderator"])
		cls.evaluator_user = cls._create_user(
			"rtv.cr.evaluator@example.com", "Eval", "Uator", ["Batch Evaluator"]
		)
		cls._create_evaluator("rtv.cr.evaluator@example.com")
		# _create_course() defaults instructor="frappe@example.com"; create it so the
		# course's instructor Link resolves on a fresh DB (mirrors TestLMSCourse.setUp).
		cls.instructor = cls._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"]
		)
		cls.course = cls._create_course()
		# A learner's request takes the course's evaluator; naming another is refused.
		frappe.db.set_value("LMS Course", cls.course.name, "evaluator", cls.evaluator_user.name)
		# A learner books an evaluation only for a course they are enrolled in.
		cls._create_enrollment(cls.student_a.name, cls.course.name)
		cls._create_enrollment(cls.student_b.name, cls.course.name)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _new_request(self, member=None, day_offset=3):
		doc = frappe.new_doc("LMS Certificate Request")
		doc.course = self.course.name
		doc.evaluator = self.evaluator_user.name
		# A future date, before the evaluator's unavailable window (nowdate + 5..12).
		# Each test uses a distinct offset so `validate_slot` never couples them.
		doc.date = add_days(getdate(), day_offset)
		doc.start_time = "10:00:00"
		doc.end_time = "10:30:00"
		if member is not None:
			doc.member = member
		return doc

	def _new_doc(self, member=None, variant=0):
		return self._new_request(member=member, day_offset=variant)


class TestEvaluationCalendarEvents(BaseTestUtils):
	"""Google is mocked: the invites go out from the Event's after-insert sync, so a
	request that loses its marker gets a second set of invites on the next run."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.student_a = cls._create_user("rtv.ce.student.a@example.com", "Student", "Alpha", ["LMS Student"])
		cls.student_b = cls._create_user("rtv.ce.student.b@example.com", "Student", "Bravo", ["LMS Student"])
		cls.evaluator_user = cls._create_user(
			"rtv.ce.evaluator@example.com", "Eval", "Uator", ["Batch Evaluator"]
		)
		cls._create_evaluator(cls.evaluator_user.name)
		cls._create_user("frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"])
		cls.course = cls._create_course(title="Calendar Event Course")
		frappe.db.set_value("LMS Course", cls.course.name, "evaluator", cls.evaluator_user.name)

		google_settings = frappe.get_doc("Google Settings")
		google_settings.update({"enable": 1, "client_id": "test-client-id", "client_secret": "test-secret"})
		google_settings.save()
		cls.calendar = frappe.get_doc(
			{
				"doctype": "Google Calendar",
				"calendar_name": f"Eval GCal {frappe.generate_hash(length=6)}",
				"user": cls.evaluator_user.name,
				"enable": 1,
			}
		).insert()
		frappe.db.set_single_value("LMS Settings", "send_calendar_invite_for_evaluations", 1)

	def setUp(self):
		super().setUp()
		self.google = MagicMock()
		self.google.events.return_value.insert.side_effect = self._google_insert
		self.google.events.return_value.get.return_value.execute.return_value = {"id": "gcal-1"}
		self.fail_for = None
		for patcher in (
			patch(
				f"{GOOGLE_CALENDAR_MODULE}.get_google_calendar_object",
				return_value=(self.google, MagicMock()),
			),
			patch.object(frappe.db, "commit"),
		):
			patcher.start()
			self.addCleanup(patcher.stop)

	def _google_insert(self, **kwargs):
		if self.fail_for and self.fail_for in kwargs["body"]["summary"]:
			raise Exception("Google is down")
		# No hangoutLink: the meet link is not a marker the scheduler can rely on.
		return MagicMock(execute=MagicMock(return_value={"id": "gcal-1"}))

	def _request(self, member, day_offset):
		doc = frappe.new_doc("LMS Certificate Request")
		doc.update(
			{
				"course": self.course.name,
				"member": member,
				"date": add_days(getdate(), day_offset),
				"start_time": "10:00:00",
				"end_time": "10:30:00",
				"status": "Upcoming",
			}
		)
		return doc.insert()

	def _google_inserts_for(self, member):
		name = frappe.db.get_value("User", member, "full_name")
		return [
			c
			for c in self.google.events.return_value.insert.call_args_list
			if name in c.kwargs["body"]["summary"]
		]

	def test_running_twice_creates_one_event_and_one_invite(self):
		"""Regression: schedule_evals (#562) used google_meet_link as its only done marker.
		Added for audit finding #49."""
		request = self._request(self.student_a.name, 1)

		schedule_evals()
		schedule_evals()

		event = frappe.db.get_value(request.doctype, request.name, "event")
		self.assertTrue(event)
		self.assertEqual(frappe.db.count("Event", {"subject": f"Evaluation of {request.member_name}"}), 1)
		self.assertEqual(len(self._google_inserts_for(self.student_a.name)), 1)

	def test_a_failing_request_does_not_undo_an_earlier_one(self):
		"""Regression: one failure rolled back every marker in the run (#562).
		Added for audit finding #49."""
		first = self._request(self.student_a.name, 1)
		second = self._request(self.student_b.name, 2)

		self.fail_for = second.member_name
		schedule_evals()
		self.assertTrue(frappe.db.get_value(first.doctype, first.name, "event"))
		self.assertFalse(frappe.db.get_value(second.doctype, second.name, "event"))

		self.fail_for = None
		schedule_evals()
		self.assertEqual(len(self._google_inserts_for(self.student_a.name)), 1)
		self.assertTrue(frappe.db.get_value(second.doctype, second.name, "event"))

	def test_google_event_is_cancelled_when_the_request_cannot_record_it(self):
		"""Regression from #562: a failure after Google's insert left a meeting nothing pointed at.
		Added for audit finding #49."""
		request = self._request(self.student_a.name, 1)
		frappe.db.commit.side_effect = frappe.QueryDeadlockError

		schedule_evals()

		update = self.google.events.return_value.update
		update.assert_called_once()
		self.assertEqual(update.call_args.kwargs["body"]["status"], "cancelled")
		self.assertFalse(frappe.db.get_value(request.doctype, request.name, "event"))

	def test_a_request_scheduled_before_events_were_recorded_gets_no_second_invite(self):
		"""Requests scheduled before the Event was recorded carry only their Meet link,
		and setup_calendar_event would have booked them again."""
		request = self._request(self.student_a.name, 1)
		request.db_set("google_meet_link", "https://meet.google.com/old-link")

		setup_calendar_event(request.name)

		self.assertFalse(frappe.db.get_value(request.doctype, request.name, "event"))
		self.assertEqual(self._google_inserts_for(self.student_a.name), [])

	def test_generating_a_link_for_an_event_without_one_says_why_nothing_happens(self):
		request = self._request(self.student_a.name, 1)
		schedule_evals()
		event = frappe.db.get_value(request.doctype, request.name, "event")
		self.assertFalse(frappe.db.get_value(request.doctype, request.name, "google_meet_link"))

		frappe.clear_messages()
		setup_calendar_event(request.name)

		self.assertIn(event, frappe.message_log[-1]["message"])
		self.assertEqual(len(self._google_inserts_for(self.student_a.name)), 1)

	def test_a_calendar_that_does_not_push_to_google_leaves_the_request_unscheduled(self):
		"""Frappe sends nothing to Google with pushing off, so recording the Event would
		mark the request scheduled with no invite, and no later run would retry it."""
		request = self._request(self.student_a.name, 1)
		frappe.db.set_value("Google Calendar", self.calendar.name, "push_to_google_calendar", 0)
		self.addCleanup(
			frappe.db.set_value, "Google Calendar", self.calendar.name, "push_to_google_calendar", 1
		)

		schedule_evals()

		self.assertFalse(frappe.db.get_value(request.doctype, request.name, "event"))
		self.assertIn(request.name, get_unscheduled_evaluations())
