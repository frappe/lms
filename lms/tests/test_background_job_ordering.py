# Copyright (c) 2026, Frappe and Contributors
# See license.txt

import contextlib

import frappe
from frappe.utils import background_jobs

from lms.lms.test_helpers import BaseTestUtils


@contextlib.contextmanager
def capture_queue_pushes():
	"""Swap the RQ queue for a recorder, so the moment a job reaches a worker is visible.
	frappe.enqueue pushes at once, or on frappe.db.after_commit when asked to."""
	pushes = []

	class RecordingQueue:
		count = 0

		def enqueue_call(self, *args, **kwargs):
			pushes.append(kwargs)

	original_get_queue = background_jobs.get_queue
	background_jobs.get_queue = lambda *args, **kwargs: RecordingQueue()
	try:
		yield pushes
	finally:
		background_jobs.get_queue = original_get_queue


class TestBackgroundJobOrdering(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self._create_user("frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"])
		self._create_evaluator()
		with capture_queue_pushes():
			self.course = self._create_course(f"Ordering Course {frappe.generate_hash()}")

	def assert_pushed_only_on_commit(self, pushes, message):
		self.assertEqual(pushes, [], message)
		frappe.db.after_commit.run()
		self.assertEqual(len(pushes), 1, "the job was never queued on commit")

	def test_batch_inserted_published_queues_notification_only_on_commit(self):
		"""Regression from #1971: the publish notification was queued before commit.
		Added for audit finding #41."""
		with capture_queue_pushes() as pushes:
			frappe.db.after_commit.reset()
			self._create_batch(self.course.name, title=f"Ordering Batch {frappe.generate_hash()}")
			self.assert_pushed_only_on_commit(
				pushes, "inserting a published batch queued its notification before commit"
			)

	def test_lesson_insert_queues_recalculation_only_on_commit(self):
		"""Regression from #2120: the progress recalculation was queued before commit.
		Added for audit finding #40."""
		chapter = self._create_chapter(f"Ordering Chapter {frappe.generate_hash()}", self.course.name)
		student = self._create_user(
			f"ordering_{frappe.generate_hash()}@example.com", "Ordering", "Student", ["LMS Student"]
		)
		self._create_enrollment(student.name, self.course.name)

		with capture_queue_pushes() as pushes:
			frappe.db.after_commit.reset()
			self._create_lesson(f"Ordering Lesson {frappe.generate_hash()}", chapter.name, self.course.name)
			self.assert_pushed_only_on_commit(
				pushes, "adding a lesson queued the recalculation before commit"
			)
