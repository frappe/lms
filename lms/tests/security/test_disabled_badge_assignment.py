import frappe

from lms.lms.test_helpers import BaseTestUtils


class TestDisabledBadgeAssignment(BaseTestUtils):
	"""A disabled badge must not be awarded, whoever is asking.

	The doc_events path already filters on `enabled`, so the only way a disabled
	badge reaches an assignment is a direct insert, which every LMS Student can
	make.
	"""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.student = cls._create_user(f"bstud-{hash}@example.com", "Bea", "Student", ["LMS Student"])
		cls.enabled_badge = cls._create_badge(f"Enabled Badge {hash}", enabled=1)
		cls.disabled_badge = cls._create_badge(f"Disabled Badge {hash}", enabled=0)

	@classmethod
	def _create_badge(cls, title, enabled):
		badge = frappe.get_doc(
			{
				"doctype": "LMS Badge",
				"title": title,
				"event": "New",
				"reference_doctype": "User",
				"user_field": "email",
				"condition": "doc.enabled",
				"image": "/assets/lms/images/badge.png",
				"description": "A badge for testing the disabled gate",
				"enabled": enabled,
			}
		)
		badge.insert(ignore_permissions=True)
		return badge.name

	def _assign(self, badge, user):
		frappe.session.user = user
		try:
			doc = frappe.get_doc(
				{
					"doctype": "LMS Badge Assignment",
					"badge": badge,
					"member": self.student.name,
					"issued_on": frappe.utils.today(),
				}
			)
			doc.insert()
			return doc.name
		finally:
			frappe.session.user = "Administrator"

	def test_disabled_badge_cannot_be_awarded_by_anyone(self):
		# The gate has no role branch: neither a student awarding themselves nor
		# an Administrator/Moderator caller can get a disabled badge past it.
		cases = [
			("student", self.student.name),
			("administrator", "Administrator"),
		]
		for case, caller in cases:
			with self.subTest(case=case):
				with self.assertRaises(frappe.ValidationError):
					self._assign(self.disabled_badge, caller)

	def test_an_enabled_badge_is_still_assignable(self):
		"""The control: the gate is the badge's own switch, not the insert path."""
		self.assertTrue(self._assign(self.enabled_badge, self.student.name))

	def test_an_existing_assignment_cannot_be_repointed_to_a_disabled_badge(self):
		"""The gate ran only on insert, so editing `badge` on an already-saved
		assignment skipped it entirely."""
		name = self._assign(self.enabled_badge, self.student.name)
		doc = frappe.get_doc("LMS Badge Assignment", name)
		doc.badge = self.disabled_badge
		with self.assertRaises(frappe.ValidationError):
			doc.save(ignore_permissions=True)
