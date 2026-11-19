# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""The course dashboard endpoints: who may call them, what they accept, and the bugs they once had."""

from unittest.mock import patch

import frappe
from frappe.utils import add_days, now_datetime

from lms.lms.dashboard.course import (
	export_course_analytics,
	get_course_analytics_preview,
	get_course_analytics_report,
	get_course_assessment_stats,
	get_course_dashboard_stats,
	get_course_review_list,
	get_course_student_detail,
	get_course_students,
	issue_course_certificate,
	send_course_reminder,
)
from lms.lms.doctype.lms_certificate.lms_certificate import create_certificate
from lms.lms.doctype.lms_course_review.lms_course_review import course_review_summary
from lms.lms.test_helpers import BaseTestUtils

# The whitelist's own type check answers a wrong type first; the endpoint's guard answers when it is off.
REJECTED = (frappe.ValidationError, frappe.FrappeTypeError)


class TestCourseDashboardAPI(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.hash = hash
		cls.author = cls._create_user(f"cd-auth-{hash}@example.com", "Au", "Thor", ["Course Creator"]).name
		cls.other_creator = cls._create_user(
			f"cd-other-{hash}@example.com", "Ot", "Her", ["Course Creator"]
		).name
		cls._require_no_moderators(cls.author, cls.other_creator)

		cls.course = cls._create_course(title=f"Dashboard Course {hash}", instructor=cls.author).name
		frappe.db.set_value("LMS Course", cls.course, "enable_certification", 1)
		chapter = cls._create_chapter(f"Chapter {hash}", cls.course).name
		cls._create_chapter_reference(cls.course, chapter)
		cls.lessons = []
		for number in range(3):
			lesson = cls._create_lesson(f"Lesson {number} {hash}", chapter, cls.course).name
			cls._create_lesson_reference(chapter, lesson)
			cls.lessons.append(lesson)

		cls.not_started = cls._student("none")
		cls.in_progress = cls._student("part", lessons=1)
		cls.completed = cls._student("done", lessons=3)

	@classmethod
	def _student(cls, tag, lessons=0):
		student = cls._create_user(
			f"cd-{tag}-{cls.hash}@example.com", "Stu", f"{tag.title()} {cls.hash}", ["LMS Student"]
		).name
		cls._create_enrollment(student, cls.course)
		for lesson in cls.lessons[:lessons]:
			cls._create_progress(student, cls.course, lesson)
		return student

	def _seed(self, doctype, at=None, **fields):
		"""Write the row as stored, skipping the controller."""
		doc = frappe.new_doc(doctype)
		doc.update(fields)
		doc.name = fields.get("name") or frappe.generate_hash(length=12)
		doc.creation = doc.modified = at or now_datetime()
		doc.owner = doc.modified_by = "Administrator"
		doc.db_insert()
		return doc.name

	def _enrollment(self, member):
		return frappe.db.get_value("LMS Enrollment", {"course": self.course, "member": member})

	def _clear_reminder(self, enrollment):
		key = frappe.cache.make_key(f"lms:progress_reminder:LMS Enrollment:{enrollment}")
		frappe.cache.delete(key)
		self.addCleanup(frappe.cache.delete, key)

	def test_non_staff_are_refused(self):
		enrollment = self._enrollment(self.completed)
		calls = {
			"get_course_dashboard_stats": lambda: get_course_dashboard_stats(self.course),
			"get_course_review_list": lambda: get_course_review_list(self.course),
			"get_course_assessment_stats": lambda: get_course_assessment_stats(self.course),
			"get_course_students": lambda: get_course_students(self.course),
			"get_course_student_detail": lambda: get_course_student_detail(self.course, enrollment),
			"export_course_analytics": lambda: export_course_analytics(self.course),
			"get_course_analytics_report": lambda: get_course_analytics_report(self.course),
			"get_course_analytics_preview": lambda: get_course_analytics_preview(self.course),
			"send_course_reminder": lambda: send_course_reminder(self.course, enrollment),
			"issue_course_certificate": lambda: issue_course_certificate(self.course, enrollment),
		}
		with patch("frappe.sendmail") as sendmail:
			for user in (self.other_creator, self.not_started, "Guest"):
				for name, call in calls.items():
					with self.subTest(user=user, endpoint=name), self.assertRaises(frappe.PermissionError):
						frappe.set_user(user)
						call()
		self.assertEqual(sendmail.call_count, 0)
		frappe.set_user(self.author)
		self.assertEqual(get_course_dashboard_stats(self.course)["enrolled"], 3)

	def test_wrong_argument_types_are_rejected(self):
		frappe.set_user(self.author)
		enrollment = self._enrollment(self.completed)
		bad = ["!=", ""]
		calls = {
			"get_course_dashboard_stats": lambda: get_course_dashboard_stats(bad),
			"get_course_review_list": lambda: get_course_review_list(bad),
			"get_course_assessment_stats": lambda: get_course_assessment_stats(bad),
			"get_course_students": lambda: get_course_students(self.course, page_length=[20]),
			"get_course_student_detail": lambda: get_course_student_detail(self.course, bad),
			"export_course_analytics": lambda: export_course_analytics(bad),
			"get_course_analytics_report": lambda: get_course_analytics_report(self.course, from_date=bad),
			"get_course_analytics_preview": lambda: get_course_analytics_preview(bad),
			"send_course_reminder": lambda: send_course_reminder(self.course, bad),
			"issue_course_certificate": lambda: issue_course_certificate(bad, enrollment),
		}
		with patch("frappe.sendmail") as sendmail:
			for name, call in calls.items():
				with self.subTest(endpoint=name), self.assertRaises(REJECTED):
					call()
		self.assertEqual(sendmail.call_count, 0)

	def test_issuing_refuses_a_student_who_already_claimed_the_certificate(self):
		frappe.set_user(self.completed)
		claimed = create_certificate(self.course)
		self.addCleanup(frappe.db.delete, "LMS Certificate", claimed.name)
		frappe.set_user(self.author)
		with self.assertRaises(frappe.ValidationError):
			issue_course_certificate(self.course, self._enrollment(self.completed))
		self.assertEqual(
			frappe.db.count("LMS Certificate", {"course": self.course, "member": self.completed}), 1
		)

	def test_a_course_without_certification_issues_no_certificate(self):
		frappe.db.set_value("LMS Course", self.course, "enable_certification", 0)
		frappe.set_user(self.author)
		with self.assertRaises(frappe.ValidationError):
			issue_course_certificate(self.course, self._enrollment(self.completed))
		self.assertFalse(
			frappe.db.exists("LMS Certificate", {"course": self.course, "member": self.completed})
		)

	def test_a_reminder_frees_its_slot_when_the_email_fails_and_then_waits_a_day(self):
		enrollment = self._enrollment(self.in_progress)
		self._clear_reminder(enrollment)
		frappe.set_user(self.author)
		with (
			patch("frappe.sendmail", side_effect=frappe.OutgoingEmailError),
			self.assertRaises(frappe.OutgoingEmailError),
		):
			send_course_reminder(self.course, enrollment)
		with patch("frappe.sendmail") as sendmail:
			send_course_reminder(self.course, enrollment)
			with self.assertRaises(frappe.ValidationError):
				send_course_reminder(self.course, enrollment)
		self.assertEqual(sendmail.call_count, 1)

	def test_review_summary_leaves_blank_ratings_out_of_the_average(self):
		# Stored as stars / 5; 0 is a rating left blank.
		for member, rating in ((self.in_progress, 0.8), (self.completed, 0), (self.not_started, 0.2)):
			self._add_rating(self.course, member, rating, "Review")
		summary = course_review_summary(self.course)
		self.assertEqual((summary["responses"], summary["low_responses"], summary["average"]), (3, 1, 2.5))

	def test_student_detail_lists_programming_exercises_with_the_latest_status(self):
		exercise = self._seed(
			"LMS Programming Exercise",
			name=f"pe-{self.hash}",
			title=f"Exercise {self.hash}",
			language="Python",
		)
		self._seed(
			"LMS Lesson Assessment",
			parent=self.lessons[2],
			parenttype="Course Lesson",
			parentfield="assessments",
			idx=1,
			assessment_type="LMS Programming Exercise",
			assessment_name=exercise,
		)
		for status, days in (("Failed", 2), ("Passed", 1)):
			self._seed(
				"LMS Programming Exercise Submission",
				at=add_days(now_datetime(), -days),
				exercise=exercise,
				member=self.in_progress,
				status=status,
			)
		for number, lesson in enumerate(self.lessons, start=1):
			frappe.db.set_value("Lesson Reference", {"lesson": lesson}, "idx", number)
		frappe.set_user(self.author)

		detail = get_course_student_detail(self.course, self._enrollment(self.in_progress))
		[row] = detail["chapters"][0]["lessons"][2]["assessments"]
		self.assertEqual(
			(row["type"], row["name"], row["status"], row["attempts"]), ("exercise", exercise, "passed", 1)
		)
		untried = get_course_student_detail(self.course, self._enrollment(self.completed))
		self.assertEqual(untried["chapters"][0]["lessons"][2]["assessments"][0]["status"], "not_attempted")
