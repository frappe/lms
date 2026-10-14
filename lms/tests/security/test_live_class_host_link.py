# Copyright (c) 2026, Frappe and Contributors
# See license.txt

import frappe
import frappe.client
from frappe.utils import add_days, nowdate

from lms.lms.api import get_my_live_classes, start_live_class
from lms.lms.test_helpers import BaseTestUtils

START_URL = "https://zoom.us/s/123?zak=host-only"
JOIN_URL = "https://zoom.us/j/123"


class TestLiveClassHostLink(BaseTestUtils):
	"""A live class's start link opens it as its host. Learners get the join link;
	the start link is for the staff who run the class."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.instructor = cls._create_user(
			f"lhinst-{hash}@example.com", "Ian", "Instructor", ["Course Creator"]
		)
		cls.moderator = cls._create_user(f"lhmod-{hash}@example.com", "Mo", "Derator", ["Moderator"])
		cls.student = cls._create_user(f"lhlrn-{hash}@example.com", "Lee", "Learner", ["LMS Student"])
		# Creates courses of their own, and learns in a batch someone else teaches.
		cls.creator = cls._create_user(
			f"lhcre-{hash}@example.com", "Cora", "Creator", ["LMS Student", "Course Creator"]
		)

		cls.batch = frappe.get_doc(
			{
				"doctype": "LMS Batch",
				"title": f"Host Link Batch {hash}",
				"start_date": nowdate(),
				"end_date": add_days(nowdate(), 30),
				"start_time": "09:00:00",
				"end_time": "11:00:00",
				"timezone": "Asia/Kolkata",
				"description": "Host link batch",
				"batch_details": "Host link batch",
				"published": 1,
				"instructors": [{"instructor": cls.instructor.name}],
			}
		).insert(ignore_permissions=True)
		cls._create_batch_enrollment(cls.student.name, cls.batch.name)
		cls._create_batch_enrollment(cls.creator.name, cls.batch.name)

		# Stored as Zoom returns it; the calendar and Zoom calls are beside the point.
		live_class = frappe.get_doc(
			{
				"doctype": "LMS Live Class",
				"title": f"Host Link Class {hash}",
				"batch_name": cls.batch.name,
				"host": cls.instructor.name,
				"date": add_days(nowdate(), 1),
				"time": "10:00:00",
				"duration": 60,
				"timezone": "Asia/Kolkata",
				"conferencing_provider": "Zoom",
				"start_url": START_URL,
				"join_url": JOIN_URL,
			}
		)
		live_class.db_insert()
		cls.live_class = live_class.name

	def _document_as(self, user):
		frappe.set_user(user.name)
		return frappe.client.get("LMS Live Class", self.live_class)

	def test_a_learner_gets_the_join_link_not_the_start_link(self):
		frappe.set_user(self.student.name)
		classes = [c for c in get_my_live_classes() if c.name == self.live_class]

		self.assertEqual(len(classes), 1)
		self.assertEqual(classes[0].join_url, JOIN_URL)
		self.assertIsNone(classes[0].start_url)

	def test_a_learner_does_not_read_the_start_link_from_the_class(self):
		document = self._document_as(self.student)
		self.assertEqual(document.get("join_url"), JOIN_URL)
		self.assertNotIn(START_URL, str(document))

	def test_a_learner_does_not_list_the_start_link(self):
		# The batch page asks for start_url in its list, so the list must still load.
		frappe.set_user(self.student.name)
		rows = frappe.get_list(
			"LMS Live Class", filters={"name": self.live_class}, fields=["name", "start_url"]
		)
		self.assertEqual([row.name for row in rows], [self.live_class])
		self.assertNotIn(START_URL, str(rows))

	def test_a_learner_who_creates_courses_gets_only_the_join_link(self):
		self.assertNotIn(START_URL, str(self._document_as(self.creator)))

		classes = [c for c in get_my_live_classes() if c.name == self.live_class]
		self.assertIsNone(classes[0].start_url)

	def test_only_the_batch_staff_start_the_class(self):
		for user in (self.student, self.creator):
			with self.subTest(user=user.name):
				frappe.set_user(user.name)
				self.assertRaises(frappe.PermissionError, start_live_class, self.live_class)

	def test_the_batch_instructor_starts_the_class_as_its_host(self):
		frappe.set_user(self.instructor.name)
		start_live_class(self.live_class)

		self.assertEqual(frappe.local.response["type"], "redirect")
		self.assertEqual(frappe.local.response["location"], START_URL)

	def test_a_moderator_reads_the_start_link(self):
		self.assertEqual(self._document_as(self.moderator).get("start_url"), START_URL)
