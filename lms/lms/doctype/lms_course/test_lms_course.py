# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import unittest
from unittest.mock import patch

import frappe

from lms.lms.test_helpers import BaseTestUtils


class TestLMSCourse(unittest.TestCase):
	def test_video_link_stored_as_entered(self):
		# validate_video_link is a no-op by design: reducing a URL to a bare id mangled
		# uploaded /files paths and broke some YouTube urls. Calling it on an unsaved
		# doc proves the contract without five save() round-trips.
		course = frappe.new_doc("LMS Course")
		for link in (
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			"https://www.youtube.com/embed/-LPmw2Znl2c",
			"https://youtu.be/dQw4w9WgXcQ",
			"/files/VID-20200313-WA0046.mp4",
			"/private/files/intro.mp4",
		):
			course.video_link = link
			course.validate_video_link()
			self.assertEqual(course.video_link, link)


def _new_course(instructors):
	return frappe.get_doc(
		{
			"doctype": "LMS Course",
			"title": f"Course {frappe.generate_hash(length=8)}",
			"short_introduction": "Course for duplicate instructor tests",
			"description": "Course for duplicate instructor tests",
			"instructors": [{"instructor": instructor} for instructor in instructors],
		}
	)


class TestLMSCourseInstructors(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.instructor = cls._create_user(
			f"course-instructor-{frappe.generate_hash(length=8)}@example.com",
			"Chandru",
			"Course",
			["Course Creator"],
		)

	def test_single_instructor_is_accepted(self):
		course = _new_course([self.instructor.name]).insert()
		self.assertEqual([row.instructor for row in course.instructors], [self.instructor.name])

	def test_duplicate_instructor_rejected_on_insert(self):
		course = _new_course([self.instructor.name, self.instructor.name])
		with self.assertRaisesRegex(frappe.ValidationError, "Chandru Course"):
			course.insert()

	def test_duplicate_instructor_rejected_on_save(self):
		course = _new_course([self.instructor.name]).insert()
		course.append("instructors", {"instructor": self.instructor.name})
		with self.assertRaisesRegex(frappe.ValidationError, "Chandru Course"):
			course.save()

	def test_course_without_instructors_is_assigned_its_owner(self):
		# `instructors` is mandatory on LMS Course and validate_instructors() is
		# meant to fill it in with the owner when none is given. BaseTestUtils'
		# _create_course always supplies instructors, so this path had no coverage,
		# and it is the path the course ZIP importer takes, since
		# create_course_doc() only appends what the archive declares.
		course = frappe.new_doc("LMS Course")
		course.update(
			{
				"title": f"Test Course {frappe.generate_hash()}",
				"short_introduction": "Created without an instructor",
				"description": "The owner must be assigned as instructor automatically.",
			}
		)
		course.insert()

		self.assertEqual([row.instructor for row in course.instructors], [course.owner])

		# and it must be persisted, not only present on the in-memory document
		course.reload()
		self.assertEqual([row.instructor for row in course.instructors], [course.owner])


class TestPublishWarnsAboutEmptyQuizzes(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.course = _new_course(["Administrator"]).insert()
		chapter = self._create_chapter("Publish Warning Chapter", self.course.name)
		self.quiz = self._create_quiz([], title=f"Unfilled Quiz {frappe.generate_hash(length=6)}")
		content = frappe.as_json({"blocks": [{"type": "quiz", "data": {"quiz": self.quiz.name}}]})
		self._create_lesson("Publish Warning Lesson", chapter.name, self.course.name, content)
		self.course.reload()
		frappe.clear_messages()

	def _publish(self):
		self.course.published = 1
		self.course.save()

	def test_publishing_lists_quizzes_without_questions(self):
		self._publish()

		self.assertEqual(self.course.get_onload("quizzes_without_questions"), [self.quiz.title])
		self.assertIn(self.quiz.title, frappe.as_json(frappe.message_log))

	def test_saving_an_already_published_course_does_not_warn_again(self):
		self._publish()
		frappe.clear_messages()
		self.course.reload()
		self.course.description = "Edited after publishing"
		self.course.save()

		self.assertEqual(frappe.message_log, [])


class TestCourseLaunchEmail(BaseTestUtils):
	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6)
		instructor = self._create_user(f"launch-{hash}@example.com", "Lia", "Instr", ["Course Creator"])
		self.notified = self._create_user(f"notified-{hash}@example.com", "Nia", "Old", ["LMS Student"])
		self.waiting = self._create_user(f"waiting-{hash}@example.com", "Wes", "New", ["LMS Student"])
		self.course = self._create_course(title=f"Launch Course {hash}", instructor=instructor.email)
		self.course.db_set("upcoming", 1)
		self.course.reload()
		for user, sent in ((self.notified, 1), (self.waiting, 0)):
			frappe.get_doc(
				{
					"doctype": "LMS Course Interest",
					"course": self.course.name,
					"user": user.name,
					"email_sent": sent,
				}
			).insert()

	def test_launch_emails_only_users_not_yet_notified(self):
		"""Every launch re-mailed all interested users since #170 (email_sent was never read).
		Added for audit finding #93."""
		with patch("frappe.sendmail") as sendmail:
			self.course.upcoming = 0
			self.course.save()

		recipients = [call.kwargs["recipients"] for call in sendmail.call_args_list]
		self.assertEqual(recipients, [self.waiting.name])

	def test_a_rolled_back_launch_leaves_users_unmarked(self):
		"""The email is queued inside the save's transaction, not after it, so it rolls
		back with email_sent and the next launch emails the user."""
		frappe.db.savepoint("launch")
		with patch("frappe.sendmail") as sendmail:
			self.course.upcoming = 0
			self.course.save()
		self.assertEqual([call.kwargs["recipients"] for call in sendmail.call_args_list], [self.waiting.name])

		frappe.db.rollback(save_point="launch")

		self.assertEqual(self._email_sent(self.waiting), 0)

	def test_launch_without_an_outgoing_email_account_saves(self):
		# Asserted on the call, not the row: Error Log is not a database table on every
		# frappe version.
		with (
			patch("frappe.sendmail", side_effect=frappe.OutgoingEmailError),
			patch("frappe.log_error", wraps=frappe.log_error) as log_error,
		):
			self.course.upcoming = 0
			self.course.save()

		self.assertEqual(frappe.db.get_value("LMS Course", self.course.name, "upcoming"), 0)
		self.assertEqual(self._email_sent(self.waiting), 0)
		log_error.assert_called_once()
		self.assertEqual(log_error.call_args.kwargs.get("reference_name"), self.course.name)

	def _email_sent(self, user):
		return frappe.db.get_value(
			"LMS Course Interest", {"course": self.course.name, "user": user.name}, "email_sent"
		)

	def test_each_launch_email_greets_its_own_user(self):
		second = self._create_user(
			f"second-{frappe.generate_hash(length=6)}@example.com", "Sam", "Second", ["LMS Student"]
		)
		frappe.get_doc(
			{"doctype": "LMS Course Interest", "course": self.course.name, "user": second.name}
		).insert()

		with patch("frappe.sendmail") as sendmail:
			self.course.upcoming = 0
			self.course.save()

		greetings = {
			call.kwargs["recipients"]: call.kwargs["args"]["first_name"] for call in sendmail.call_args_list
		}
		self.assertEqual(greetings, {self.waiting.name: "Wes", second.name: "Sam"})
