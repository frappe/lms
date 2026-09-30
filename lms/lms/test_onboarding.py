import frappe
from frappe.utils import nowdate

from lms.lms.onboarding import get_onboarding_facts
from lms.lms.test_helpers import BaseTestUtils

SAMPLE_COURSE_TITLE = "A guide to Frappe Learning"

FLAG_KEYS = {
	"has_course",
	"has_chapter",
	"has_lesson",
	"has_course_image",
	"has_published_course",
	"has_invited_student",
	"has_batch",
	"has_batch_course",
	"has_batch_student",
	"has_conferencing_account",
	"has_live_class",
	"has_published_batch",
}


class TestOnboardingFacts(BaseTestUtils):
	def setUp(self):
		super().setUp()
		# Every new user gets LMS Student from a hook, so the admin is created before
		# the student roles are cleared, or it would count as an invited student.
		self.admin = self._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"]
		)
		self._clear_onboarding_records()

	def _clear_onboarding_records(self):
		for doctype in (
			"LMS Live Class",
			"LMS Batch Enrollment",
			"Batch Course",
			"LMS Batch",
			"Course Lesson",
			"Course Chapter",
			"LMS Course",
			"LMS Zoom Settings",
			"LMS Google Meet Settings",
		):
			frappe.db.delete(doctype)
		frappe.db.delete("Has Role", {"role": "LMS Student", "parenttype": "User"})

	def _facts(self):
		return get_onboarding_facts()

	# Guards: a Guest reading the site's setup facts. Introduced in this branch (feat/onboarding-flows, PR
	# pending); test added there to pin the auth gate.
	def test_guest_is_rejected(self):
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			get_onboarding_facts()

	def test_non_system_manager_is_rejected(self):
		student = self._create_user("onboarding-student@example.com", "Onb", "Student", ["LMS Student"])
		frappe.set_user(student.name)
		with self.assertRaises(frappe.PermissionError):
			get_onboarding_facts()

	def test_moderator_without_system_manager_is_rejected(self):
		frappe.set_user(self.admin.name)
		with self.assertRaises(frappe.PermissionError):
			get_onboarding_facts()

	# Guards: a renamed or dropped fact key that the frontend flows read by name. Introduced in this
	# branch (feat/onboarding-flows, PR pending); test added there to keep the payload shape fixed.
	def test_returns_exact_key_set(self):
		self.assertEqual(set(self._facts()), FLAG_KEYS | {"first_course", "first_batch"})

	# Guards: a step showing as done on a fresh site. Introduced in this branch (feat/onboarding-flows, PR
	# pending); test added there to pin the all-false baseline.
	def test_clean_site_has_no_facts(self):
		facts = self._facts()
		self.assertIsNone(facts["first_course"])
		self.assertIsNone(facts["first_batch"])
		for key in FLAG_KEYS:
			self.assertIs(facts[key], False, key)

	# Guards: the seeded sample course ticking the admin's own course steps. Introduced in this branch
	# (feat/onboarding-flows, PR pending); test added there to keep the sample out of every course fact.
	def test_sample_course_is_ignored(self):
		sample = self._create_course(title=SAMPLE_COURSE_TITLE)
		chapter = self._create_chapter("Sample chapter", sample.name)
		self._create_lesson("Sample lesson", chapter.name, sample.name)

		facts = self._facts()
		self.assertIsNone(facts["first_course"])
		self.assertFalse(facts["has_course"])
		self.assertFalse(facts["has_chapter"])
		self.assertFalse(facts["has_lesson"])
		self.assertFalse(facts["has_published_course"])

	def test_course_facts_follow_the_first_course(self):
		course = self._create_course(title="Onboarding Course")
		frappe.db.set_value("LMS Course", course.name, {"published": 0, "image": None})

		facts = self._facts()
		self.assertEqual(facts["first_course"], course.name)
		self.assertTrue(facts["has_course"])
		self.assertFalse(facts["has_chapter"])
		self.assertFalse(facts["has_lesson"])
		self.assertFalse(facts["has_course_image"])
		self.assertFalse(facts["has_published_course"])

		chapter = self._create_chapter("Onboarding chapter", course.name)
		self._create_lesson("Onboarding lesson", chapter.name, course.name)
		frappe.db.set_value("LMS Course", course.name, {"published": 1, "image": "/files/cover.png"})

		facts = self._facts()
		self.assertTrue(facts["has_chapter"])
		self.assertTrue(facts["has_lesson"])
		self.assertTrue(facts["has_course_image"])
		self.assertTrue(facts["has_published_course"])

	def test_batch_facts_follow_the_first_batch(self):
		course = self._create_course(title="Onboarding Course")
		self._create_evaluator()
		batch = self._create_batch(course.name, title="Onboarding Batch")
		frappe.db.set_value("LMS Batch", batch.name, "published", 0)

		facts = self._facts()
		self.assertEqual(facts["first_batch"], batch.name)
		self.assertTrue(facts["has_batch"])
		self.assertTrue(facts["has_batch_course"])
		self.assertFalse(facts["has_batch_student"])
		self.assertFalse(facts["has_live_class"])
		self.assertFalse(facts["has_published_batch"])

		student = self._create_user("onboarding-student@example.com", "Onb", "Student", ["LMS Student"])
		self._create_batch_enrollment(student.name, batch.name)
		self._insert_live_class(batch.name)
		frappe.db.set_value("LMS Batch", batch.name, "published", 1)

		facts = self._facts()
		self.assertTrue(facts["has_batch_student"])
		self.assertTrue(facts["has_live_class"])
		self.assertTrue(facts["has_published_batch"])

	def test_batch_without_courses_has_no_batch_course(self):
		course = self._create_course(title="Onboarding Course")
		self._create_evaluator()
		batch = self._create_batch(course.name, title="Onboarding Batch")
		frappe.db.delete("Batch Course", {"parent": batch.name})

		self.assertFalse(self._facts()["has_batch_course"])

	def test_admin_created_student_counts_as_invited(self):
		self._create_user("onboarding-student@example.com", "Onb", "Student", ["LMS Student"])
		self.assertTrue(self._facts()["has_invited_student"])

	def test_self_signed_up_student_is_not_invited(self):
		student = self._create_user("onboarding-student@example.com", "Onb", "Student", ["LMS Student"])
		frappe.db.set_value("User", student.name, "owner", "Guest")
		self.assertFalse(self._facts()["has_invited_student"])

		frappe.db.set_value("User", student.name, "owner", student.name)
		self.assertFalse(self._facts()["has_invited_student"])

	def _student(self, email, *roles):
		user = self._create_user(email, "Onb", "User", [])
		user.add_roles("LMS Student", *roles)
		return user

	def test_demo_students_are_not_invited(self):
		self._student("john.doe@example.com")
		self.assertFalse(self._facts()["has_invited_student"])

	def test_staff_with_student_role_is_not_invited(self):
		self._student("onboarding-admin@example.com", "System Manager")
		self._student("onboarding-mod@example.com", "Moderator")
		self.assertFalse(self._facts()["has_invited_student"])

	def test_disabled_student_is_not_invited(self):
		student = self._create_user("onboarding-student@example.com", "Onb", "Student", ["LMS Student"])
		frappe.db.set_value("User", student.name, "enabled", 0)
		self.assertFalse(self._facts()["has_invited_student"])

	def test_zoom_account_counts_as_conferencing(self):
		frappe.get_doc(
			{
				"doctype": "LMS Zoom Settings",
				"name": "Onboarding Zoom",
				"account_name": "Onboarding Zoom",
				"account_id": "acc",
				"client_id": "cid",
				"member": self.admin.name,
			}
		).db_insert()
		self.assertTrue(self._facts()["has_conferencing_account"])

	def test_google_meet_account_counts_as_conferencing(self):
		frappe.get_doc(
			{
				"doctype": "LMS Google Meet Settings",
				"name": "Onboarding Meet",
				"account_name": "Onboarding Meet",
				"member": self.admin.name,
			}
		).db_insert()
		self.assertTrue(self._facts()["has_conferencing_account"])

	def _insert_live_class(self, batch):
		frappe.get_doc(
			{
				"doctype": "LMS Live Class",
				"name": frappe.generate_hash(length=10),
				"title": "Onboarding live class",
				"batch_name": batch,
				"host": self.admin.name,
				"date": nowdate(),
				"time": "10:00:00",
				"duration": 60,
				"timezone": "Asia/Kolkata",
			}
		).db_insert()
