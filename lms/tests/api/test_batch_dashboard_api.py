# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""The batch dashboard endpoints: who may call them, what they accept, and the bugs they once had."""

from unittest.mock import patch

import frappe
from frappe.utils import getdate, now_datetime

from lms.lms.dashboard.batch import (
	_student_course_assessments,
	export_batch_analytics,
	get_batch_analytics_preview,
	get_batch_analytics_report,
	get_batch_assessment_stats,
	get_batch_class_attendance,
	get_batch_dashboard_stats,
	get_batch_feedback_list,
	get_batch_student_detail,
	get_batch_students,
	send_batch_reminder,
)
from lms.lms.doctype.lms_batch_feedback.lms_batch_feedback import feedback_summary
from lms.lms.test_helpers import BaseTestUtils

REJECTED = (frappe.ValidationError, frappe.FrappeTypeError)


class TestBatchDashboardAPI(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.author = cls._create_user(f"bd-auth-{hash}@example.com", "Au", "Thor", ["Course Creator"]).name
		cls.other_creator = cls._create_user(
			f"bd-other-{hash}@example.com", "Ot", "Her", ["Course Creator"]
		).name
		cls._require_no_moderators(cls.author, cls.other_creator)

		course = cls._create_course(title=f"Batch Course {hash}", instructor=cls.author).name
		cls.batch = cls._create_batch(
			course, instructor=cls.author, title=f"Dashboard Batch {hash}", evaluator=None
		).name
		cls.live_class = cls._seed(
			"LMS Live Class", title=f"Class {hash}", batch_name=cls.batch, date=getdate(), duration=60
		)

		# Ratings stored as stars / 5; 0 is a rating left blank.
		cls.students = []
		for tag, (content, instructors, value) in (("one", (1.0, 0, 0.6)), ("two", (0.2, 0.8, 0.6))):
			student = cls._create_user(
				f"bd-{tag}-{hash}@example.com", "Stu", f"{tag.title()} {hash}", ["LMS Student"]
			).name
			cls._create_batch_enrollment(student, cls.batch)
			cls._seed(
				"LMS Batch Feedback",
				batch=cls.batch,
				member=student,
				member_name=f"Stu {tag.title()}",
				content=content,
				instructors=instructors,
				value=value,
				feedback=f"Comment {tag}",
			)
			cls.students.append(student)

	@classmethod
	def _seed(cls, doctype, **fields):
		"""Write the row as stored, skipping the controller."""
		doc = frappe.new_doc(doctype)
		doc.update(fields)
		if frappe.get_meta(doctype).autoname != "autoincrement":
			doc.name = frappe.generate_hash(length=12)
		doc.creation = doc.modified = now_datetime()
		doc.owner = doc.modified_by = "Administrator"
		doc.db_insert()
		return doc.name

	def _enrollment(self, member):
		return frappe.db.get_value("LMS Batch Enrollment", {"batch": self.batch, "member": member})

	def test_non_staff_are_refused(self):
		enrollment = self._enrollment(self.students[0])
		calls = {
			"get_batch_dashboard_stats": lambda: get_batch_dashboard_stats(self.batch),
			"get_batch_feedback_list": lambda: get_batch_feedback_list(self.batch),
			"get_batch_assessment_stats": lambda: get_batch_assessment_stats(self.batch),
			"get_batch_students": lambda: get_batch_students(self.batch),
			"get_batch_class_attendance": lambda: get_batch_class_attendance(self.batch, self.live_class),
			"get_batch_student_detail": lambda: get_batch_student_detail(self.batch, enrollment),
			"export_batch_analytics": lambda: export_batch_analytics(self.batch),
			"get_batch_analytics_report": lambda: get_batch_analytics_report(self.batch),
			"get_batch_analytics_preview": lambda: get_batch_analytics_preview(self.batch),
			"send_batch_reminder": lambda: send_batch_reminder(self.batch, enrollment),
		}
		with patch("frappe.sendmail") as sendmail:
			for user in (self.other_creator, self.students[0], "Guest"):
				for name, call in calls.items():
					with self.subTest(user=user, endpoint=name), self.assertRaises(frappe.PermissionError):
						frappe.set_user(user)
						call()
		self.assertEqual(sendmail.call_count, 0)
		frappe.set_user(self.author)
		self.assertEqual(get_batch_dashboard_stats(self.batch)["enrolled"], 2)

	def test_wrong_argument_types_are_rejected(self):
		frappe.set_user(self.author)
		bad = ["!=", ""]
		calls = {
			"get_batch_dashboard_stats": lambda: get_batch_dashboard_stats(bad),
			"get_batch_feedback_list": lambda: get_batch_feedback_list(bad),
			"get_batch_assessment_stats": lambda: get_batch_assessment_stats(bad),
			"get_batch_students": lambda: get_batch_students(self.batch, page_length=[20]),
			"get_batch_class_attendance": lambda: get_batch_class_attendance(self.batch, bad),
			"get_batch_student_detail": lambda: get_batch_student_detail(self.batch, bad),
			"export_batch_analytics": lambda: export_batch_analytics(bad),
			"get_batch_analytics_report": lambda: get_batch_analytics_report(self.batch, to_date=bad),
			"get_batch_analytics_preview": lambda: get_batch_analytics_preview(bad),
			"send_batch_reminder": lambda: send_batch_reminder(self.batch, bad),
		}
		with patch("frappe.sendmail") as sendmail:
			for name, call in calls.items():
				with self.subTest(endpoint=name), self.assertRaises(REJECTED):
					call()
		self.assertEqual(sendmail.call_count, 0)

	def test_feedback_summary_leaves_blank_ratings_out_of_the_averages(self):
		summary = feedback_summary(self.batch)
		self.assertEqual((summary["responses"], summary["low_responses"]), (2, 1))
		self.assertEqual(summary["averages"], {"content": 3.0, "instructors": 4.0, "value": 3.0})

	def test_student_detail_rating_leaves_out_a_blank_rating(self):
		frappe.set_user(self.author)
		detail = get_batch_student_detail(self.batch, self._enrollment(self.students[0]))
		self.assertEqual(detail["feedback"]["rating"], 4.0)

	def test_course_assessments_leave_out_an_exercise_the_batch_assesses(self):
		context = frappe._dict(
			quizzes=[], assignments=[], exercises=["EX-1"], courses=[frappe._dict(course="C1")]
		)
		lessons = [frappe._dict(lesson="L1", course="C1")]
		results = {
			"L1": [
				{"type": "exercise", "name": "EX-1", "status": "passed"},
				{"type": "exercise", "name": "EX-2", "status": "failed"},
			]
		}
		with patch("lms.lms.dashboard.batch._lesson_assessment_results", return_value=results):
			rows = _student_course_assessments(context, lessons, "someone@example.com")
		self.assertEqual([row["name"] for row in rows], ["EX-2"])
