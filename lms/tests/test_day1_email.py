"""The day-1 email reaches a new Frappe Cloud trial admin once, with the one next step
for where they stopped, and stays away from everyone else."""

from datetime import timedelta
from unittest.mock import patch

import frappe
from frappe.utils import now_datetime

from lms.lms.day1_email import SENT_KEY, Day1Email, first_admin, send_day1_email
from lms.lms.test_helpers import BaseTestUtils

MODULE = "lms.lms.day1_email"
ON_FC = {"fc_communication_secret": "secret"}


def admin_row(hours_old=24, quiet_hours=None, email="day1-admin@example.com"):
	last_active = None if quiet_hours is None else now_datetime() - timedelta(hours=quiet_hours)
	return frappe._dict(
		name=email,
		first_name="Asha",
		creation=now_datetime() - timedelta(hours=hours_old),
		last_active=last_active,
	)


def trial(is_trial=True):
	return {"plan": {"is_trial_plan": is_trial}}


class TestSendDay1Email(BaseTestUtils):
	def setUp(self):
		super().setUp()
		frappe.db.set_default(SENT_KEY, None)

	def run_job(self, admin=None, site_info=None, conf=ON_FC, step=None):
		admin = admin or admin_row()
		step = step or {"key": "create_course", "subject": "s", "message": "m", "action": "a", "link": "l"}
		with (
			patch.dict(frappe.conf, conf),
			patch(f"{MODULE}.first_admin", return_value=admin),
			patch(
				"frappe.integrations.frappe_providers.frappecloud_billing.current_site_info",
				return_value=site_info if site_info is not None else trial(),
			),
			patch.object(Day1Email, "next_step", return_value=step),
			patch("frappe.sendmail") as sendmail,
		):
			send_day1_email()
		return sendmail

	def test_new_trial_admin_gets_the_email_once(self):
		sendmail = self.run_job()
		sendmail.assert_called_once()
		self.assertEqual(sendmail.call_args.kwargs["reply_to"], "jannat@frappe.io")
		self.assertEqual(sendmail.call_args.kwargs["recipients"], "day1-admin@example.com")
		self.run_job().assert_not_called()

	def test_self_hosted_site_is_skipped(self):
		self.run_job(conf={"fc_communication_secret": None}).assert_not_called()

	def test_paying_site_is_skipped_and_checked_again_later(self):
		self.run_job(site_info=trial(False)).assert_not_called()
		self.assertFalse(frappe.db.get_default(SENT_KEY))

	def test_unanswered_frappe_cloud_call_waits_for_the_next_hour(self):
		self.run_job(site_info={}).assert_not_called()
		self.assertFalse(frappe.db.get_default(SENT_KEY))

	def test_failing_frappe_cloud_call_never_sends(self):
		with (
			patch.dict(frappe.conf, ON_FC),
			patch(f"{MODULE}.first_admin", return_value=admin_row()),
			patch(
				"frappe.integrations.frappe_providers.frappecloud_billing.current_site_info",
				side_effect=Exception("timeout"),
			),
			patch("frappe.sendmail") as sendmail,
		):
			send_day1_email()
		sendmail.assert_not_called()

	def test_admin_active_in_the_last_12_hours_is_left_alone(self):
		self.run_job(admin=admin_row(quiet_hours=2)).assert_not_called()

	def test_admin_quiet_for_12_hours_gets_it(self):
		self.run_job(admin=admin_row(quiet_hours=13)).assert_called_once()

	def test_too_early_waits(self):
		self.run_job(admin=admin_row(hours_old=5)).assert_not_called()
		self.assertFalse(frappe.db.get_default(SENT_KEY))

	def test_after_two_days_it_stops_checking(self):
		self.run_job(admin=admin_row(hours_old=60)).assert_not_called()
		self.assertEqual(frappe.db.get_default(SENT_KEY), "skipped")

	def test_site_with_learners_gets_no_email_and_is_marked_done(self):
		with (
			patch.dict(frappe.conf, ON_FC),
			patch(f"{MODULE}.first_admin", return_value=admin_row()),
			patch(f"{MODULE}.on_trial", return_value=True),
			patch.object(Day1Email, "next_step", return_value=None),
			patch("frappe.sendmail") as sendmail,
		):
			send_day1_email()
		sendmail.assert_not_called()
		self.assertTrue(frappe.db.get_default(SENT_KEY))


class TestNextStep(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.instructor = cls._create_user(
			"day1-instructor@example.com", "Day", "One", ["Course Creator"], "System User"
		)

	def email_for(self, *courses):
		email = Day1Email.__new__(Day1Email)
		email.admin = admin_row()
		email.courses = [
			frappe._dict(
				name=c.name, title=c.title, published=frappe.db.get_value("LMS Course", c.name, "published")
			)
			for c in courses
		]
		return email.next_step()

	def new_course(self, title, published=0):
		course = self._create_course(title, self.instructor.name)
		frappe.db.set_value("LMS Course", course.name, "published", published)
		return course

	def test_no_course_of_their_own_means_create_one(self):
		step = self.email_for()
		self.assertEqual(step["key"], "create_course")
		self.assertTrue(step["link"].endswith("/courses/new"))

	def test_course_without_lessons_means_add_a_lesson(self):
		course = self.new_course("Day1 Empty Course")
		step = self.email_for(course)
		self.assertEqual(step["key"], "add_lesson")
		self.assertTrue(step["link"].endswith(f"/courses/{course.name}#editor"))

	def test_unpublished_course_with_lessons_means_publish(self):
		course = self.new_course("Day1 Draft Course")
		chapter = self._create_chapter("Day1 Chapter", course.name)
		self._create_lesson("Day1 Lesson", chapter.name, course.name)
		self.assertEqual(self.email_for(course)["key"], "publish_course")

	def test_published_course_without_learners_means_add_learners(self):
		course = self.new_course("Day1 Live Course", published=1)
		chapter = self._create_chapter("Day1 Live Chapter", course.name)
		self._create_lesson("Day1 Live Lesson", chapter.name, course.name)
		step = self.email_for(course)
		self.assertEqual(step["key"], "add_learners")
		self.assertTrue(step["link"].endswith("#dashboard"))

	def test_course_with_learners_means_no_email(self):
		course = self.new_course("Day1 Busy Course", published=1)
		learner = self._create_user("day1-learner@example.com", "Day", "Learner", ["LMS Student"])
		self._create_enrollment(learner.name, course.name)
		self.assertIsNone(self.email_for(course))


class TestFirstAdmin(BaseTestUtils):
	def test_oldest_real_system_manager_is_picked(self):
		user = self._create_user(
			"day1-first-admin@example.com", "First", "Admin", ["System Manager"], "System User"
		)
		frappe.db.set_value("User", user.name, "creation", "2000-01-01 00:00:00", update_modified=False)
		self.assertEqual(first_admin().name, user.name)

	def test_administrator_is_never_picked(self):
		# first_admin reads whoever is on the site; arrange our own admin so this
		# does not depend on state leaked by whichever modules discovery (unsorted
		# os.walk order) happened to run first.
		self._create_user("day1-real-admin@example.com", "Real", "Admin", ["System Manager"], "System User")
		admin = first_admin()
		self.assertIsNotNone(admin)
		self.assertNotEqual(admin.name, "Administrator")
