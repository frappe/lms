from unittest.mock import patch

import frappe

from lms.lms.doctype.lms_badge_assignment.lms_badge_assignment import LMSBadgeAssignment
from lms.lms.test_helpers import BaseTestUtils


class TestBadgeOnCourseSave(BaseTestUtils):
	"""A badge on LMS Course is applied by `process_badges` on every course save."""

	def setUp(self):
		super().setUp()
		self._create_user("frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"])
		self.addCleanup(frappe.cache_manager.clear_doctype_map, "LMS Badge", "LMS Course")

	def _create_badge(self, event, user_field, condition):
		badge = frappe.get_doc(
			{
				"doctype": "LMS Badge",
				"title": f"Course Badge {frappe.generate_hash(length=6)}",
				"event": event,
				"reference_doctype": "LMS Course",
				"user_field": user_field,
				"condition": condition,
				"image": "/assets/lms/images/badge.png",
				"description": "Badge for course save tests",
				"enabled": 1,
			}
		)
		# nosemgrep: lms-unjustified-ignore-permissions - fixture seeding, not the permission under test
		badge.insert(ignore_permissions=True)
		frappe.cache_manager.clear_doctype_map("LMS Badge", "LMS Course")
		return badge

	def _assignments(self, badge):
		return frappe.get_all("LMS Badge Assignment", {"badge": badge.name}, pluck="member")

	def test_badge_for_owner_is_awarded_on_course_save(self):
		for user_field in ("owner", "modified_by"):
			with self.subTest(user_field=user_field):
				badge = self._create_badge("New", user_field, "doc.title")
				course = self._create_course(title=f"Owner Badge Course {user_field}")
				self.assertEqual(self._assignments(badge), [course.get(user_field)])

	def test_manual_assignment_badge_is_not_applied_on_save(self):
		badge = self._create_badge("Manual Assignment", "owner", '{"published": 0}')
		course = self._create_course(title="Manual Badge Course")
		self.assertFalse(badge.rule_condition_satisfied(course))
		self.assertEqual(self._assignments(badge), [])


class TestLMSBadge(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.hash = frappe.generate_hash(length=6)
		cls.student = cls._create_user(f"badge-{cls.hash}@example.com", "Bea", "Student", ["LMS Student"])

	def setUp(self):
		super().setUp()
		# The badge map lives in redis, so it outlives the rolled-back badges of each test.
		frappe.cache_manager.clear_doctype_map("LMS Badge", "ToDo")
		self.addCleanup(frappe.cache_manager.clear_doctype_map, "LMS Badge", "ToDo")

	def _create_badge(self, title, event, condition, **extra):
		badge = frappe.get_doc(
			{
				"doctype": "LMS Badge",
				"title": f"{title} {self.hash} {frappe.generate_hash(length=4)}",
				"event": event,
				"reference_doctype": "ToDo",
				"user_field": "allocated_to",
				"condition": condition,
				"image": "/assets/lms/images/badge.png",
				"description": "A badge for testing automatic awards",
				"enabled": 1,
				**extra,
			}
		)
		# nosemgrep: lms-unjustified-ignore-permissions - fixture seeding, not the permission under test
		badge.insert(ignore_permissions=True)
		return badge

	def _save_todo_as_student(self, **values):
		frappe.set_user(self.student.name)
		try:
			todo = frappe.get_doc({"doctype": "ToDo", "allocated_to": self.student.name, **values})
			todo.insert()
			return todo
		finally:
			frappe.set_user("Administrator")

	def _assignments(self, badge):
		return frappe.db.count("LMS Badge Assignment", {"badge": badge.name, "member": self.student.name})

	def test_failing_badge_condition_does_not_fail_the_save(self):
		"""A badge error failed the save of any document since #795.
		Added for audit finding #21."""
		badge = self._create_badge("Broken", "New", "doc.description.missing_attribute.upper()")

		# Asserted on the call, not the row: Error Log is not a database table on every
		# frappe version.
		with patch("frappe.log_error", wraps=frappe.log_error) as log_error:
			todo = self._save_todo_as_student(description="broken badge")

		self.assertTrue(frappe.db.exists("ToDo", todo.name))
		self.assertEqual(self._assignments(badge), 0)
		log_error.assert_called_once()
		logged = log_error.call_args.kwargs
		self.assertIn(badge.name, logged["title"])
		self.assertEqual((logged["reference_doctype"], logged["reference_name"]), ("ToDo", todo.name))

	def test_failed_award_leaves_no_half_written_assignment(self):
		"""The savepoint also undoes a half-written assignment. Same regression (#795), audit finding #21."""
		badge = self._create_badge("Half written", "New", "doc.description == 'half'")

		with patch.object(
			LMSBadgeAssignment, "after_insert", side_effect=frappe.ValidationError, create=True
		):
			todo = self._save_todo_as_student(description="half")

		self.assertTrue(frappe.db.exists("ToDo", todo.name))
		self.assertEqual(self._assignments(badge), 0)

	def test_student_save_succeeds_with_a_manual_badge_on_the_doctype(self):
		"""A manual badge blocked learner saves of its doctype since #2108.
		Added for audit finding #63."""
		badge = self._create_badge("Manual", "Manual Assignment", '{"status": "Open"}')

		todo = self._save_todo_as_student(description="manual badge present")

		self.assertTrue(frappe.db.exists("ToDo", todo.name))
		self.assertEqual(self._assignments(badge), 0)

	def test_value_change_badge_awards_once_on_the_transition(self):
		"""A Value Change badge was re-awarded on every save since #795.
		Added for audit finding #52."""
		badge = self._create_badge("Closer", "Value Change", "doc.status == 'Closed'")
		todo = self._save_todo_as_student(description="open task")
		todo.save()
		self.assertEqual(self._assignments(badge), 0)

		todo.status = "Closed"
		todo.save()
		self.assertEqual(self._assignments(badge), 1)

		todo.description = "still closed"
		todo.save()
		todo.db_set("description", "closed again")
		self.assertEqual(self._assignments(badge), 1)

	def test_value_change_badge_is_not_duplicated_when_the_condition_flips_back(self):
		"""Each false-to-true flip re-awarded a Value Change badge since #795.
		Added for audit finding #52."""
		badge = self._create_badge("Flipper", "Value Change", "doc.status == 'Closed'")
		todo = self._save_todo_as_student(description="flip", status="Closed")
		self.assertEqual(self._assignments(badge), 1)

		todo.status = "Open"
		todo.save()
		todo.status = "Closed"
		todo.save()
		self.assertEqual(self._assignments(badge), 1)

	def test_badge_disabled_behind_the_cached_map_is_skipped(self):
		"""A disabled badge still ran from the cached badge map since #795.
		Added for audit finding #21."""
		badge = self._create_badge("Quietly disabled", "New", "doc.description == 'quiet'")
		self._save_todo_as_student(description="warm the badge map")
		frappe.db.set_value("LMS Badge", badge.name, "enabled", 0)

		with patch("frappe.log_error", wraps=frappe.log_error) as log_error:
			todo = self._save_todo_as_student(description="quiet")

		self.assertTrue(frappe.db.exists("ToDo", todo.name))
		self.assertEqual(self._assignments(badge), 0)
		log_error.assert_not_called()

	def test_deleted_badge_is_dropped_from_the_map(self):
		"""A deleted badge still ran from the cached badge map since #795.
		Added for audit finding #21."""
		badge = self._create_badge("Deleted", "New", "doc.description == 'deleted'")
		self._save_todo_as_student(description="warm the badge map")
		frappe.delete_doc("LMS Badge", badge.name)

		with patch("frappe.log_error", wraps=frappe.log_error) as log_error:
			todo = self._save_todo_as_student(description="deleted")

		self.assertTrue(frappe.db.exists("ToDo", todo.name))
		log_error.assert_not_called()
