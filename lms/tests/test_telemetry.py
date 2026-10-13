from unittest.mock import patch

import frappe

from lms.lms import telemetry
from lms.lms.test_helpers import BaseTestUtils


class TestTelemetry(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.instructor = cls._create_user(
			f"telemetry-instructor-{frappe.generate_hash(length=8)}@example.com",
			"Telemetry",
			"Instructor",
			["Course Creator"],
		)
		cls.learner = cls._create_user(
			f"telemetry-learner-{frappe.generate_hash(length=8)}@example.com",
			"Telemetry",
			"Learner",
			["LMS Student"],
		)

	def setUp(self):
		super().setUp()
		capture = patch("lms.lms.telemetry.capture")
		self.capture = capture.start()
		self.addCleanup(capture.stop)
		enabled = patch("lms.lms.telemetry.pulse_enabled", return_value=True)
		enabled.start()
		self.addCleanup(enabled.stop)

	def _events(self):
		return [c.args[0] for c in self.capture.call_args_list]

	def _first(self, event):
		return [
			c.kwargs["properties"].get("is_first") for c in self.capture.call_args_list if c.args[0] == event
		]

	def _course(self, title=None, published=0):
		course = frappe.new_doc("LMS Course")
		course.update(
			{
				"title": title or f"Telemetry Course {frappe.generate_hash(length=8)}",
				"short_introduction": "A course for telemetry tests",
				"description": "A course for telemetry tests",
				"published": published,
				"instructors": [{"instructor": self.instructor.name}],
			}
		)
		return course.insert()

	def test_a_course_is_followed_from_draft_to_unpublished(self):
		course = self._course()
		self.assertEqual(self._events(), ["course_created"])

		course.published = 1
		course.save()
		# Saved again while published: not a second publish.
		course.short_introduction = "Edited"
		course.save()
		course.published = 0
		course.save()

		self.assertEqual(self._events(), ["course_created", "course_published", "course_unpublished"])

	def test_a_course_created_published_counts_as_published(self):
		self._course(published=1)
		self.assertEqual(self._events(), ["course_created", "course_published"])

	def test_course_content_and_learners_are_followed(self):
		course = self._course(published=1)
		chapter = self._create_chapter(None, course.name)
		self._create_lesson(f"Lesson {frappe.generate_hash(length=6)}", chapter.name, course.name)
		self._create_enrollment(self.learner.name, course.name)

		self.assertEqual(
			self._events(),
			["course_created", "course_published", "chapter_created", "lesson_created", "enrolled_in_course"],
		)

	def test_the_demo_course_and_its_content_are_not_sent(self):
		course = self._course(title=telemetry.DEMO_COURSE_TITLE, published=1)
		chapter = self._create_chapter(None, course.name)
		self._create_lesson(f"Lesson {frappe.generate_hash(length=6)}", chapter.name, course.name)
		self._create_enrollment(self.learner.name, course.name)

		self.assertEqual(self._events(), [])

	def test_nothing_is_sent_while_the_demo_is_created(self):
		frappe.flags.in_lms_demo = True
		self.addCleanup(setattr, frappe.flags, "in_lms_demo", False)

		self._course(published=1)

		self.assertEqual(self._events(), [])

	def test_is_first_says_whether_the_site_has_another(self):
		course = self._course()
		other = self._course()

		telemetry.send("probe", course, {"title": course.title})
		telemetry.send("probe", course, {"title": ["in", [course.title, other.title]]})

		self.assertEqual(self._first("probe"), [True, False])

	def test_publishing_again_is_not_a_second_first(self):
		frappe.db.set_value("LMS Course", {"published_on": ["is", "set"]}, "published_on", None)
		course = self._course()
		course.published = 1
		course.save()
		course.published = 0
		course.save()
		course.published = 1
		course.save()

		self.assertEqual(self._first("course_published"), [True, False])

	def test_nothing_is_sent_when_pulse_is_off(self):
		with patch("lms.lms.telemetry.pulse_enabled", return_value=False):
			self._course(published=1)
		self.assertEqual(self._events(), [])

	def test_a_received_payment_is_sent(self):
		payment = frappe.get_doc(
			{
				"doctype": "LMS Payment",
				"member": self.learner.name,
				"billing_name": "Telemetry Learner",
				"payment_for_document_type": "LMS Course",
				"payment_for_document": self._course().name,
				"amount": 100,
				"currency": "INR",
			}
		).insert(ignore_permissions=True, ignore_mandatory=True)

		telemetry.payment_received(payment.name)

		call = self.capture.call_args_list[-1]
		self.assertEqual(call.args[0], "payment_received")
		self.assertEqual(call.kwargs["properties"]["payment_for"], "LMS Course")

	def test_changing_the_payment_gateway_is_not_a_second_setup(self):
		settings = frappe.get_single("LMS Settings")
		settings.payment_gateway = None
		settings.save(ignore_permissions=True)
		gateway = frappe.new_doc("LMS Settings")
		gateway.payment_gateway = "Razorpay"
		with patch.object(gateway, "get_doc_before_save", return_value=settings):
			telemetry.payment_gateway_saved(gateway)
		switched = frappe.new_doc("LMS Settings")
		switched.payment_gateway = "Stripe"
		with patch.object(switched, "get_doc_before_save", return_value=gateway):
			telemetry.payment_gateway_saved(switched)

		self.assertEqual(self._events().count("payment_gateway_configured"), 1)

	def test_no_title_or_name_is_sent(self):
		course = self._course(published=1)
		sent = str(self.capture.call_args_list)
		self.assertNotIn(course.title, sent)
		self.assertNotIn(course.name, sent)
