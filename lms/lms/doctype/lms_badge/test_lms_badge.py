import frappe

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
