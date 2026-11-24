# Copyright (c) 2026, Frappe and Contributors
# See license.txt

from unittest.mock import patch

import frappe

from lms.demo.demo_data import DEMO_BATCH_TITLE, create_demo_data
from lms.lms.api import clear_demo_data
from lms.lms.test_helpers import BaseTestUtils

DEMO_INSTRUCTOR = "jannat@example.com"


class TestDemoData(BaseTestUtils):
	def setUp(self):
		super().setUp()
		clear_demo_data()
		self.real_user = self._create_user("real.user@example.com", "Real", "User", ["LMS Student"])
		self.real_user.db_set("user_image", "/files/real.png")

	def test_demo_data_leaves_existing_users_alone(self):
		"""create_instructor reused an arbitrary real user, set their photo and made them
		Moderator; clear_demo_data undid neither. Guards that a real user is untouched."""
		create_demo_data()

		self.assertEqual(frappe.db.get_value("User", self.real_user.name, "user_image"), "/files/real.png")
		self.assertNotIn("Moderator", frappe.get_roles(self.real_user.name))
		course = frappe.db.get_value("LMS Course", {"title": "A guide to Frappe Learning"})
		instructors = frappe.get_all("Course Instructor", {"parent": course}, pluck="instructor")
		self.assertEqual(instructors, [DEMO_INSTRUCTOR])

	def test_clear_demo_data_removes_the_demo_instructor(self):
		"""The instructor demo data creates must be one clear_demo_data deletes."""
		create_demo_data()
		self.assertTrue(frappe.db.exists("User", DEMO_INSTRUCTOR))
		clear_demo_data()

		self.assertFalse(frappe.db.exists("User", DEMO_INSTRUCTOR))
		self.assertTrue(frappe.db.exists("User", self.real_user.name))

	def test_demo_data_includes_a_published_batch_for_the_demo_course(self):
		"""Setup lands an owner on Batches when they start by onboarding learners; a new site
		should show the sample batch there, as it shows the sample course on Courses."""
		create_demo_data()

		batch = frappe.get_doc("LMS Batch", {"title": DEMO_BATCH_TITLE})
		self.assertTrue(batch.published)
		self.assertTrue(batch.notification_sent)
		self.assertGreaterEqual(str(batch.end_date), frappe.utils.today())
		course = frappe.db.get_value("LMS Course", {"title": "A guide to Frappe Learning"})
		self.assertEqual([row.course for row in batch.courses], [course])
		self.assertEqual(frappe.db.count("LMS Batch Enrollment", {"batch": batch.name}), 3)

	def test_clear_demo_data_removes_the_demo_batch(self):
		create_demo_data()
		clear_demo_data()

		self.assertFalse(frappe.db.exists("LMS Batch", {"title": DEMO_BATCH_TITLE}))

	def test_setup_can_run_again_on_a_site_that_kept_its_sample_course(self):
		"""A site set up again kept the sample course and its review; the second run
		failed on that review and left the owner's login going on as the sample learner."""
		create_demo_data()
		user = frappe.session.user

		with patch("frappe.log_error") as log_error:
			create_demo_data()

		log_error.assert_not_called()
		self.assertEqual(frappe.session.user, user)
		course = frappe.db.get_value("LMS Course", {"title": "A guide to Frappe Learning"})
		self.assertEqual(frappe.db.count("LMS Course Review", {"course": course}), 1)

	def test_a_failed_demo_leaves_the_request_as_the_user_who_ran_it(self):
		def fails_as_the_learner(course, student):
			frappe.session.user = student.name
			raise frappe.ValidationError

		user = frappe.session.user
		with (
			patch("lms.demo.demo_data.create_reviews", side_effect=fails_as_the_learner),
			patch("frappe.log_error"),
		):
			create_demo_data()
		self.assertEqual(frappe.session.user, user)
