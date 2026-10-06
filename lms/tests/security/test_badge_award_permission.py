import frappe

from lms.lms.test_helpers import BaseTestUtils


class TestBadgeAwardPermission(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.student = cls._create_user(f"bawd-{hash}@example.com", "Bea", "Student", ["LMS Student"])
		cls.badge = cls._create_badge(f"Award Badge {hash}", "User", "email", "doc.enabled")
		cls.todo_badge = cls._create_badge(f"ToDo Badge {hash}", "ToDo", "allocated_to", "doc.description")

	@classmethod
	def _create_badge(cls, title, reference_doctype, user_field, condition):
		badge = frappe.get_doc(
			{
				"doctype": "LMS Badge",
				"title": title,
				"event": "New",
				"reference_doctype": reference_doctype,
				"user_field": user_field,
				"condition": condition,
				"image": "/assets/lms/images/badge.png",
				"description": "A badge for testing the award permission",
				"enabled": 1,
			}
		)
		# nosemgrep: lms-unjustified-ignore-permissions - fixture seeding, not the permission under test
		badge.insert(ignore_permissions=True)
		return badge.name

	def test_student_cannot_create_a_badge_assignment_for_self(self):
		"""LMS Student must not create LMS Badge Assignment. #795 granted that create DocPerm.
		#2846 removed it and added this test, so only staff roles and award() create them.
		"""
		assignment = frappe.get_doc(
			{
				"doctype": "LMS Badge Assignment",
				"badge": self.badge,
				"member": self.student.name,
				"issued_on": frappe.utils.today(),
			}
		)
		frappe.set_user(self.student.name)
		try:
			with self.assertRaises(frappe.PermissionError):
				assignment.insert()
		finally:
			frappe.set_user("Administrator")

	def test_automatic_award_still_reaches_a_student(self):
		"""An automatic award must still save when the acting user is an LMS Student.
		award() came with #795 and leaned on the Student create DocPerm. #2846 removed
		that DocPerm and added this test to keep the automatic award path working.
		"""
		frappe.set_user(self.student.name)
		try:
			# A real save, so the "*" on_change hook (process_badges) does the awarding.
			frappe.get_doc(
				{"doctype": "ToDo", "description": "earn it", "allocated_to": self.student.name}
			).insert()
		finally:
			frappe.set_user("Administrator")
		self.assertTrue(
			frappe.db.exists("LMS Badge Assignment", {"badge": self.todo_badge, "member": self.student.name})
		)
