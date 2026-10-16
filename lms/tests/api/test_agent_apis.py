# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""The API calls a script or agent uses without the app's screens: pages past the home
page's few rows, inputs the screens send in a second request, and plain JSON answers."""

import json
import os

import frappe
from frappe.utils import add_days, nowdate

from lms.lms.api import (
	add_students_to_batch,
	create_lesson,
	delete_lesson,
	export_course_as_file,
	get_admin_live_classes,
	get_created_batches,
	get_created_courses,
	get_live_class_start_url,
	get_members,
	save_evaluation_details,
	upsert_chapter,
)
from lms.lms.doctype.lms_batch.lms_batch import get_batch_timetable
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_program_details


class TestAgentApis(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.hash = frappe.generate_hash(length=6).lower()
		cls.instructor = cls._create_user(
			f"agent-ins-{cls.hash}@example.com", "Agent", "Instructor", ["Course Creator"]
		).name
		cls.moderator = cls._create_user(
			f"agent-mod-{cls.hash}@example.com", "Agent", "Moderator", ["Moderator"]
		).name
		cls.students = [
			cls._create_user(
				f"agent-stu{i}-{cls.hash}@example.com", "Agent", f"Student{i}", ["LMS Student"]
			).name
			for i in range(3)
		]
		cls.courses = [
			cls._create_course(f"Agent Course {i} {cls.hash}", instructor=cls.instructor).name
			for i in range(5)
		]
		cls.evaluator = cls._create_user(
			f"agent-eval-{cls.hash}@example.com", "Agent", "Evaluator", ["Batch Evaluator"]
		).name
		cls._create_evaluator(cls.evaluator)
		cls.batch = cls._create_batch(
			cls.courses[0],
			instructor=cls.instructor,
			title=f"Agent Batch {cls.hash}",
			evaluator=cls.evaluator,
		).name

	def _as(self, user):
		frappe.set_user(user)
		self.addCleanup(frappe.set_user, "Administrator")

	def test_created_courses_keep_three_and_page_on_request(self):
		self._as(self.instructor)
		self.assertEqual(len(get_created_courses()), 3)
		first = {course.name for course in get_created_courses(limit_page_length=5)}
		self.assertEqual(first, set(self.courses))
		rest = get_created_courses(start=3, limit_page_length=5)
		self.assertEqual(len(rest), 2)
		self.assertEqual(get_created_courses(start=5, limit_page_length=5), [])

	def test_a_moderator_who_instructs_courses_pages_only_their_own(self):
		self._create_course(f"Agent Mod Course {self.hash}", instructor=self.moderator)
		self._as(self.moderator)
		own = get_created_courses(limit_page_length=50)
		self.assertEqual([course.title for course in own], [f"Agent Mod Course {self.hash}"])
		self.assertEqual(get_created_courses(start=1, limit_page_length=50), [])

	def test_created_batches_include_past_ones_on_request(self):
		frappe.db.set_value("LMS Batch", self.batch, "start_date", add_days(nowdate(), -30))
		self._as(self.instructor)
		self.assertNotIn(self.batch, [batch.name for batch in get_created_batches()])
		self.assertIn(self.batch, [batch.name for batch in get_created_batches(upcoming=0)])

	def test_members_page_on_request(self):
		self._as(self.moderator)
		self.assertEqual(len(get_members(limit_page_length=2)), 2)

	def test_a_lesson_is_made_with_its_content(self):
		chapter = self._create_chapter(f"Agent Chapter {self.hash}", self.courses[1])
		content = {"blocks": [{"type": "paragraph", "data": {"text": "Hello <script>x</script>"}}]}
		self._as(self.instructor)
		lesson = create_lesson(chapter.name, "With content", content=content)
		saved = json.loads(frappe.db.get_value("Course Lesson", lesson, "content"))
		self.assertEqual(saved["blocks"][0]["type"], "paragraph")
		self.assertNotIn("<script>", saved["blocks"][0]["data"]["text"])

	def test_a_chapter_needs_no_scorm_flag(self):
		self._as(self.instructor)
		chapter = upsert_chapter(title=f"Plain Chapter {self.hash}", course=self.courses[2])
		self.assertFalse(chapter.is_scorm_package)

	def test_deleting_a_lesson_from_the_wrong_chapter_is_a_clear_error(self):
		chapter = self._create_chapter(f"Agent Chapter A {self.hash}", self.courses[3])
		other = self._create_chapter(f"Agent Chapter B {self.hash}", self.courses[3])
		self._as(self.instructor)
		lesson = create_lesson(chapter.name, "Stays put")
		with self.assertRaises(frappe.ValidationError):
			delete_lesson(lesson, other.name)
		self.assertTrue(frappe.db.exists("Course Lesson", lesson))

	def test_students_are_added_to_a_batch_together(self):
		missing = f"nobody-{self.hash}@example.com"
		self._as(self.moderator)
		before = list(frappe.local.message_log)
		result = add_students_to_batch(self.batch, json.dumps(self.students[:2] + [missing]))
		self.assertEqual(result["added"], self.students[:2])
		self.assertEqual([error["member"] for error in result["errors"]], [missing])
		self.assertEqual(frappe.local.message_log, before)
		for student in self.students[:2]:
			self.assertTrue(
				frappe.db.exists("LMS Batch Enrollment", {"batch": self.batch, "member": student})
			)

	def test_an_export_can_be_kept_as_a_file_only_its_exporter_opens(self):
		self._as(self.instructor)
		file_url = export_course_as_file(self.courses[4])
		frappe.set_user("Administrator")
		file_doc = frappe.get_doc("File", {"file_url": file_url})
		self.addCleanup(
			lambda: os.path.exists(file_doc.get_full_path()) and os.remove(file_doc.get_full_path())
		)
		self.assertTrue(file_doc.is_private)
		self.assertEqual(file_doc.owner, self.instructor)
		self.assertFalse(file_doc.attached_to_doctype)
		self.assertFalse(frappe.has_permission("File", "read", doc=file_doc, user=self.moderator))

	def test_the_start_link_is_returned_to_the_instructor_only(self):
		live_class = frappe.get_doc(
			{
				"doctype": "LMS Live Class",
				"title": f"Agent Class {self.hash}",
				"batch_name": self.batch,
				"host": self.instructor,
				"date": add_days(nowdate(), 1),
				"time": "10:00:00",
				"duration": 60,
				"timezone": "Asia/Kolkata",
				"conferencing_provider": "Zoom",
				"start_url": "https://example.com/start",
				"join_url": "https://example.com/join",
			}
		)
		live_class.db_insert()
		self._as(self.instructor)
		self.assertEqual(get_live_class_start_url(live_class.name), "https://example.com/start")
		row = next(row for row in get_admin_live_classes(limit_page_length=50) if row.name == live_class.name)
		self.assertEqual((row.batch_name, row.timezone), (self.batch, "Asia/Kolkata"))
		frappe.set_user(self.students[2])
		with self.assertRaises(frappe.PermissionError):
			get_live_class_start_url(live_class.name)

	def test_a_batch_instructor_reads_the_timetable(self):
		self._as(self.instructor)
		self.assertIsInstance(get_batch_timetable(self.batch), list)

	def test_a_missing_program_gets_the_usual_refusal(self):
		self._as(self.instructor)
		with self.assertRaises(frappe.ValidationError) as refusal:
			get_program_details(f"No Such Program {self.hash}")
		self.assertNotIsInstance(refusal.exception, frappe.DoesNotExistError)

	def test_an_author_reads_their_own_draft_program(self):
		self._as(self.instructor)
		program = frappe.get_doc(
			{"doctype": "LMS Program", "title": f"Agent Program {self.hash}", "published": 0}
		).insert()
		self.assertEqual(get_program_details(program.name).name, program.name)

	def test_a_moderator_records_an_evaluation(self):
		# The Moderator role alone: being a Course Evaluator would add Batch Evaluator.
		self.assertEqual(set(frappe.get_roles(self.moderator)) & {"Batch Evaluator", "System Manager"}, set())
		member = self.students[2]
		self._create_enrollment(member, self.courses[0])
		self._as(self.moderator)
		evaluation = save_evaluation_details(
			member=member,
			course=self.courses[0],
			date_value=nowdate(),
			start_time="10:00:00",
			end_time="11:00:00",
			status="Pass",
			rating=4,
		)
		self.assertEqual(frappe.db.get_value("LMS Certificate Evaluation", evaluation, "status"), "Pass")
