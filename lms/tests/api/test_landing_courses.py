import frappe

from lms.lms.api import get_landing_courses
from lms.lms.test_helpers import BaseTestUtils


class TestGetLandingCourses(BaseTestUtils):
	def setUp(self):
		super().setUp()
		# The landing page is for guests, so the test needs guest access on whatever the site says.
		frappe.db.set_single_value("LMS Settings", "allow_guest_access", 1)

	def _course(self, title, published=1):
		course = self._create_course(title=title, instructor="Administrator")
		frappe.db.set_value("LMS Course", course.name, "published", published)
		return course

	def _batch(self, title, course, medium, published=1):
		evaluator = self._create_evaluator("Administrator")
		batch = self._create_batch(
			course.name, instructor="Administrator", title=title, evaluator=evaluator.name
		)
		frappe.db.set_value("LMS Batch", batch.name, {"medium": medium, "published": published})
		return batch

	def _by_name(self):
		# Records are made as Administrator; the endpoint is read as a guest.
		frappe.set_user("Guest")
		try:
			courses = get_landing_courses(limit=50)
		finally:
			frappe.set_user("Administrator")
		return {c["name"]: c for c in courses}

	def test_course_taught_by_an_offline_batch_is_labelled_offline(self):
		course = self._course("Landing Offline Maths")
		self._batch("Landing Maths Batch A", course, "Offline")

		self.assertEqual(self._by_name()[course.name]["delivery"], "offline")

	def test_course_without_an_offline_batch_is_labelled_online(self):
		course = self._course("Landing Self Paced Physics")

		self.assertEqual(self._by_name()[course.name]["delivery"], "online")

	def test_unpublished_courses_are_not_returned(self):
		hidden = self._course("Landing Hidden Course", published=0)

		self.assertNotIn(hidden.name, self._by_name())

	def test_an_unpublished_offline_batch_does_not_make_its_course_offline(self):
		course = self._course("Landing Draft Batch Course")
		self._batch("Landing Draft Batch", course, "Offline", published=0)

		self.assertEqual(self._by_name()[course.name]["delivery"], "online")
