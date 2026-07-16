# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

from contextlib import contextmanager

import frappe
from frappe.model import document

from lms.lms import utils
from lms.lms.doctype.course_lesson import course_lesson
from lms.lms.doctype.lms_enrollment.lms_enrollment import (
	batched_enrollment_updates,
	update_enrollment,
)
from lms.lms.test_helpers import BaseTestUtils


class TestSaveProgressEnrollmentLifecycle(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.instructor = self._create_user(
			"wh-instructor@example.com", "Webhook", "Instructor", ["Course Creator"]
		)
		self.student = self._create_user("wh-student@example.com", "Webhook", "Student", ["LMS Student"])
		self.course = self._create_course(instructor=self.instructor.email)
		self.chapter = self._create_chapter("WH Chapter", self.course.name)
		self._create_chapter_reference(self.course.name, self.chapter.name)
		self.lesson = self._create_lesson("WH Lesson", self.chapter.name, self.course.name)
		self._create_lesson_reference(self.chapter.name, self.lesson.name)
		self.enrollment = self._create_enrollment(self.student.email, self.course.name)

		original_capture = course_lesson.capture
		course_lesson.capture = lambda *a, **k: None
		self.addCleanup(setattr, course_lesson, "capture", original_capture)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	@contextmanager
	def _record_enrollment_events(self):
		"""Collects the doc events dispatched on LMS Enrollment, in dispatch order."""
		events = []
		original_run_webhooks = document.run_webhooks

		def spy(doc, method):
			if getattr(doc, "doctype", None) == "LMS Enrollment":
				events.append(method)
			return original_run_webhooks(doc, method)

		document.run_webhooks = spy
		try:
			yield events
		finally:
			document.run_webhooks = original_run_webhooks

	def _save_progress_as_student(self):
		frappe.set_user(self.student.email)
		try:
			return course_lesson.save_progress(self.lesson.name, self.course.name)
		finally:
			frappe.set_user("Administrator")

	def test_concurrent_enrollment_saves_raise_timestamp_mismatch(self):
		"""The .save() path this fix avoids: the second writer loses to check_if_latest."""
		a = frappe.get_doc("LMS Enrollment", self.enrollment.name)
		b = frappe.get_doc("LMS Enrollment", self.enrollment.name)

		a.progress = 40
		a.flags.ignore_version = True
		a.save(ignore_permissions=True)

		b.progress = 60
		b.flags.ignore_version = True
		with self.assertRaises(frappe.TimestampMismatchError):
			b.save(ignore_permissions=True)

	def test_concurrent_progress_writes_survive_the_race(self):
		"""Both writers land, neither raises, and each still dispatches on_update."""
		with self._record_enrollment_events() as events:
			for value in (40, 60):
				update_enrollment(self.enrollment.name, {"progress": value})

		self.assertEqual(frappe.db.get_value("LMS Enrollment", self.enrollment.name, "progress"), 60)
		self.assertEqual(events.count("on_update"), 2)

	def test_save_progress_does_not_bump_modified(self):
		"""A revert to .save() would bump `modified` and re-enter check_if_latest."""
		before = frappe.db.get_value("LMS Enrollment", self.enrollment.name, "modified")

		self._save_progress_as_student()

		after = frappe.db.get_value("LMS Enrollment", self.enrollment.name, "modified")
		self.assertEqual(before, after)

	def test_save_progress_dispatches_on_update_on_enrollment(self):
		with self._record_enrollment_events() as events:
			self._save_progress_as_student()

		self.assertIn("on_update", events)

	def test_lesson_completion_dispatches_exactly_one_on_update(self):
		"""Progress and current_lesson are one logical change: one event, one webhook."""
		with self._record_enrollment_events() as events:
			self._save_progress_as_student()

		self.assertEqual(events.count("on_update"), 1)

	def test_save_progress_dispatches_on_update_before_on_change(self):
		"""Doc events must arrive in the order a real .save() produces them."""
		with self._record_enrollment_events() as events:
			self._save_progress_as_student()

		self.assertLess(events.index("on_update"), events.index("on_change"))

	def test_unchanged_progress_dispatches_nothing(self):
		"""A no-op write must not fire spurious webhooks or re-roll program progress."""
		update_enrollment(self.enrollment.name, {"progress": 50})

		with self._record_enrollment_events() as events:
			update_enrollment(self.enrollment.name, {"progress": 50})

		self.assertEqual(events, [])

	def test_current_lesson_write_dispatches_on_update(self):
		"""Regression: current_lesson was a bare set_value, firing no doc events."""
		with self._record_enrollment_events() as events:
			update_enrollment(self.enrollment.name, {"current_lesson": self.lesson.name})

		self.assertEqual(
			frappe.db.get_value("LMS Enrollment", self.enrollment.name, "current_lesson"),
			self.lesson.name,
		)
		self.assertIn("on_update", events)

	def test_save_progress_writes_current_lesson_through_the_lifecycle(self):
		"""save_progress opened the lesson via a raw set_value that fired no on_update."""
		with self._record_enrollment_events() as events:
			self._save_progress_as_student()

		self.assertEqual(
			frappe.db.get_value("LMS Enrollment", self.enrollment.name, "current_lesson"),
			self.lesson.name,
		)
		self.assertIn("on_update", events)

	def test_completing_the_final_lesson_keeps_current_lesson_on_it(self):
		"""get_next_lesson returns None on the last lesson; current_lesson must not be cleared."""
		self._save_progress_as_student()

		self.assertEqual(
			frappe.db.get_value("LMS Enrollment", self.enrollment.name, "current_lesson"),
			self.lesson.name,
		)

	def test_completing_a_lesson_advances_current_lesson_to_the_next(self):
		second = self._create_lesson("WH Lesson 2", self.chapter.name, self.course.name)
		# _create_lesson_reference hardcodes idx=1; get_next_lesson needs idx+1 to exist.
		reference = frappe.get_doc(
			{
				"doctype": "Lesson Reference",
				"lesson": second.name,
				"parent": self.chapter.name,
				"parenttype": "Course Chapter",
				"parentfield": "lessons",
				"idx": 2,
			}
		).insert()
		self.cleanup_items.append(("Lesson Reference", reference.name))

		self._save_progress_as_student()

		self.assertEqual(
			frappe.db.get_value("LMS Enrollment", self.enrollment.name, "current_lesson"),
			second.name,
		)

	def test_save_progress_queues_an_on_update_webhook(self):
		"""The contract the issue is actually about: an On Update Webhook gets queued."""
		webhook = frappe.get_doc(
			{
				"doctype": "Webhook",
				"__newname": "WH Enrollment Progress",
				"webhook_doctype": "LMS Enrollment",
				"webhook_docevent": "on_update",
				"request_url": "https://example.com/wh-progress",
				"request_method": "POST",
				"enabled": 1,
			}
		).insert(ignore_permissions=True)
		self.cleanup_items.append(("Webhook", webhook.name))
		frappe.client_cache.delete_value("webhooks")
		self.addCleanup(frappe.client_cache.delete_value, "webhooks")

		# Queueing a webhook also registers flush_webhook_execution_queue on
		# frappe.db.after_commit. This test never commits, so both would outlive it and
		# fire inside whichever later test commits first (any sql_ddl does) — by which
		# point this Webhook is rolled back, and that test dies on DoesNotExistError.
		frappe.local._webhook_queue = []
		self.addCleanup(frappe.db.after_commit.reset)
		self.addCleanup(setattr, frappe.local, "_webhook_queue", [])

		self._save_progress_as_student()

		queued = [entry.webhook.name for entry in frappe.local._webhook_queue]
		self.assertIn(webhook.name, queued)

	def test_on_change_handlers_see_doc_before_save(self):
		"""Value Change notifications and has_value_changed() read doc_before_save."""
		seen = {}

		def spy(doc, method):
			if doc.doctype == "LMS Enrollment" and method == "on_change":
				before = doc.get_doc_before_save()
				seen["before_progress"] = before and before.progress
				seen["changed"] = doc.has_value_changed("progress")

		original = document.run_webhooks
		document.run_webhooks = spy
		self.addCleanup(setattr, document, "run_webhooks", original)

		update_enrollment(self.enrollment.name, {"progress": 25})

		self.assertEqual(seen["before_progress"], 0)
		self.assertTrue(seen["changed"])

	def test_save_progress_issues_no_enrollment_writes_when_nothing_changed(self):
		"""Video-watch ticks call save_progress repeatedly; a no-op must not write."""
		self._save_progress_as_student()

		writes = []
		original_set_value = frappe.db.set_value

		def spy(doctype, name, *args, **kwargs):
			if doctype == "LMS Enrollment":
				writes.append(name)
			return original_set_value(doctype, name, *args, **kwargs)

		frappe.db.set_value = spy
		self.addCleanup(setattr, frappe.db, "set_value", original_set_value)

		self._save_progress_as_student()

		self.assertEqual(writes, [])

	def test_progress_write_for_member_of_courseless_program_does_not_raise(self):
		"""on_update rolls up programs; a program with no courses used to divide by zero."""
		program = frappe.get_doc(
			{
				"doctype": "LMS Program",
				"title": "Empty WH Program",
				"program_members": [{"member": self.student.email}],
			}
		).insert(ignore_permissions=True)
		self.cleanup_items.append(("LMS Program", program.name))

		progress = self._save_progress_as_student()

		self.assertEqual(frappe.db.get_value("LMS Enrollment", self.enrollment.name, "progress"), progress)
		self.assertEqual(frappe.db.get_value("LMS Program Member", {"parent": program.name}, "progress"), 0)

	def test_batch_flag_is_cleared_when_the_block_raises(self):
		"""A leaked flag would silently swallow every later enrollment write in the request."""
		with self.assertRaises(ValueError):
			with batched_enrollment_updates():
				update_enrollment(self.enrollment.name, {"progress": 70})
				raise ValueError("boom")

		self.assertIsNone(getattr(frappe.local, "lms_enrollment_batch", None))
		self.assertEqual(frappe.db.get_value("LMS Enrollment", self.enrollment.name, "progress"), 0)

		# The next write must go straight through, not into a stale batch.
		update_enrollment(self.enrollment.name, {"progress": 70})
		self.assertEqual(frappe.db.get_value("LMS Enrollment", self.enrollment.name, "progress"), 70)

	def test_nested_batch_flushes_once_at_the_outermost_exit(self):
		with self._record_enrollment_events() as events:
			with batched_enrollment_updates():
				with batched_enrollment_updates():
					update_enrollment(self.enrollment.name, {"progress": 30})
				self.assertEqual(events, [])
				update_enrollment(self.enrollment.name, {"current_lesson": self.lesson.name})

		self.assertEqual(events.count("on_update"), 1)
		self.assertEqual(frappe.db.get_value("LMS Enrollment", self.enrollment.name, "progress"), 30)

	def test_update_enrollment_rejects_an_unknown_fieldname(self):
		"""Fail at the call site instead of as a raw SQL error inside the write."""
		with self.assertRaises(frappe.ValidationError):
			update_enrollment(self.enrollment.name, {"progres": 50})

	def test_recalculate_course_progress_dispatches_on_update(self):
		"""Regression: recalculate_course_progress wrote via raw set_value, firing no doc events."""
		with self._record_enrollment_events() as events:
			utils.recalculate_course_progress(self.course.name, self.student.email)

		self.assertIn("on_update", events)

	def test_recalculate_course_progress_without_enrollment_rolls_up_programs(self):
		"""No enrollment: skip the write, but still refresh the member's program progress."""
		stranger = self._create_user("wh-stranger@example.com", "Web", "Stranger", ["LMS Student"])
		calls = []
		original = utils.update_program_progress
		utils.update_program_progress = lambda member: calls.append(member)
		self.addCleanup(setattr, utils, "update_program_progress", original)

		utils.recalculate_course_progress(self.course.name, stranger.name)

		self.assertEqual(calls, [stranger.name])
